const CATEGORIES = new Set([
  "general_support", "account_help", "seller_support", "billing", "bug_report", "sales",
  "partnership", "security_report", "privacy_request", "refund_request", "payment_dispute", "payout_issue",
])
const PUBLIC_CATEGORIES = new Set(["general_support", "bug_report", "sales", "partnership", "security_report", "privacy_request"])
const STATUSES = new Set(["open", "triaged", "in_progress", "waiting_on_user", "waiting_internal", "resolved", "closed", "reopened"])
const PRIORITIES = new Set(["low", "normal", "high", "urgent"])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const REF_FIELDS = ["workspaceId", "projectId", "listingId", "submissionId", "releaseId", "orderId", "subscriptionId", "payoutBatchId"]

export class RequestCaseError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

function exact(input, allowed) {
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(key => !allowed.includes(key))) throw new RequestCaseError(422, "Invalid request payload.")
}
function text(value, label, minimum, maximum) {
  if (typeof value !== "string") throw new RequestCaseError(422, `Invalid ${label}.`)
  const clean = value.trim()
  if (clean.length < minimum || clean.length > maximum || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(clean)) throw new RequestCaseError(422, `Invalid ${label}.`)
  return clean
}
function optionalEmail(value, required) {
  if (value === undefined || value === null || value === "") {
    if (required) throw new RequestCaseError(422, "A valid email address is required.")
    return null
  }
  const clean = text(value, "email address", 3, 320).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new RequestCaseError(422, "A valid email address is required.")
  return clean
}
function uuid(value, label) {
  if (value === undefined || value === null || value === "") return null
  if (typeof value !== "string" || !UUID.test(value)) throw new RequestCaseError(422, `Invalid ${label}.`)
  return value
}
function requestNumber() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const bytes = new Uint8Array(6); crypto.getRandomValues(bytes)
  return "WCB-REQ-" + [...bytes].map(value => alphabet[value % alphabet.length]).join("")
}
const iso = value => value ? new Date(value).toISOString() : null
function present(row) {
  return Object.freeze({
    requestId: String(row.request_id), requestNumber: String(row.request_number),
    requesterUserId: row.requester_user_id ? String(row.requester_user_id) : null,
    requesterEmail: row.requester_email ? String(row.requester_email) : null,
    category: String(row.category), subject: String(row.subject), description: String(row.description),
    status: String(row.status), priority: String(row.priority),
    assignedOperatorUserId: row.assigned_operator_user_id ? String(row.assigned_operator_user_id) : null,
    references: Object.fromEntries(REF_FIELDS.map(field => [field, row[field.replace(/[A-Z]/g, letter => "_" + letter.toLowerCase())] ? String(row[field.replace(/[A-Z]/g, letter => "_" + letter.toLowerCase())]) : null])),
    safeContext: row.safe_context && typeof row.safe_context === "object" ? row.safe_context : {},
    createdAt: iso(row.created_at), updatedAt: iso(row.updated_at), resolvedAt: iso(row.resolved_at),
  })
}
function event(row) {
  return Object.freeze({ eventId: String(row.event_id), requestId: String(row.request_id), actorUserId: row.actor_user_id ? String(row.actor_user_id) : null, actorKind: String(row.actor_kind), eventType: String(row.event_type), visibility: String(row.visibility), data: row.event_data ?? {}, createdAt: iso(row.created_at) })
}
async function operator(db, session, minimum = "reviewer") {
  const rank = { reviewer: 1, admin: 2, bigperson: 3 }
  const row = (await db.query("SELECT role,active,epoch FROM wcb_product_operators WHERE user_id=$1 AND active FOR SHARE", [session.userId])).rows[0]
  if (!row || (rank[String(row.role)] || 0) < rank[minimum]) throw new RequestCaseError(403, "Operator authority required.")
  return row
}
async function insertEvent(db, requestId, actorUserId, actorKind, eventType, visibility, data) {
  await db.query("INSERT INTO wcb_request_events(event_id,request_id,actor_user_id,actor_kind,event_type,visibility,event_data,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,clock_timestamp())", [crypto.randomUUID(), requestId, actorUserId, actorKind, eventType, visibility, JSON.stringify(data)])
}

