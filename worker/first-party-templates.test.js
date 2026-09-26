import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createFirstPartyTemplate } from './first-party-templates.js'

const userId = '11111111-1111-4111-8111-111111111111'
const workspaceId = '22222222-2222-4222-8222-222222222222'
const session = { userId, sessionId: '33333333-3333-4333-8333-333333333333', expiresAt: Date.now() + 60000 }

function database() {
  const projects = []
  return {
    projects,
    async query(sql, params = []) {
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql) || sql.includes('pg_advisory_xact_lock')) return { rows: [], rowCount: 0 }
      if (sql.includes('FROM wcb_workspace_members')) return { rows: [{ workspace_id: workspaceId }], rowCount: 1 }
      if (sql.includes('history->\'templateOrigin\'')) {
        const project = projects.find(item => item.workspaceId === params[0] && item.history.templateOrigin.idempotencyKey === params[2])
        return { rows: project ? [{ project_id: project.id, history: project.history }] : [], rowCount: project ? 1 : 0 }
      }
      if (sql.includes('SELECT count(*) AS n FROM wcb_projects')) return { rows: [{ n: projects.length }], rowCount: 1 }
      if (sql.includes('INSERT INTO wcb_projects')) {
        projects.push({ id: params[0], workspaceId: params[1], name: params[2], revision: params[3], files: JSON.parse(params[4]), history: JSON.parse(params[5]) })
        return { rows: [], rowCount: 1 }
      }
      if (sql.includes('INSERT INTO wcb_project_members')) return { rows: [], rowCount: 1 }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }
}

describe('first-party template source lineage', () => {
  it.each([
    ['aperture-north', 'Field House'],
    ['stillform', 'The Coast House'],
  ])('stores the exact selected %s source and replays only that choice', async (slug, uniqueText) => {
    const manifest = JSON.parse(fs.readFileSync(`public/template-source/${slug}.json`, 'utf8'))
    const db = database()
    const env = { ASSETS: { fetch: async () => new Response(JSON.stringify(manifest), { status: 200 }) } }
    const request = { slug, workspaceId, idempotencyKey: 'selected-template-key-1234' }
    const first = await createFirstPartyTemplate(db, session, request, env)
    const replay = await createFirstPartyTemplate(db, session, request, env)
    expect(replay).toEqual({ projectId: first.projectId, replayed: true })
    expect(db.projects).toHaveLength(1)
    const project = db.projects[0]
    expect(project.files).toEqual(manifest.files)
    expect(project.history.templateOrigin).toEqual({ slug, digest: manifest.digest, idempotencyKey: request.idempotencyKey })
    expect(Buffer.from(project.files['src/main.tsx'], 'base64').toString('utf8')).toContain(uniqueText)
    const other = slug === 'stillform' ? 'aperture-north' : 'stillform'
    await expect(createFirstPartyTemplate(db, session, { ...request, slug: other }, { ASSETS: { fetch: async () => new Response(fs.readFileSync(`public/template-source/${other}.json`, 'utf8')) } })).rejects.toMatchObject({ status: 409 })
  })
})
