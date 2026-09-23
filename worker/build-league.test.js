import { describe, expect, it } from 'vitest'
import { BuildLeagueError, recordEvent, winnerWeights } from './build-league.js'

const alice = '11111111-1111-4111-8111-111111111111'
const bob = '22222222-2222-4222-8222-222222222222'
const project = '33333333-3333-4333-8333-333333333333'
function ledger(referred = false) {
  const participants = new Map()
  if (referred) participants.set(alice,{user_id:alice,referral_code:'aaaaaaaaaaaa',referred_by:null})
  const events = []
  return { events, query: async (sql, args=[]) => {
    if (sql.startsWith('SELECT user_id,referral_code,referred_by FROM wcb_build_league_participants')) return {rows:participants.has(args[0])?[participants.get(args[0])]:[]}
    if (sql.startsWith('INSERT INTO wcb_build_league_participants')) { const row=participants.get(args[0])??{user_id:args[0],referral_code:args[1],referred_by:referred?alice:null};participants.set(args[0],row);return {rows:[row],rowCount:1} }
    if (sql.startsWith('SELECT event_id FROM wcb_build_league_events')) return {rows:events.filter(e=>e.user_id===args[0]&&e.kind===args[1]&&e.event_key===args[2]).map(e=>({event_id:e.event_id}))}
    if (sql.startsWith('SELECT count(*) AS n FROM wcb_build_league_events')) return {rows:[{n:events.filter(e=>e.user_id===args[0]&&e.kind===args[1]).length}]}
    if (sql.startsWith('INSERT INTO wcb_build_league_events')) {const row={event_id:args[0],user_id:args[1],kind:args[2],project_id:args[3],event_key:args[4],source:args[5],points:args[6]};if(events.some(e=>e.user_id===row.user_id&&e.kind===row.kind&&e.event_key===row.event_key))return {rows:[],rowCount:0};events.push(row);return {rows:[row],rowCount:1}}
    if (sql.startsWith('SELECT referred_by FROM wcb_build_league_participants')) return {rows:[{referred_by:participants.get(args[0])?.referred_by}]}
    if (sql.startsWith('SELECT coalesce(sum(points),0) AS n FROM wcb_build_league_events')) return {rows:[{n:events.filter(e=>e.user_id===args[0]).reduce((sum,e)=>sum+e.points,0)}]}
    throw new Error('Unexpected query: '+sql)
  }}
}

describe('Build League evidence boundary',()=>{
  it('does not let a browser claim an applied AI edit',async()=>{
    const db=ledger()
    await expect(recordEvent(db,{userId:bob},'ai_edit_applied','rev-1',project,'client')).rejects.toMatchObject({status:400})
    expect(db.events).toHaveLength(0)
  })
  it('scores accepted AI edits once and caps repeated edits',async()=>{
    const db=ledger()
    for(let i=0;i<7;i++)await recordEvent(db,{userId:bob},'ai_edit_applied','rev-'+i,project)
    expect(await recordEvent(db,{userId:bob},'ai_edit_applied','rev-0',project)).toBe(false)
    expect(db.events.map(e=>e.points)).toEqual([12,12,12,12,12,12,0])
  })
  it('keeps panel opens tracked but unscored',async()=>{
    const db=ledger()
    await recordEvent(db,{userId:bob},'ai_panel_opened','panel-1',project,'client')
    expect(db.events[0]).toMatchObject({source:'client',points:0})
  })
  it('accepts only normalized 100 percent winner weighting',()=>{
    expect(winnerWeights('35,45,20')).toEqual({build:35,social:45,completion:20})
    expect(winnerWeights('80,80,20')).toEqual({build:40,social:40,completion:20})
  })
})