export async function createRequest(db, input, session = undefined) {
  exact(input, ["category", "subject", "description", "requesterEmail", "safeContext", ...REF_FIELDS])
  const category = String(input.category || "")
  if (!CATEGORIES.has(category)) throw new RequestCaseError(422, "Invalid request category.")
  if (!session && !PUBLIC_CATEGORIES.has(category)) throw new RequestCaseError(403, "Sign in to submit this request type.")
  const email = session ? null : optionalEmail(input.requesterEmail, true)
  const references = REF_FIELDS.map(field => uuid(input[field], field))
  const safe = input.safeContext === undefined ? {} : input.safeContext
  const encoded = JSON.stringify(safe)
  if (!safe || typeof safe !== "object" || Array.isArray(safe) || encoded.length > 2048 || Object.keys(safe).some(key => !["currentUrl", "appVersion", "browser"].includes(key)) || Object.values(safe).some(value => typeof value !== "string" || value.length > 500)) throw new RequestCaseError(422, "Invalid safe context.")
  const requestId = crypto.randomUUID()
  let row
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      row = (await db.query(`INSERT INTO wcb_requests(request_id,request_number,requester_user_id,requester_email,category,subject,description,status,priority,workspace_id,project_id,listing_id,submission_id,release_id,order_id,subscription_id,payout_batch_id,safe_context,created_at,updated_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,'open','normal',$8,$9,$10,$11,$12,$13,$14,$15,$16,clock_timestamp(),clock_timestamp()) RETURNING *`, [requestId, requestNumber(), session?.userId ?? null, email, category, text(input.subject, "subject", 3, 160), text(input.description, "description", 10, 5000), ...references, encoded])).rows[0]
      break
    } catch (error) { if (String(error?.code) !== "23505" || attempt === 3) throw error }
  }
  await insertEvent(db, requestId, session?.userId ?? null, session ? "requester" : "public", "created", "requester", { category })
  return present(row)
}

export async function myRequests(db, session) {
  const rows = (await db.query("SELECT * FROM wcb_requests WHERE requester_user_id=$1 ORDER BY updated_at DESC LIMIT 200", [session.userId])).rows
  return rows.map(present)
}
export async function myRequest(db, session, input) {
  exact(input, ["requestId"]); const id = uuid(input.requestId, "request")
  const row = (await db.query("SELECT * FROM wcb_requests WHERE request_id=$1 AND requester_user_id=$2", [id, session.userId])).rows[0]
  if (!row) throw new RequestCaseError(404, "Request not found.")
  const events = (await db.query("SELECT * FROM wcb_request_events WHERE request_id=$1 AND visibility='requester' ORDER BY created_at,event_id", [id])).rows.map(event)
  return { request: present(row), events }
}

export async function requestQueue(db, session, input = {}) {
  await operator(db, session); exact(input, ["query", "category", "status", "priority", "assignment", "requestId"])
  const values = [], where = []
  if (input.query) { values.push("%" + text(input.query, "search query", 1, 100).replace(/[\\%_]/g, "\\$&") + "%"); where.push(`(request_number ILIKE $${values.length} ESCAPE '\\' OR subject ILIKE $${values.length} ESCAPE '\\' OR requester_email ILIKE $${values.length} ESCAPE '\\')`) }
  if (input.category) { if (!CATEGORIES.has(input.category)) throw new RequestCaseError(422, "Invalid category filter."); values.push(input.category); where.push(`category=$${values.length}`) }
  if (input.status) { if (!STATUSES.has(input.status)) throw new RequestCaseError(422, "Invalid status filter."); values.push(input.status); where.push(`status=$${values.length}`) }
  if (input.priority) { if (!PRIORITIES.has(input.priority)) throw new RequestCaseError(422, "Invalid priority filter."); values.push(input.priority); where.push(`priority=$${values.length}`) }
  if (input.assignment === "assigned") where.push("assigned_operator_user_id IS NOT NULL")
  else if (input.assignment === "unassigned") where.push("assigned_operator_user_id IS NULL")
  else if (input.assignment && input.assignment !== "all") throw new RequestCaseError(422, "Invalid assignment filter.")
  const rows = (await db.query(`SELECT * FROM wcb_requests ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,updated_at DESC LIMIT 200`, values)).rows.map(present)
  let selected = null, events = []
  const selectedId = input.requestId ? uuid(input.requestId, "request") : rows[0]?.requestId
  if (selectedId) {
    const row = (await db.query("SELECT * FROM wcb_requests WHERE request_id=$1", [selectedId])).rows[0]
    if (row) { selected = present(row); events = (await db.query("SELECT * FROM wcb_request_events WHERE request_id=$1 ORDER BY created_at,event_id", [selectedId])).rows.map(event) }
  }
  const operators = (await db.query("SELECT user_id,role FROM wcb_product_operators WHERE active ORDER BY CASE role WHEN 'bigperson' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END,user_id LIMIT 200")).rows.map(row => ({ userId: String(row.user_id), role: String(row.role) }))
  return { requests: rows, selected, events, operators }
}

