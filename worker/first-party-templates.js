import { Buffer } from 'node:buffer'
import { createHash, randomUUID } from 'node:crypto'
import { sourceContentHash } from './editor-projects.js'

const templates = Object.freeze({ 'aperture-north': 'Aperture North', stillform: 'Stillform' })
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const keyPattern = /^[A-Za-z0-9_-]{16,100}$/
const base64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
const digest = value => createHash('sha256').update(value).digest('hex')
export class FirstPartyTemplateError extends Error { constructor(status, message) { super(message); this.status = status } }
const fail = (status, message) => { throw new FirstPartyTemplateError(status, message) }

async function templateSource(env, slug) {
  const response = await env.ASSETS.fetch(new Request(`https://webcanbe.com/template-source/${slug}.json`))
  if (!response.ok) fail(503, 'Template source is temporarily unavailable.')
  const source = await response.json()
  if (source?.slug !== slug || !source.files || typeof source.files !== 'object' || Array.isArray(source.files) || typeof source.digest !== 'string') fail(503, 'Template source is invalid.')
  const entries = Object.entries(source.files).sort(([a], [b]) => a.localeCompare(b))
  if (entries.length < 5 || entries.length > 100 || digest(JSON.stringify(entries)) !== source.digest) fail(503, 'Template source integrity check failed.')
  let total = 0
  const files = new Map()
  for (const [name, encoded] of entries) {
    if (!/^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+$/.test(name) || name.split('/').some(part => part === '.' || part === '..') || typeof encoded !== 'string' || !base64.test(encoded)) fail(503, 'Template source integrity check failed.')
    const bytes = Buffer.from(encoded, 'base64')
    total += bytes.length
    if (bytes.length > 2 * 1024 * 1024 || total > 12 * 1024 * 1024) fail(503, 'Template source exceeds limits.')
    files.set(name, bytes)
  }
  if (!files.has('package.json') || !files.has('index.html') || !files.has('src/main.tsx')) fail(503, 'Template source is incomplete.')
  return { files, encoded: source.files, digest: source.digest }
}

export async function createFirstPartyTemplate(db, session, body, env) {
  if (!body || Object.keys(body).some(key => !['slug', 'workspaceId', 'idempotencyKey'].includes(key))) fail(422, 'Invalid template request.')
  const { slug, workspaceId, idempotencyKey } = body
  if (!Object.hasOwn(templates, slug) || typeof workspaceId !== 'string' || !uuid.test(workspaceId) || typeof idempotencyKey !== 'string' || !keyPattern.test(idempotencyKey)) fail(422, 'Invalid template request.')
  const source = await templateSource(env, slug)
  await db.query('BEGIN')
  try {
    const authority = await db.query(`SELECT w.workspace_id FROM wcb_workspace_members w JOIN wcb_sessions s ON s.user_id=w.user_id
      WHERE w.workspace_id=$1 AND w.user_id=$2 AND w.active AND w.role IN ('owner','editor')
      AND s.session_id=$3 AND s.active AND s.expires_at=to_timestamp($4/1000.0) AND s.expires_at>clock_timestamp()
      AND NOT EXISTS(SELECT 1 FROM wcb_disabled_users d WHERE d.user_id=$2) FOR SHARE`, [workspaceId, session.userId, session.sessionId, session.expiresAt])
    if (!authority.rowCount) fail(403, 'Template creation requires an editable workspace.')
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,113))', [`${session.userId}:${idempotencyKey}`])
    const previous = await db.query(`SELECT p.project_id,p.history FROM wcb_projects p JOIN wcb_project_members m ON m.project_id=p.project_id
      WHERE p.workspace_id=$1 AND m.user_id=$2 AND m.active AND NOT p.deleted
      AND p.history->'templateOrigin'->>'idempotencyKey'=$3 LIMIT 1`, [workspaceId, session.userId, idempotencyKey])
    if (previous.rowCount) {
      if (previous.rows[0].history?.templateOrigin?.slug !== slug) fail(409, 'This request key already belongs to another template.')
      await db.query('COMMIT')
      return { projectId: String(previous.rows[0].project_id), replayed: true }
    }
    const count = await db.query('SELECT count(*) AS n FROM wcb_projects WHERE workspace_id=$1 AND NOT deleted', [workspaceId])
    if (Number(count.rows[0]?.n) >= 20) fail(409, 'This workspace has reached its project limit.')
    const projectId = randomUUID(), revisionId = `rev_${randomUUID()}`, createdAt = new Date().toISOString()
    const history = { schema: 1, sourceScope: 2, projectId,
      templateOrigin: { slug, digest: source.digest, idempotencyKey },
      revisions: [{ revisionId, projectId, parentRevisionId: null, createdAt, actor: session.userId, producer: 'system', contentHash: sourceContentHash(source.files, { sourceScope: 2 }) }],
      transactions: [], past: [], future: [] }
    await db.query('INSERT INTO wcb_projects(project_id,workspace_id,name,revision,files,history,source_epoch) VALUES($1,$2,$3,$4,$5,$6,1)', [projectId, workspaceId, templates[slug], revisionId, JSON.stringify(source.encoded), JSON.stringify(history)])
    await db.query("INSERT INTO wcb_project_members(project_id,user_id,role,epoch,active) VALUES($1,$2,'owner',1,true)", [projectId, session.userId])
    await db.query('COMMIT')
    return { projectId, replayed: false }
  } catch (error) { await db.query('ROLLBACK').catch(() => {}); throw error }
}
