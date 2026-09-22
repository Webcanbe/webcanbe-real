import fs from "node:fs"
import { describe, expect, it } from "vitest"
import { createRequest, mutateRequest, myRequest, myRequests, requestQueue } from "./requests.js"

const USER_A="00000000-0000-4000-8000-000000000001", USER_B="00000000-0000-4000-8000-000000000002", OPERATOR="00000000-0000-4000-8000-000000000003"
class RequestDb {
  requests=[]; events=[]
  async query(sql,values=[]){
    if(sql.startsWith("INSERT INTO wcb_requests")){
      const fields=["request_id","request_number","requester_user_id","requester_email","category","subject","description","workspace_id","project_id","listing_id","submission_id","release_id","order_id","subscription_id","payout_batch_id","safe_context"]
      const row=Object.fromEntries(fields.map((field,index)=>[field,values[index]]));Object.assign(row,{status:"open",priority:"normal",assigned_operator_user_id:null,created_at:new Date(),updated_at:new Date(),resolved_at:null,safe_context:JSON.parse(row.safe_context)});this.requests.push(row);return {rows:[row]}
    }
    if(sql.startsWith("INSERT INTO wcb_request_events")){this.events.push({event_id:values[0],request_id:values[1],actor_user_id:values[2],actor_kind:values[3],event_type:values[4],visibility:values[5],event_data:JSON.parse(values[6]),created_at:new Date()});return {rows:[]}}
    if(sql.includes("FROM wcb_product_operators WHERE user_id=$1 AND active FOR SHARE"))return {rows:values[0]===OPERATOR?[{role:"reviewer",active:true,epoch:1}]:[]}
    if(sql.includes("FROM wcb_product_operators WHERE user_id=$1 AND active"))return {rows:values[0]===OPERATOR?[{user_id:OPERATOR}]:[]}
    if(sql.includes("FROM wcb_product_operators WHERE active ORDER BY"))return {rows:[{user_id:OPERATOR,role:"reviewer"}]}
    if(sql.startsWith("SELECT * FROM wcb_requests WHERE requester_user_id=$1"))return {rows:this.requests.filter(row=>row.requester_user_id===values[0])}
    if(sql.startsWith("SELECT * FROM wcb_requests WHERE request_id=$1 AND requester_user_id=$2"))return {rows:this.requests.filter(row=>row.request_id===values[0]&&row.requester_user_id===values[1])}
    if(sql.startsWith("SELECT * FROM wcb_requests WHERE request_id=$1"))return {rows:this.requests.filter(row=>row.request_id===values[0])}
    if(sql.startsWith("SELECT * FROM wcb_requests "))return {rows:this.requests}
    if(sql.startsWith("SELECT * FROM wcb_request_events")){const requesterOnly=sql.includes("visibility='requester'");return {rows:this.events.filter(row=>row.request_id===values[0]&&(!requesterOnly||row.visibility==="requester"))}}
    if(sql.startsWith("UPDATE wcb_requests SET status=")){const row=this.requests.find(item=>item.request_id===values[0]);row.status=values[1];row.updated_at=new Date();if(values[1]==="resolved")row.resolved_at=new Date();if(values[1]==="reopened")row.resolved_at=null;return {rows:[]}}
    if(sql.startsWith("UPDATE wcb_requests SET assigned_operator")){const row=this.requests.find(item=>item.request_id===values[0]);row.assigned_operator_user_id=values[1];return {rows:[]}}
    if(sql.startsWith("UPDATE wcb_requests SET priority=")){const row=this.requests.find(item=>item.request_id===values[0]);row.priority=values[1];return {rows:[]}}
    if(sql.startsWith("UPDATE wcb_requests SET updated_at="))return {rows:[]}
    throw new Error("Unhandled SQL: "+sql)
  }
}

describe("persisted request cases",()=>{
  it("creates public and authenticated cases with server-owned requester identity",async()=>{
    const db=new RequestDb()
    const publicCase=await createRequest(db,{category:"general_support",requesterEmail:"help@example.com",subject:"Need some help",description:"This is a safely bounded support description."})
    expect(publicCase.requestNumber).toMatch(/^WCB-REQ-[A-Z0-9]{6}$/);expect(publicCase.requesterUserId).toBeNull()
    const signedIn=await createRequest(db,{category:"billing",requesterEmail:"spoof@example.com",subject:"Billing question",description:"Please explain this charge on my account."},{userId:USER_A})
    expect(signedIn.requesterUserId).toBe(USER_A);expect(signedIn.requesterEmail).toBeNull();expect(db.events.map(event=>event.event_type)).toEqual(["created","created"])
  })

  it("rejects unsafe categories, public protected categories, unknown identity fields and oversized input",async()=>{
    const db=new RequestDb(), valid={category:"general_support",requesterEmail:"help@example.com",subject:"Need some help",description:"This is a safely bounded support description."}
    await expect(createRequest(db,{...valid,category:"root_access"})).rejects.toMatchObject({status:422})
    await expect(createRequest(db,{...valid,category:"billing"})).rejects.toMatchObject({status:403})
    await expect(createRequest(db,{...valid,requesterUserId:USER_B})).rejects.toMatchObject({status:422})
    await expect(createRequest(db,{...valid,description:"x".repeat(5001)})).rejects.toMatchObject({status:422})
  })

  it("scopes My Requests and records deliberate operator transitions without product mutation",async()=>{
    const db=new RequestDb(), a=await createRequest(db,{category:"billing",subject:"Account A case",description:"A complete authenticated request body."},{userId:USER_A}), b=await createRequest(db,{category:"account_help",subject:"Account B case",description:"Another complete authenticated request body."},{userId:USER_B})
    expect((await myRequests(db,{userId:USER_A})).map(item=>item.requestId)).toEqual([a.requestId])
    await expect(myRequest(db,{userId:USER_A},{requestId:b.requestId})).rejects.toMatchObject({status:404})
    const queue=await requestQueue(db,{userId:OPERATOR},{});expect(queue.requests).toHaveLength(2)
    await mutateRequest(db,{userId:OPERATOR},"assign",{requestId:a.requestId,operatorUserId:OPERATOR})
    await mutateRequest(db,{userId:OPERATOR},"status",{requestId:a.requestId,status:"triaged"})
    await mutateRequest(db,{userId:OPERATOR},"note",{requestId:a.requestId,body:"Investigating safely.",visibility:"internal"})
    expect(db.events.map(event=>event.event_type)).toContain("assigned");expect(db.events.map(event=>event.event_type)).toContain("status_changed");expect(db.events.map(event=>event.event_type)).toContain("internal_note_added")
    const source=fs.readFileSync("worker/requests.js","utf8");expect(source).not.toMatch(/UPDATE wcb_(orders|listings|product_operators)/)
  })
})
