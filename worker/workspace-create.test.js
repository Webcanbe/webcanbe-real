import { describe, expect, it, vi } from 'vitest'
import { createDatabaseWorkspace } from './postgres-session.js'
const id='11111111-1111-4111-8111-111111111111', session={userId:'owner',sessionId:'session',expiresAt:Date.now()+10000}
function database({ own=[], occupied=false, active=true }={}) {
  return {query:vi.fn(async(sql)=>{if(sql.startsWith('SELECT s.session_id'))return {rows:[],rowCount:active?1:0};if(sql.includes('ORDER BY workspace_id'))return {rows:own.map(workspace_id=>({workspace_id})),rowCount:own.length};if(sql.includes('LIMIT 1'))return {rows:[],rowCount:occupied?1:0};return {rows:[],rowCount:1}})}
}
describe('workspace creation authority',()=>{
  it('creates a new owner membership using the verified account, and commits',async()=>{const db=database();expect(await createDatabaseWorkspace(db,session,{workspaceId:id})).toBe(id);expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO wcb_workspace_members'),[id,'owner']);expect(db.query).toHaveBeenLastCalledWith('COMMIT')})
  it('is retry-safe for the owner',async()=>{const db=database({own:[id]});await createDatabaseWorkspace(db,session,{workspaceId:id});expect(db.query.mock.calls.some(([sql])=>sql.startsWith('INSERT'))).toBe(false)})
  it('cannot claim another workspace or create under an inactive session',async()=>{for(const options of [{occupied:true},{active:false}]){const db=database(options);await expect(createDatabaseWorkspace(db,session,{workspaceId:id})).rejects.toThrow();expect(db.query.mock.calls.some(([sql])=>sql.startsWith('INSERT'))).toBe(false);expect(db.query).toHaveBeenLastCalledWith('ROLLBACK')}})
  it('rejects identity injection and enforces the per-account limit',async()=>{const db=database();await expect(createDatabaseWorkspace(db,session,{workspaceId:id,userId:'victim'})).rejects.toThrow();expect(db.query).not.toHaveBeenCalled();await expect(createDatabaseWorkspace(database({own:Array.from({length:20},(_,i)=>String(i))}),session,{workspaceId:id})).rejects.toThrow('20 workspace limit')})
})
