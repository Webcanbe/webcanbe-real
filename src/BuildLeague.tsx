import { useEffect, useState } from "react"
import { hostedProductClient, type BuildLeagueLeader, type BuildLeagueProgress } from "./hostedProductClient"
import { analytics } from "./analytics"
import "./build-league.css"

export const BUILD_LEAGUE_STAGES = [
  { number:1, threshold:0, mask:"may.cx", name:"The opening", note:"The headline reward, revealed from day one." },
  { number:2, threshold:30, mask:"xx.xx", name:"The next horizon", note:"A short name with room to become a brand." },
  { number:3, threshold:80, mask:"•••.xx", name:"Everyday language", note:"A three letter, everyday word." },
  { number:4, threshold:160, mask:"x.••••", name:"One character", note:"A single character before the dot." },
  { number:5, threshold:280, mask:"xxx.xx", name:"A rarer form", note:"Three characters. Two after the dot." },
  { number:6, threshold:420, mask:"x.????", name:"The final reveal", note:"The last reward remains under wraps." },
] as const

const label:Record<string,string> = {
  project_opened:"Opened a project", preview_opened:"Opened a preview", working_copy_created:"Created a working copy", text_edited:"Edited text", style_edited:"Edited a style", layout_edited:"Edited layout",
  visual_opened:"Used Visual", code_opened:"Used Code", split_opened:"Used Split", history_opened:"Opened History",
  first_element_selected:"Selected a first element", source_saved:"Saved source", ai_panel_opened:"Opened AI",
  ai_proposal_created:"Generated an AI proposal", ai_proposal_reviewed:"Reviewed an AI proposal", ai_edit_applied:"Applied an AI edit",
  mobile_preview_used:"Used mobile preview", tablet_preview_used:"Used tablet preview", export_started:"Started an export",
  export_completed:"Exported source", share_created:"Shared a build", referred_signup:"Referred signup",
  referred_project_opened:"Referred builder opened a project", referred_first_save:"Referred builder saved source",
  referred_ai_edit:"Referred builder applied AI", referred_stage_3:"Referred builder reached Stage 3",
  referred_final_submission:"Referred builder submitted", submission_started:"Started a submission", final_submission:"Submitted a final entry",
}
const count=(p:BuildLeagueProgress|undefined,key:string)=>p?.counts[key]??0
const displayCount=(p:BuildLeagueProgress|undefined,key:string)=>p?count(p,key):"—"
const nextAction=(p?:BuildLeagueProgress)=>!p?"Start your first project":count(p,"working_copy_created")===0?"Create a working copy":count(p,"source_saved")===0?"Save a real edit":count(p,"ai_edit_applied")===0?"Apply an AI edit":count(p,"ai_edit_applied")<3?"Apply AI to another section":count(p,"export_completed")===0?"Export your source":!p.entry?"Submit your build":"Invite another builder"
const nextHref=(p?:BuildLeagueProgress)=>!p||count(p,"working_copy_created")===0?"/marketplace":count(p,"source_saved")===0||count(p,"ai_edit_applied")<3||count(p,"export_completed")===0?"/projects":p.entry?"#social-impact":"#final-entry"

function CampaignImage({className=""}:{className?:string}) {
  const [available,setAvailable]=useState(true)
  return <div className={"bl-art "+className}>{available?<img src="/build-league/campaign.webp" alt="BUILD LEAGUE campaign artwork" onError={()=>setAvailable(false)}/>:<div className="bl-art-fallback" aria-label="BUILD LEAGUE artwork pending"><span>BUILD<br/>LEAGUE</span><small>STAGE 01 / 06</small></div>}</div>
}