const ALLOWED_TRANSITIONS = Object.freeze({ open: ["triaged", "closed"], triaged: ["in_progress", "waiting_internal", "closed"], in_progress: ["waiting_on_user", "waiting_internal", "resolved"], waiting_on_user: ["in_progress", "resolved"], waiting_internal: ["in_progress", "resolved"], resolved: ["closed", "reopened"], closed: ["reopened"], reopened: ["triaged", "in_progress"] })
export async function mutateRequest(db, session, action, input) {
  await operator(db, session)
  exact(input, action === "assign" ? ["requestId", "operatorUserId"] : action === "status" ? ["requestId", "status"] : action === "priority" ? ["requestId", "priority"] : action === "note" ? ["requestId", "body", "visibility"] : ["requestId", "actionType", "reference"])
  const requestId = uuid(input.requestId, "request")
  const current = (await db.query("SELECT * FROM wcb_requests WHERE request_id=$1 FOR UPDATE", [requestId])).rows[0]
  if (!current) throw new RequestCaseError(404, "Request not found.")
  if (action === "assign") {
    const target = input.operatorUserId === null ? null : uuid(input.operatorUserId, "operator")
    if (target) { const valid = (await db.query("SELECT user_id FROM wcb_product_operators WHERE user_id=$1 AND active", [target])).rows[0]; if (!valid) throw new RequestCaseError(422, "Assignee is not an active operator.") }
    await db.query("UPDATE wcb_requests SET assigned_operator_user_id=$2,updated_at=clock_timestamp() WHERE request_id=$1", [requestId, target])
    await insertEvent(db, requestId, session.userId, "operator", "assigned", "internal", { before: current.assigned_operator_user_id ? String(current.assigned_operator_user_id) : null, after: target })
  } else if (action === "status") {
    const next = String(input.status || "")
    if (!STATUSES.has(next) || !ALLOWED_TRANSITIONS[String(current.status)]?.includes(next)) throw new RequestCaseError(409, "Invalid request status transition.")
    await db.query("UPDATE wcb_requests SET status=$2,resolved_at=CASE WHEN $2='resolved' THEN clock_timestamp() WHEN $2='reopened' THEN NULL ELSE resolved_at END,updated_at=clock_timestamp() WHERE request_id=$1", [requestId, next])
    await insertEvent(db, requestId, session.userId, "operator", "status_changed", "requester", { before: String(current.status), after: next })
  } else if (action === "priority") {
    const next = String(input.priority || ""); if (!PRIORITIES.has(next)) throw new RequestCaseError(422, "Invalid request priority.")
    await db.query("UPDATE wcb_requests SET priority=$2,updated_at=clock_timestamp() WHERE request_id=$1", [requestId, next])
    await insertEvent(db, requestId, session.userId, "operator", "priority_changed", "internal", { before: String(current.priority), after: next })
  } else if (action === "note") {
    const visibility = input.visibility === "requester" ? "requester" : input.visibility === "internal" ? "internal" : null
    if (!visibility) throw new RequestCaseError(422, "Invalid note visibility.")
    const body = text(input.body, "note", 1, 5000)
    await db.query("UPDATE wcb_requests SET updated_at=clock_timestamp() WHERE request_id=$1", [requestId])
    await insertEvent(db, requestId, session.userId, "operator", visibility === "internal" ? "internal_note_added" : "requester_response_recorded", visibility, { body })
  } else {
    const actionType = text(input.actionType, "authoritative action type", 3, 100), reference = text(input.reference, "authoritative action reference", 3, 200)
    await insertEvent(db, requestId, session.userId, "operator", "authoritative_action_linked", "internal", { actionType, reference })
  }
  const updated = (await db.query("SELECT * FROM wcb_requests WHERE request_id=$1", [requestId])).rows[0]
  return present(updated)
}

export const requestCategories = CATEGORIES
export const publicRequestCategories = PUBLIC_CATEGORIES
