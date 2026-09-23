import { createHash, randomUUID } from 'node:crypto'

const CLIENT_EVENTS = new Set(['project_opened','preview_opened','visual_opened','code_opened','split_opened','history_opened','first_element_selected','mobile_preview_used','tablet_preview_used','ai_panel_opened','ai_proposal_reviewed','export_started','share_created','submission_started'])
const SCORES = Object.freeze({ working_copy_created: 8, source_saved: 3, ai_edit_applied: 12, export_completed: 8, final_submission: 20, referred_signup: 4, referred_project_opened: 4, referred_first_save: 10, referred_ai_edit: 16, referred_stage_3: 12, referred_final_submission: 20 })
const CAPS = Object.freeze({ source_saved: 8, ai_edit_applied: 6, export_completed: 3, referred_signup: 25, referred_project_opened: 25, referred_first_save: 25, referred_ai_edit: 25, referred_stage_3: 25, referred_final_submission: 25 })
const STAGES = [0, 30, 80, 160, 280, 420]
export const defaultWinnerWeights = Object.freeze({ build:40, social:40, completion:20 })
export function winnerWeights(value) {
  if (typeof value !== 'string') return defaultWinnerWeights
  const parts = value.split(',').map(Number)
  return parts.length === 3 && parts.every(item => Number.isInteger(item) && item >= 0 && item <= 100) && parts.reduce((a,b)=>a+b,0) === 100
    ? { build:parts[0], social:parts[1], completion:parts[2] } : defaultWinnerWeights
}
const UUID = /^[a-f0-9-]{36}$/i

export class BuildLeagueError extends Error { constructor(status, message) { super(message); this.status = status } }
const refuse = (status, message) => { throw new BuildLeagueError(status, message) }
const refCode = userId => createHash('sha256').update('build-league:v1:' + userId).digest('hex').slice(0, 12)

export async function ensureParticipant(db, session, referralCode, visitorToken) {
  const userId = session.userId
  const existing = (await db.query('SELECT user_id,referral_code,referred_by FROM wcb_build_league_participants WHERE user_id=$1', [userId])).rows[0]
  if (existing) {
    if (referralCode && existing.referred_by) await recordEvent(db,{userId:existing.referred_by},'referred_signup',userId,null,'referral')
    return existing
  }
  let referrer
  if (typeof referralCode === 'string' && /^[a-z0-9]{12}$/.test(referralCode)) {
    referrer = (await db.query('SELECT user_id FROM wcb_build_league_participants WHERE referral_code=$1 AND user_id<>$2', [referralCode,userId])).rows[0]
    if (referrer && typeof visitorToken === 'string' && /^[A-Za-z0-9_-]{32}$/.test(visitorToken)) {
      const visitorHash = createHash('sha256').update('build-league-visit:' + visitorToken).digest('hex')
      const visit = (await db.query('SELECT first_seen_at FROM wcb_build_league_visits WHERE referrer_user_id=$1 AND visitor_hash=$2',[referrer.user_id,visitorHash])).rows[0]
      const profile = (await db.query('SELECT created_at FROM wcb_user_profiles WHERE user_id=$1',[userId])).rows[0]
      // Existing accounts do not become referred signups by following a link.
      if (!visit || !profile || new Date(profile.created_at).getTime() < new Date(visit.first_seen_at).getTime() - 300000) referrer = undefined
    } else referrer = undefined
  }
  const row = (await db.query('INSERT INTO wcb_build_league_participants(user_id,referral_code,referred_by) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET referred_by=coalesce(wcb_build_league_participants.referred_by,excluded.referred_by) RETURNING user_id,referral_code,referred_by',[userId,refCode(userId),referrer?.user_id ?? null])).rows[0]
  if (referrer && row.referred_by === referrer.user_id) await recordEvent(db,{userId:referrer.user_id},'referred_signup',userId,null,'referral')
  return row
}

