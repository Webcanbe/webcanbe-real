import { useEffect, useState } from "react"
import { hostedProductClient, productReadMode, type BuildLeagueProgress } from "./hostedProductClient"
import { analytics } from "./analytics"
import { CreatorSelect } from "./creator-select"
import "./build-league.css"

const bannerKey = "wcb-event-banner-dismissed-v1"

export function BuildLeagueChrome({ path }: { path: string }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(bannerKey) === "yes" } catch { return false }
  })
  const hidden = path === "/" || path === "/event" || path.startsWith("/workspace/") || path.startsWith("/project/") ||
    path === "/__wcb_preview_runtime" || path.startsWith("/_ops/") || path === "/login" || path === "/signup"
  if (hidden || dismissed) return null
  const close = () => {
    setDismissed(true)
    try { localStorage.setItem(bannerKey, "yes") } catch { /* Storage is optional. */ }
    analytics.capture("wcb_build_league_intro_dismissed", { source: "public" })
  }
  return <div className="bl-sticky" role="region" aria-label="Webcanbe event">
    <strong>Webcanbe Event</strong>
    <span>Build something real and share the project you made.</span>
    <a href="/event">View event <span aria-hidden="true">↗</span></a>
    <button type="button" onClick={close} aria-label="Dismiss event banner">×</button>
  </div>
}

export function BuildLeagueEvent() {
  const [progress, setProgress] = useState<BuildLeagueProgress>()
  const [availability, setAvailability] = useState<"loading" | "ready" | "unavailable" | "local">(productReadMode() ? "loading" : "local")
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([])
  const [projectId, setProjectId] = useState("")
  const [statement, setStatement] = useState("")
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    analytics.capture("wcb_build_league_viewed", { source: "public" })
    if (!productReadMode()) return () => { active = false }
    hostedProductClient.buildLeagueState().then(async value => {
      if (!active) return
      setProgress(value)
      setAvailability("ready")
      try {
        const items = await hostedProductClient.sourceProjects()
        if (active) setProjects(items)
      } catch { if (active) setStatus("Your projects could not be loaded. Please try again later.") }
    }).catch(() => { if (active) setAvailability("unavailable") })
    return () => { active = false }
  }, [])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!projectId || busy) return
    setBusy(true)
    setStatus("")
    try {
      const entry = await hostedProductClient.buildLeagueSubmit(projectId, statement)
      setProgress(await hostedProductClient.buildLeagueState())
      setStatus(entry ? "Your project was submitted." : "Submission received.")
      analytics.capture("wcb_build_league_submission_completed", { source: "public" })
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not submit your project.")
    } finally { setBusy(false) }
  }

  return <main className="bl-page">
    <section className="bl-hero">
      <div className="bl-hero-copy">
        <small>WEBCANBE EVENT</small>
        <h1>Build something real.</h1>
        <p>Start with a Webcanbe project, make it your own, and share the finished work. The event is about the project you create and the source you save.</p>
        <a className="bl-button" href="/browse">Explore projects <span aria-hidden="true">↗</span></a>
      </div>
      <div className="bl-hero-art"><img src="/build-league/campaign.webp" alt="Architectural event artwork"/></div>
    </section>

    <section className="bl-section bl-how" aria-labelledby="bl-how-title">
      <div className="bl-section-heading"><small>HOW TO TAKE PART</small><h2 id="bl-how-title">Make it yours.</h2><p>Use the same source workflow as any other Webcanbe project.</p></div>
      <ol>
        <li><span>01</span><div><h3>Choose a starting point</h3><p>Browse a project and create your own editable working copy.</p></div></li>
        <li><span>02</span><div><h3>Build and save</h3><p>Change the real project source in Visual or Code, then save your work.</p></div></li>
        <li><span>03</span><div><h3>Submit your project</h3><p>Choose the project you built and briefly explain what you changed.</p></div></li>
      </ol>
    </section>

    <section className="bl-section bl-entry" id="submit-project" aria-labelledby="bl-entry-title">
      <div className="bl-section-heading"><small>PROJECT SUBMISSION</small><h2 id="bl-entry-title">Show what you made.</h2><p>Select a project you own with at least one saved source change, and tell us about your work.</p></div>
      {availability === "loading" && <p role="status">Checking event availability…</p>}
      {availability === "local" && <div className="bl-entry-message"><p>Project submissions require the hosted Webcanbe service. You can explore projects in this local preview.</p><a href="/browse">Explore projects <span aria-hidden="true">↗</span></a></div>}
      {availability === "unavailable" && <div className="bl-entry-message"><p>Sign in to submit your project. If you are already signed in, the event service may be unavailable.</p><a href="/login?next=%2Fevent">Sign in <span aria-hidden="true">↗</span></a></div>}
      {availability === "ready" && (progress?.entry
        ? <div className="bl-entry-message" role="status"><strong>Project submitted.</strong><p>Your submission is recorded. Keep the project available for review.</p></div>
        : <form onSubmit={submit}>
          <CreatorSelect label="Project" value={projectId} options={[{ value: "", label: "Select a project" }, ...projects.map(item => ({ value: item.id, label: item.name }))]} onChange={setProjectId} disabled={busy}/>
          <label>What did you build?<textarea required minLength={20} maxLength={1000} value={statement} onChange={event => setStatement(event.target.value)} placeholder="Describe the changes you made to the project."/></label>
          <button className="bl-button" disabled={busy || !projectId || statement.trim().length < 20}>{busy ? "Submitting…" : "Submit project ↗"}</button>
          <p role="status">{status}</p>
        </form>)}
    </section>

    <section className="bl-section bl-rules" aria-labelledby="bl-rules-title">
      <div className="bl-section-heading"><small>EVENT DETAILS</small><h2 id="bl-rules-title">A few useful details.</h2></div>
      <details><summary>What can I submit?</summary><p>Submit a project in your workspace after saving at least one real source change. The submission must describe the work you made.</p></details>
      <details><summary>Can I keep editing after submitting?</summary><p>Yes. Keep your project available so the saved source can be reviewed.</p></details>
      <details><summary>Where can I start?</summary><p>Browse the marketplace or open a first-party project, then create your own working copy.</p></details>
    </section>
  </main>
}