export function BuildLeagueChrome({path}:{path:string}) {
  const [dismissed,setDismissed]=useState(()=>{try{return localStorage.getItem("wcb-build-league-intro-v1")==="closed"}catch{return false}})
  const [progress,setProgress]=useState<BuildLeagueProgress>()
  const hidden=path.startsWith("/workspace/")||path==="/__wcb_preview_runtime"||path.startsWith("/_ops/")||path==="/login"||path==="/signup"
  useEffect(()=>{if(hidden)return;let active=true;hostedProductClient.buildLeagueState().then(value=>{if(active)setProgress(value)}).catch(()=>{});return()=>{active=false}},[hidden,path])
  if(hidden)return null
  const close=()=>{setDismissed(true);try{localStorage.setItem("wcb-build-league-intro-v1","closed")}catch{};analytics.capture("wcb_build_league_intro_dismissed",{source:"public"})}
  return <>
    {dismissed?<div className="bl-sticky" role="region" aria-label="Build League campaign"><div><strong>BUILD LEAGUE</strong><span>Stage {progress?.stage??1} · Build something real</span><span>{progress?`${progress.points} pts · ${nextAction(progress)}`:"Grand reward: may.cx"}</span></div><a href="/event">View <span aria-hidden="true">↗</span></a></div>:<div className="bl-modal-backdrop"><section className="bl-modal" role="dialog" aria-modal="true" aria-labelledby="bl-intro-title"><button className="bl-modal-close" type="button" onClick={close} aria-label="Close campaign introduction">×</button><div className="bl-modal-copy"><small>BUILD LEAGUE — STAGE 1</small><h2 id="bl-intro-title">Build something real.</h2></div><CampaignImage className="bl-modal-art"/><div className="bl-modal-footer"><p>Complete actions. Earn pts.<br/><strong>Grand reward: may.cx</strong></p><a className="bl-button" href="/event" onClick={close}>Start Building <span aria-hidden="true">↗</span></a></div></section></div>}
  </>
}