export async function recordEvent(db, session, kind, eventKey, projectId = null, source = 'product') {
  if (source === 'client' && !CLIENT_EVENTS.has(kind)) refuse(400,'This event must be verified by the product.')
  if (source !== 'client' && !Object.hasOwn(SCORES, kind) && !['project_opened','preview_opened','text_edited','style_edited','layout_edited','ai_proposal_created','submission_completed'].includes(kind)) refuse(400,'Unknown campaign event.')
  if (typeof eventKey !== 'string' || !eventKey || eventKey.length > 160 || /[\x00-\x1f]/.test(eventKey)) refuse(400,'Invalid event identity.')
  if (projectId !== null && !UUID.test(projectId)) refuse(400,'Invalid project identity.')
  await ensureParticipant(db, session)
  const prior = (await db.query('SELECT event_id FROM wcb_build_league_events WHERE user_id=$1 AND kind=$2 AND event_key=$3',[session.userId,kind,eventKey])).rows[0]
  if (prior) return false
  const count = Number((await db.query('SELECT count(*) AS n FROM wcb_build_league_events WHERE user_id=$1 AND kind=$2',[session.userId,kind])).rows[0]?.n ?? 0)
  if (source === 'client' && count >= 30) return false
  const points = source === 'client' ? 0 : count < (CAPS[kind] ?? 1) ? (SCORES[kind] ?? 0) : 0
  const result = await db.query('INSERT INTO wcb_build_league_events(event_id,user_id,kind,project_id,event_key,source,points) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(user_id,kind,event_key) DO NOTHING RETURNING event_id',[randomUUID(),session.userId,kind,projectId,eventKey,source,points])
  if (!result.rowCount) return false
  if (source === 'product') {
    const participant = (await db.query('SELECT referred_by FROM wcb_build_league_participants WHERE user_id=$1',[session.userId])).rows[0]
    const socialKind = { project_opened:'referred_project_opened', source_saved:'referred_first_save', ai_edit_applied:'referred_ai_edit', final_submission:'referred_final_submission' }[kind]
    if (participant?.referred_by && socialKind) await recordEvent(db,{userId:participant.referred_by},socialKind,session.userId,null,'referral')
    if (participant?.referred_by) {
      const total = Number((await db.query('SELECT coalesce(sum(points),0) AS n FROM wcb_build_league_events WHERE user_id=$1',[session.userId])).rows[0]?.n ?? 0)
      if (total >= STAGES[2]) await recordEvent(db,{userId:participant.referred_by},'referred_stage_3',session.userId,null,'referral')
    }
  }
  return true
}

export async function recordReferralVisit(db, code, visitorToken) {
  if (typeof code !== 'string' || !/^[a-z0-9]{12}$/.test(code)) return false
  const owner = (await db.query('SELECT user_id FROM wcb_build_league_participants WHERE referral_code=$1',[code])).rows[0]
  if (!owner) return false
  const visitorHash = createHash('sha256').update('build-league-visit:' + visitorToken).digest('hex')
  await db.query('INSERT INTO wcb_build_league_visits(referrer_user_id,visitor_hash) VALUES($1,$2) ON CONFLICT DO NOTHING',[owner.user_id,visitorHash])
  return true
}

function dimension(kind) {
  if (kind.startsWith('referred_') || kind === 'share_created') return 'social'
  if (kind === 'final_submission' || kind === 'submission_completed') return 'completion'
  return 'build'
}
function stageFor(points) { return STAGES.reduce((stage, threshold, index) => points >= threshold ? index + 1 : stage,1) }

