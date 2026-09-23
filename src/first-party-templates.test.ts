import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createFirstPartyTemplate } from '../worker/first-party-templates.js'

const uuid = '2d661aef-2142-47e0-b9f4-7da47ac9465a'
const files = {
  'index.html': Buffer.from('<div id="root"></div>').toString('base64'),
  'package.json': Buffer.from('{"name":"stillform"}').toString('base64'),
  'src/main.tsx': Buffer.from('export const title = "Stillform"').toString('base64'),
  'src/style.css': Buffer.from('h1 { color: black }').toString('base64'),
  'vite.config.ts': Buffer.from('export default {}').toString('base64'),
}
const entries = Object.entries(files).sort(([a], [b]) => a.localeCompare(b))
const digest = createHash('sha256').update(JSON.stringify(entries)).digest('hex')
const env = { ASSETS: { fetch: async () => new Response(JSON.stringify({ slug: 'stillform', digest, files })) } }
const session = { userId: uuid, sessionId: uuid, expiresAt: Date.now() + 60_000 }
const input = { slug: 'stillform', workspaceId: uuid, idempotencyKey: 'template-request-123' }

describe('first-party source template creation', () => {
  it('creates an editable project with a verified source digest and owner grant', async () => {
    const queries: Array<{ sql: string; args: unknown[] }> = []
    const db = { query: async (sql: string, args: unknown[] = []) => {
      queries.push({ sql, args })
      if (sql.includes('SELECT w.workspace_id')) return { rowCount: 1, rows: [{ workspace_id: uuid }] }
      if (sql.includes('SELECT count(*)')) return { rowCount: 1, rows: [{ n: '0' }] }
      return { rowCount: 0, rows: [] }
    } }
    const result = await createFirstPartyTemplate(db, session, input, env)
    expect(result.replayed).toBe(false)
    const insert = queries.find(query => query.sql.includes('INSERT INTO wcb_projects'))!
    expect(insert).toBeTruthy()
    expect(JSON.parse(insert.args[4] as string)).toEqual(files)
    const history = JSON.parse(insert.args[5] as string)
    expect(history.templateOrigin).toEqual({ slug: 'stillform', digest, idempotencyKey: input.idempotencyKey })
    expect(history.revisions[0].contentHash).toMatch(/^[a-f0-9]{64}$/)
    expect(queries.some(query => query.sql.includes('INSERT INTO wcb_project_members'))).toBe(true)
    expect(queries.at(-1)?.sql).toBe('COMMIT')
  })

  it('refuses a workspace without current membership', async () => {
    const db = { query: async (sql: string) => sql.includes('SELECT w.workspace_id') ? { rowCount: 0, rows: [] } : { rowCount: 0, rows: [] } }
    await expect(createFirstPartyTemplate(db, session, input, env)).rejects.toMatchObject({ status: 403 })
  })
})