export function BuildLeagueEvent() {
  const [progress,setProgress]=useState<BuildLeagueProgress>()
  const [leaders,setLeaders]=useState<BuildLeagueLeader[]>([])
  const [weights,setWeights]=useState({build:40,social:40,completion:20})
  const [projects,setProjects]=useState<Array<{id:string;name:string}>>([])
  const [projectId,setProjectId]=useState("")
  const [statement,setStatement]=useState("")
  const [status,setStatus]=useState("")
  const [busy,setBusy]=useState(false)
  const [copied,setCopied]=useState(false)
  const [live,setLive]=useState(false)
  useEffect(()=>{
    let active=true
    analytics.capture("wcb_build_league_viewed",{source:"public"})
    const referral=new URLSearchParams(location.search).get("ref")
    if(referral&&/^[a-z0-9]{12}$/.test(referral)) void hostedProductClient.buildLeagueVisit(referral).then(ok=>{if(ok)analytics.capture("wcb_build_league_referral_visit",{source:"public"})})
    hostedProductClient.buildLeagueLeaderboard().then(value=>{if(active){setLeaders(value.leaders);setWeights(value.weights);setLive(true)}}).catch(()=>{})
    hostedProductClient.buildLeagueState().then(value=>{if(active){setProgress(value);void hostedProductClient.sourceProjects().then(items=>{if(active)setProjects(items)}).catch(()=>{})}}).catch(()=>{})
    return()=>{active=false}
  },[])
  const shareUrl=progress?`${location.origin}/event?ref=${progress.referralCode}`:""
  const share=async()=>{
    if(!shareUrl)return
    try {await navigator.clipboard.writeText(shareUrl);setCopied(true);analytics.capture("wcb_build_league_share_created",{source:"public"});void hostedProductClient.buildLeagueTrack("share_created",crypto.randomUUID())}
    catch{setStatus("Copy the link from the field below.")}
  }
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();if(!projectId||busy)return
    setBusy(true);setStatus("")
    try {const entry=await hostedProductClient.buildLeagueSubmit(projectId,statement);setProgress(await hostedProductClient.buildLeagueState());setStatus(entry?"Your final entry is submitted.":"Submission received.");analytics.capture("wcb_build_league_submission_completed",{source:"public"})}
    catch(error){setStatus(error instanceof Error?error.message:"Could not submit your entry.")}
    finally{setBusy(false)}
  }
  return <main className="bl-page">
    <section className="bl-hero"><div className="bl-hero-copy"><small>WEB CAN BE / BUILD LEAGUE / STAGE 1</small><h1>Build something<br/><em>real.</em></h1><p>A creative build campaign for people who turn a starting point into something of their own. Make, refine, share, and submit the work.</p><div className="bl-hero-actions"><a className="bl-button" href={progress?nextHref(progress):"/signup?next=%2Fevent"}>{progress?nextAction(progress):"Join the build"} <span aria-hidden="true">↗</span></a><span>Six stages. Three major winners.</span></div></div><CampaignImage className="bl-hero-art"/><div className="bl-hero-reward"><span>GRAND REWARD</span><strong>may.cx</strong><small>Stage 1 is open.</small></div></section>

    <section className="bl-section bl-progress" aria-labelledby="bl-progress-title"><div className="bl-section-heading"><small>01 / YOUR MOMENTUM</small><h2 id="bl-progress-title">The work adds up.</h2></div>{progress?<div className="bl-progress-grid"><div className="bl-progress-main"><span>CURRENT MOMENTUM</span><strong>{progress.actions} actions completed</strong><p>Stage {progress.stage} of 6 · {progress.points} pts</p><div className="bl-metrics"><div><b>{count(progress,"ai_edit_applied")}</b><span>AI edits applied</span></div><div><b>{count(progress,"working_copy_created")}</b><span>Projects started</span></div><div><b>{count(progress,"export_completed")}</b><span>Exports</span></div><div><b>{count(progress,"referred_first_save")}</b><span>Activated referrals</span></div><div><b>{progress.entry?1:0}</b><span>Final entries</span></div></div>{progress.milestones.length>0&&<p className="bl-milestones"><b>MILESTONES</b> {progress.milestones.join(" · ")}</p>}</div><div className="bl-progress-side"><span>RECENT ACTIVITY</span>{progress.recent.length?<ul>{progress.recent.slice(0,3).map((item,index)=><li key={index}><span>✓</span>{label[item.kind]??item.kind.replace(/_/g," ")}</li>)}</ul>:<p>Your first project action will appear here.</p>}<span className="bl-next-label">NEXT</span><a href={nextHref(progress)}>{nextAction(progress)} <span aria-hidden="true">↗</span></a></div></div>:<div className="bl-progress-guest"><p>Sign in to see your actual stage, points, recent actions, and next step.</p><a href="/login?next=%2Fevent">See my progress ↗</a></div>}</section>

    <section className="bl-section" aria-labelledby="bl-stages-title"><div className="bl-section-heading"><small>02 / THE SIX STAGES</small><h2 id="bl-stages-title">A reward worth building toward.</h2><p>Every stage is visible now. Later domain names stay masked until their public reveal.</p></div><div className="bl-stage-grid">{BUILD_LEAGUE_STAGES.map(stage=><article className={"bl-stage bl-stage-"+stage.number} key={stage.number}><div className="bl-stage-top"><span>STAGE {String(stage.number).padStart(2,"0")}</span><span>{stage.number===1?"OPEN":progress&&progress.stage>=stage.number?"REACHED":"AHEAD"}</span></div><strong>{stage.mask}</strong><div><h3>{stage.name}</h3><p>{stage.note}</p></div></article>)}</div><p className="bl-stage-note">Stage access records progress; it does not assign a domain or determine a winner.</p></section>

    <section className="bl-social" id="social-impact" aria-labelledby="bl-social-title"><div><small>03 / SOCIAL IMPACT</small><h2 id="bl-social-title">Bring the next<br/>builder in.</h2><p>Sharing starts the conversation. The meaningful signal is what people you bring in go on to build, save, improve, and submit.</p>{progress?<><button className="bl-button bl-button-light" type="button" onClick={()=>void share()}>{copied?"Link copied":"Copy your invitation link"} <span aria-hidden="true">↗</span></button><input aria-label="Your referral link" readOnly value={shareUrl} onFocus={e=>e.target.select()}/></>:<a className="bl-button bl-button-light" href="/signup?next=%2Fevent">Get your invitation link ↗</a>}</div><div className="bl-social-stats"><div><b>{displayCount(progress,"share_created")}</b><span>Shares</span></div><div><b>{progress?.uniqueReferredVisits??"—"}</b><span>Unique referred visits</span></div><div><b>{displayCount(progress,"referred_signup")}</b><span>Referred signups</span></div><div><b>{displayCount(progress,"referred_first_save")}</b><span>Activated referrals</span></div><div><b>{displayCount(progress,"referred_first_save")}</b><span>Referral first saves</span></div><div><b>{displayCount(progress,"referred_ai_edit")}</b><span>Referral AI edits</span></div><div><b>{displayCount(progress,"referred_stage_3")}</b><span>Referral Stage 3+</span></div><div><b>{displayCount(progress,"referred_final_submission")}</b><span>Referral final entries</span></div></div></section>

    <section className="bl-section bl-winners"><div className="bl-section-heading"><small>04 / THREE MAJOR WINNERS</small><h2>Three ways to stand out.</h2><p>Build, Social, and Completion each shape the final review. The public leaderboard is a momentum signal; it does not award a domain automatically.</p></div><div className="bl-winner-grid"><article><span>01 / BUILD</span><strong>{weights.build}%</strong><h3>Make the work matter.</h3><p>Accepted edits, real AI applications, a finished source export, and the quality of the finished build.</p></article><article><span>02 / SOCIAL</span><strong>{weights.social}%</strong><h3>Move others to build.</h3><p>Activated referrals count more than visits. Their saves, applied AI edits, Stage 3 progress, and entries matter.</p></article><article><span>03 / COMPLETION</span><strong>{weights.completion}%</strong><h3>Bring it home.</h3><p>Submit a finished project with a clear account of what you built and changed.</p></article></div><p className="bl-winner-note">Three major winners are selected across these dimensions after review. Reward assignment and eligibility remain subject to the published campaign rules.</p></section>

    <section className="bl-section bl-leaderboard"><div className="bl-section-heading"><small>05 / LIVE MOMENTUM</small><h2>Builders in motion.</h2><p>Scores are based on recorded product activity. They are not final judging results.</p></div>{live&&leaders.length?<ol>{leaders.map((person,index)=><li key={person.label}><span>{String(index+1).padStart(2,"0")}</span><strong>{person.label}</strong><small>Build {person.build} · Social {person.social} · Completion {person.completion}</small><b>{person.score}</b></li>)}</ol>:<div className="bl-leaderboard-empty">{live?"No builders are ranked yet. The first real actions will appear here.":"Live ranking is temporarily unavailable."}</div>}</section>

    <section className="bl-section bl-entry" id="final-entry"><div className="bl-section-heading"><small>06 / FINAL ENTRY</small><h2>Show what you made.</h2><p>Choose a project you own, save at least one real source change, and tell us what you built.</p></div>{progress?.entry?<div className="bl-entry-complete"><strong>Entry submitted.</strong><p>Your build is in the final review pool. Keep the project available for review.</p></div>:progress?<form onSubmit={submit}><label>Project<select required value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">Select a project</option>{projects.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>What did you build?<textarea required minLength={20} maxLength={1000} value={statement} onFocus={()=>void hostedProductClient.buildLeagueTrack("submission_started",`submission:${projectId||"unselected"}`).catch(()=>{})} onChange={e=>setStatement(e.target.value)} placeholder="Describe the real changes you made, and what you want the finished work to do."/></label><button className="bl-button" disabled={busy||!projectId||statement.trim().length<20}>{busy?"Submitting…":"Submit final entry ↗"}</button><p role="status">{status}</p></form>:<a className="bl-button" href="/login?next=%2Fevent">Sign in to submit ↗</a>}</section>

    <section className="bl-section bl-rules"><div className="bl-section-heading"><small>07 / RULES & FAQ</small><h2>The essential details.</h2></div><div><details><summary>What earns points?</summary><p>Only recorded, successful Webcanbe actions can earn points. Opening a panel or repeatedly clicking a link does not. Applied AI edits count; opening AI or generating a proposal alone does not.</p></details><details><summary>How do referrals work?</summary><p>Each participant gets a share link. Unique visits are recorded once per visitor. A signup counts only when a new account follows a valid referral. Downstream project work is weighted more strongly.</p></details><details><summary>Does reaching Stage 6 win the top domain?</summary><p>No. Stages show campaign progress. Three major winners are selected after review using Build, Social, and Completion. The leaderboard is informative, not an automatic prize assignment.</p></details><details><summary>When are winners announced?</summary><p>The closing date, eligibility terms, and winner announcement will be published in the final campaign rules before entries are judged.</p></details></div></section>
    <section className="bl-final"><small>BUILD LEAGUE / STAGE 1</small><h2>Start with a real build.<br/>See where it goes.</h2><a className="bl-button bl-button-light" href={progress?nextHref(progress):"/signup?next=%2Fevent"}>{progress?nextAction(progress):"Start building"} ↗</a></section>
  </main>
}