export async function campaignState(db, session, referralCode, visitorToken) {
  const participant = await ensureParticipant(db,session,referralCode,visitorToken)
  const events = (await db.query('SELECT kind,project_id,points,created_at FROM wcb_build_league_events WHERE user_id=$1 ORDER BY created_at DESC LIMIT 5',[session.userId])).rows
  const groups = (await db.query('SELECT kind,count(*) AS actions,coalesce(sum(points),0) AS points FROM wcb_build_league_events WHERE user_id=$1 GROUP BY kind',[session.userId])).rows
  const counts = Object.create(null), dimensions = {build:0,social:0,completion:0}
  for (const group of groups) { counts[group.kind]=Number(group.actions); dimensions[dimension(group.kind)] += Number(group.points) }
  const totals = (await db.query('SELECT coalesce(sum(points),0) AS n,count(*) AS actions FROM wcb_build_league_events WHERE user_id=$1',[session.userId])).rows[0]
  const fullPoints = Number(totals?.n ?? 0)
  const visits = Number((await db.query('SELECT count(*) AS n FROM wcb_build_league_visits WHERE referrer_user_id=$1',[session.userId])).rows[0]?.n ?? 0)
  const entry = (await db.query('SELECT project_id,statement,submitted_at FROM wcb_build_league_entries WHERE user_id=$1',[session.userId])).rows[0] ?? null
  const milestones = [
    counts.working_copy_created ? 'First project' : null,
    counts.source_saved ? 'First source save' : null,
    counts.ai_edit_applied ? 'First applied AI edit' : null,
    counts.export_completed ? 'First source export' : null,
    entry ? 'Final entry' : null,
  ].filter(Boolean)
  return { referralCode:participant.referral_code, stage:stageFor(fullPoints), points:fullPoints, actions:Number(totals?.actions ?? 0), counts, dimensions, milestones, uniqueReferredVisits:visits, recent:events.slice(0,5), entry }
}

export async function leaderboard(db, weights = defaultWinnerWeights) {
  const rows = (await db.query(`SELECT p.referral_code,
    coalesce(sum(e.points) FILTER (WHERE e.kind LIKE 'referred_%' OR e.kind='share_created'),0) AS social,
    coalesce(sum(e.points) FILTER (WHERE e.kind IN ('final_submission','submission_completed')),0) AS completion,
    coalesce(sum(e.points) FILTER (WHERE e.kind NOT LIKE 'referred_%' AND e.kind NOT IN ('share_created','final_submission','submission_completed')),0) AS build
    FROM wcb_build_league_participants p LEFT JOIN wcb_build_league_events e ON e.user_id=p.user_id
    GROUP BY p.referral_code`)).rows
  return rows.map(row=>{const person={label:'Builder '+String(row.referral_code).slice(0,5).toUpperCase(),build:Number(row.build),social:Number(row.social),completion:Number(row.completion)};return {...person,score:Math.round(Math.min(person.build/160,1)*weights.build+Math.min(person.social/160,1)*weights.social+Math.min(person.completion/40,1)*weights.completion)}}).sort((a,b)=>b.score-a.score||b.social-a.social||b.build-a.build).slice(0,20)
}

export async function submitEntry(db, session, body) {
  const projectId = body?.projectId, statement = typeof body?.statement === 'string' ? body.statement.trim() : ''
  if (!UUID.test(projectId) || statement.length < 20 || statement.length > 1000) refuse(400,'Choose your project and write 20–1000 characters about the build.')
  await ensureParticipant(db,session)
  const owned = (await db.query(`SELECT p.project_id FROM wcb_projects p JOIN wcb_project_members pm ON pm.project_id=p.project_id AND pm.user_id=$2 AND pm.active JOIN wcb_workspace_members wm ON wm.workspace_id=p.workspace_id AND wm.user_id=$2 AND wm.active WHERE p.project_id=$1 AND NOT p.deleted LIMIT 1`,[projectId,session.userId])).rows[0]
  if (!owned) refuse(403,'This project is not available in your workspace.')
  const saved = (await db.query("SELECT 1 FROM wcb_build_league_events WHERE user_id=$1 AND project_id=$2 AND kind IN ('source_saved','ai_edit_applied') LIMIT 1",[session.userId,projectId])).rows[0]
  if (!saved) refuse(409,'Save a real source change before submitting.')
  const inserted = await db.query('INSERT INTO wcb_build_league_entries(user_id,project_id,statement) VALUES($1,$2,$3) ON CONFLICT(user_id) DO NOTHING RETURNING submitted_at',[session.userId,projectId,statement])
  if (!inserted.rowCount) refuse(409,'Your final entry is already submitted.')
  await recordEvent(db,session,'final_submission',projectId,projectId)
  return inserted.rows[0]
}
