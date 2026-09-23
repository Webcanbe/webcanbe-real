import { useEffect, useState } from "react"
import { AlertCircle, Check, Clock3, Copy, Link2, MessageSquareText, Search, UserRound, X } from "lucide-react"
import { hostedProductClient, type RequestCase, type RequestEvent, type RequestPriority, type RequestStatus } from "./hostedProductClient"
import { CreatorSelect } from "./creator-select"
import "./control-requests.css"

const categories=["general_support","account_help","seller_support","billing","bug_report","sales","partnership","security_report","privacy_request","refund_request","payment_dispute","payout_issue"]
const statuses:RequestStatus[]=["open","triaged","in_progress","waiting_on_user","waiting_internal","resolved","closed","reopened"]
const priorities:RequestPriority[]=["low","normal","high","urgent"]
const when=(value:string)=>new Date(value).toLocaleString()
const short=(value:string|null)=>value?value.slice(0,8)+"…":"—"
function Chip({value}:{value:string}){return <span className={`ops-chip ${value.replace(/_/g,"-")}`}>{value.replace(/_/g," ")}</span>}

export function ControlRequests({onBack}:{onBack:()=>void}){
  const [requests,setRequests]=useState<RequestCase[]>([]),[selected,setSelected]=useState<RequestCase|null>(null),[events,setEvents]=useState<RequestEvent[]>([]),[operators,setOperators]=useState<Array<{userId:string;role:string}>>([])
  const [loading,setLoading]=useState(true),[error,setError]=useState(""),[busy,setBusy]=useState(false)
  const [query,setQuery]=useState(""),[category,setCategory]=useState(""),[status,setStatus]=useState(""),[priority,setPriority]=useState(""),[assignment,setAssignment]=useState("all")
  const [note,setNote]=useState(""),[visibility,setVisibility]=useState<"internal"|"requester">("internal"),[actionType,setActionType]=useState(""),[actionReference,setActionReference]=useState("")
  const load=async(requestId?:string)=>{
    setLoading(true);setError("")
    try{
      const value=await hostedProductClient.controlRequestQueue({...(query?{query}:{}),...(category?{category}:{}),...(status?{status}:{}),...(priority?{priority}:{}),assignment,...(requestId?{requestId}:selected?.requestId?{requestId:selected.requestId}:{})})
      setRequests(value.requests);setSelected(value.selected);setEvents(value.events);setOperators(value.operators)
    }catch(reason){setError(reason instanceof Error?reason.message:"Request queue is unavailable.")}
    finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[])
  const mutate=async(action:"assign"|"status"|"priority"|"note"|"link-action",payload:Record<string,unknown>)=>{
    if(!selected||busy)return;setBusy(true);setError("")
    try{
      const updated=await hostedProductClient.controlMutateRequest(action,{requestId:selected.requestId,...payload})
      setSelected(updated);await load(updated.requestId)
      if(action==="note")setNote("")
      if(action==="link-action"){setActionType("");setActionReference("")}
    }catch(reason){setError(reason instanceof Error?reason.message:"Request update was refused.")}
    finally{setBusy(false)}
  }
  return <div className="ops-shell">
    <aside className="ops-nav"><div className="ops-brand"><img src="/brand/webcanbe-mark.svg" alt=""/><span><b>Webcanbe</b> Bigperson</span></div>{["Overview","Requests","Sellers & Review","Publishing","Payments & Payouts","Access & Roles","Audit"].map(label=><button key={label} className={label==="Requests"?"active":""} onClick={label==="Requests"?undefined:onBack}>{label}</button>)}<small>Operations console</small></aside>
    <main className="ops-main">
      <header className="ops-page-head"><div><h1>Requests</h1><p>Persisted support and operational cases. Cases never authorize linked high-risk actions.</p></div><button onClick={onBack}>Open privileged controls</button></header>
      <section className="ops-filters"><label className="ops-search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search reference, subject, requester…"/></label><CreatorSelect className="ops-filter-select" label="Category" value={category} onChange={setCategory} options={[{value:"",label:"All categories"},...categories.map(value=>({value,label:value}))]}/><CreatorSelect className="ops-filter-select" label="Status" value={status} onChange={setStatus} options={[{value:"",label:"All statuses"},...statuses.map(value=>({value,label:value}))]}/><CreatorSelect className="ops-filter-select" label="Priority" value={priority} onChange={setPriority} options={[{value:"",label:"All priorities"},...priorities.map(value=>({value,label:value}))]}/><CreatorSelect className="ops-filter-select" label="Assignment" value={assignment} onChange={setAssignment} options={[{value:"all",label:"All assignees"},{value:"assigned",label:"Assigned"},{value:"unassigned",label:"Unassigned"}]}/><button onClick={()=>void load()}>Apply filters</button></section>
      {error&&<div className="ops-error" role="alert"><AlertCircle/>{error}</div>}
      <div className="ops-layout"><section className="ops-queue" aria-busy={loading}><table><thead><tr><th>Reference</th><th>Category</th><th>Subject</th><th>Requester</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Updated</th></tr></thead><tbody>{requests.map(item=><tr key={item.requestId} className={selected?.requestId===item.requestId?"selected":""} onClick={()=>void load(item.requestId)}><td><b>{item.requestNumber}</b></td><td>{item.category.replace(/_/g," ")}</td><td>{item.subject}</td><td>{item.requesterEmail||short(item.requesterUserId)}</td><td><Chip value={item.status}/></td><td><Chip value={item.priority}/></td><td>{item.assignedOperatorUserId?short(item.assignedOperatorUserId):"Unassigned"}</td><td>{when(item.updatedAt)}</td></tr>)}</tbody></table>{!loading&&!requests.length&&<div className="ops-empty"><Check/><b>No requests match these filters.</b><p>Clear filters or wait for a new case.</p></div>}{loading&&<div className="ops-loading">Loading request queue…</div>}</section>
        <aside className={`ops-detail${selected?" open":""}`}>{selected?<><header><div><Chip value={selected.status}/><h2>{selected.requestNumber} <button aria-label="Copy request reference" onClick={()=>void navigator.clipboard.writeText(selected.requestNumber)}><Copy/></button></h2><p>{selected.subject}</p></div><div><Chip value={selected.priority}/><button className="ops-detail-close" aria-label="Close request details" onClick={()=>setSelected(null)}><X/></button></div></header>
          <dl className="ops-meta"><div><dt>Created</dt><dd>{when(selected.createdAt)}</dd></div><div><dt>Updated</dt><dd>{when(selected.updatedAt)}</dd></div><div><dt>Category</dt><dd>{selected.category.replace(/_/g," ")}</dd></div></dl>
          <section><h3><UserRound/> Requester</h3><p>{selected.requesterEmail||"Authenticated account"}</p><code>{selected.requesterUserId||"Public intake"}</code></section>
          <section><h3><Link2/> Linked references</h3>{Object.entries(selected.references).filter(([,value])=>value).map(([key,value])=><div className="ops-reference" key={key}><span>{key.replace("Id","")}</span><code>{value}</code><button onClick={()=>void navigator.clipboard.writeText(value!)}><Copy/></button></div>)}{!Object.values(selected.references).some(Boolean)&&<p className="ops-muted">No linked product references.</p>}</section>
          <section><h3><Clock3/> Timeline</h3><div className="ops-timeline">{events.map(item=><article key={item.eventId}><span/><div><b>{item.eventType.replace(/_/g," ")}</b><time>{when(item.createdAt)}</time>{typeof item.data.body==="string"&&<p>{item.data.body}</p>}{typeof item.data.reference==="string"&&<code>{item.data.reference}</code>}</div></article>)}</div></section>
          <section><h3><MessageSquareText/> Add note or response</h3><textarea rows={4} maxLength={5000} value={note} onChange={e=>setNote(e.target.value)} placeholder={visibility==="internal"?"Visible only to operators":"Visible to the requester"}/><div className="ops-inline"><CreatorSelect label="Note visibility" value={visibility} onChange={value=>setVisibility(value as typeof visibility)} options={[{value:"internal",label:"Internal note"},{value:"requester",label:"Requester response"}]}/><button disabled={busy||!note.trim()} onClick={()=>void mutate("note",{body:note,visibility})}>Record</button></div></section>
          <section><h3><Link2/> Record authoritative action</h3><p className="ops-muted">Record only a safe action type and reference after using the authoritative module.</p><input value={actionType} maxLength={100} onChange={e=>setActionType(e.target.value)} placeholder="refund, payout, access review…"/><input value={actionReference} maxLength={200} onChange={e=>setActionReference(e.target.value)} placeholder="Safe operation or provider reference"/><button disabled={busy||!actionType.trim()||!actionReference.trim()} onClick={()=>void mutate("link-action",{actionType,reference:actionReference})}>Link completed action</button></section>
          <div className="ops-authority-note"><AlertCircle/><p>Refunds, payouts, seller approval, listing changes, and role changes must use their authoritative modules and fresh authority where required.</p></div>
          <footer><CreatorSelect label="Assign request" value={selected.assignedOperatorUserId||""} disabled={busy} onChange={value=>void mutate("assign",{operatorUserId:value||null})} options={[{value:"",label:"Unassigned"},...(selected.assignedOperatorUserId&&!operators.some(item=>item.userId===selected.assignedOperatorUserId)?[{value:selected.assignedOperatorUserId,label:`Current · ${short(selected.assignedOperatorUserId)}`}]:[]),...operators.map(item=>({value:item.userId,label:`${item.role} · ${short(item.userId)}`}))]}/><CreatorSelect label="Change priority" value={selected.priority} disabled={busy} onChange={value=>void mutate("priority",{priority:value})} options={priorities.map(value=>({value,label:value}))}/><CreatorSelect label="Change status" value={selected.status} disabled={busy} onChange={value=>void mutate("status",{status:value})} options={statuses.map(value=>({value,label:value}))}/></footer>
        </>:<div className="ops-empty"><MessageSquareText/><b>Select a request</b><p>Case details and append-only history appear here.</p></div>}</aside>
      </div>
    </main>
  </div>
}
