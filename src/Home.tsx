import { useRef, useState, type MouseEvent, type ReactNode } from "react"
import styles from "./landing.module.css"

const routes = { browse: "/browse", projects: "/projects", plans: "/plans", login: "/login", signup: "/signup" }

let landingRouteTimer: number | undefined
function route(event: MouseEvent<HTMLAnchorElement>, href: string) {
  if (!href.startsWith("/") || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  if (landingRouteTimer) window.clearTimeout(landingRouteTimer)
  document.documentElement.classList.add("wcb-route-leaving")
  landingRouteTimer = window.setTimeout(() => {
    window.history.pushState({}, "", href)
    window.dispatchEvent(new PopStateEvent("popstate"))
    window.scrollTo({ top: 0, behavior: "auto" })
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => document.documentElement.classList.remove("wcb-route-leaving")))
    landingRouteTimer = undefined
  }, 120)
}

function AppLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return <a href={href} className={className} onClick={event => route(event, href)}>{children}</a>
}

function Arrow({ left = false }: { left?: boolean }) {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d={left ? "M12.5 4.5 7 10l5.5 5.5M7.5 10H17" : "m7.5 4.5 5.5 5.5-5.5 5.5M3 10h9.5"}/></svg>
}

function Icon({ name }: { name: "source" | "visual" | "history" | "export" }) {
  if (name === "source") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 8-4 4 4 4m8-8 4 4-4 4M14 4l-4 16"/></svg>
  if (name === "visual") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H4zM8 20h8M12 16v4"/></svg>
  if (name === "history") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5M4 4v4.5h4.5M12 8v4l3 2"/></svg>
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 18v3h14v-3"/></svg>
}

const heroPoints = [
  { icon: "source" as const, title: "Working projects", body: "Start with routes, components, styles, and real source." },
  { icon: "visual" as const, title: "Visual + Code + AI", body: "Three ways to work, editing the same files underneath." },
  { icon: "history" as const, title: "Exact history", body: "Every accepted change belongs to a source revision." },
  { icon: "export" as const, title: "Yours to export", body: "Take the complete codebase into your own workflow." },
]

const plans = [
  { name: "Free", monthly: "$0", annual: "$0", note: "For exploring real projects.", features: ["Browse public projects", "Open demos and source details", "One working workspace", "Code export included"] },
  { name: "Pro", monthly: "$19", annual: "$16", note: "For people building regularly.", features: ["Everything in Free", "Unlimited personal workspaces", "Visual + Code editing", "Larger AI allowance"] },
  { name: "Studio", monthly: "$49", annual: "$41", note: "For teams and client work.", features: ["Everything in Pro", "Shared workspaces", "Creator tools as they ship", "Priority support"] },
]

const faqGroups = [
  { title: "Projects and purchases", items: [
    ["Are these templates?", "Listings point to versioned, working source projects. A purchase grants an entitlement to a specific immutable release; it is not a screenshot or an unversioned download."],
    ["What happens after a purchase?", "The entitlement appears in Purchases first. You can then create an editable workspace copy without changing the original release."],
    ["Can a listing change after I purchase?", "Listing copy can change, but a referenced release cannot silently mutate. New source requires a new release identity."],
  ] },
  { title: "Editing and ownership", items: [
    ["Do visual edits change the source?", "Yes. Visual and code editing operate on the same working copy and its source revision history."],
    ["Can I export the project?", "Code export remains part of the product contract. License terms still belong to the specific listing and entitlement."],
  ] },
  { title: "Accounts and workspaces", items: [
    ["Is a purchase the same as a project?", "No. Purchases are entitlements; My Projects contains editable workspace copies. A purchase may exist before you create a copy."],
    ["Can another user open my copy?", "Not by guessing an ID. Sessions, workspace membership, entitlement ownership, and project grants are checked server-side."],
  ] },
]

function Navbar() {
  const [open, setOpen] = useState(false)
  return <header className={styles.navbar}>
    <div className={styles.navInner}>
      <AppLink href="/" className={styles.wordmark}>WebCanBe</AppLink>
      <nav className={styles.desktopNav} aria-label="Main navigation"><a href="#features">Features</a><a href="#marketplace">Marketplace</a><a href="#faq">FAQ</a></nav>
      <div className={styles.navActions}><AppLink href={routes.login}>Log in</AppLink><AppLink href={routes.browse} className={styles.navPrimary}>Browse projects</AppLink></div>
      <button className={styles.menuButton} type="button" aria-expanded={open} aria-label="Toggle navigation" onClick={() => setOpen(value => !value)}><span/><span/></button>
    </div>
    <nav className={`${styles.mobileNav} ${open ? styles.mobileNavOpen : ""}`} aria-label="Mobile navigation"><a href="#features" onClick={() => setOpen(false)}>Features</a><a href="#marketplace" onClick={() => setOpen(false)}>Marketplace</a><a href="#faq" onClick={() => setOpen(false)}>FAQ</a><AppLink href={routes.login}>Log in</AppLink><AppLink href={routes.browse}>Browse projects</AppLink></nav>
  </header>
}

function EditorPreview() {
  const code = ["export default function Hero() {", "  return (", "    <section className=\"hero\">", "      <h1>Make something real.</h1>", "      <ProjectPreview />", "    </section>", "  )", "}"]
  return <div className={styles.editorPreview} aria-label="WebCanBe editor preview">
    <div className={styles.editorTop}><b>WebCanBe</b><span>Northstar Studio</span><div><button>Preview</button><button className={styles.darkButton}>Export</button></div></div>
    <div className={styles.editorBody}>
      <aside className={styles.fileRail}><b>Files</b><span>▾ src</span><span className={styles.fileActive}>⌘ App.tsx</span><span>⌘ Hero.tsx</span><span>⌘ ProjectCard.tsx</span><span># styles.css</span><span>package.json</span></aside>
      <section className={styles.editorMain}><div className={styles.editorTabs}><span>Visual</span><b>Code</b><span>Preview</span></div><div className={styles.code}>{code.map((line, index) => <div key={line + index}><i>{index + 1}</i><code>{line}</code></div>)}</div></section>
      <aside className={styles.aiRail}><b>AI changes</b><div className={styles.aiBubble}>Make the project cards quieter and give the headline more room.</div><p>Updated the working copy.</p><ul><li>ProjectCard.tsx <strong>+18</strong></li><li>styles.css <strong>+12</strong></li></ul><div className={styles.aiInput}>Ask for a change <span>↑</span></div></aside>
    </div>
  </div>
}

function FeatureVisual({ kind }: { kind: "canvas" | "market" | "history" }) {
  if (kind === "canvas") return <div className={`${styles.featureVisual} ${styles.canvasVisual}`}><div className={styles.miniToolbar}>Select&nbsp;&nbsp; Text&nbsp;&nbsp; Frame</div><div className={styles.miniPage}><span>NORTHSTAR</span><h4>Independent design<br/>for useful things.</h4><div/><small>Hero.tsx</small></div></div>
  if (kind === "market") return <div className={`${styles.featureVisual} ${styles.marketVisual}`}><div><small>EDITORIAL</small><b>Fieldnotes</b><span>React · Vite · CSS</span></div><div><small>SAAS</small><b>Relay</b><span>TypeScript · API</span></div></div>
  return <div className={`${styles.featureVisual} ${styles.historyVisual}`}><div><i/><span><b>Immutable release</b><small>v1.0.0 · rev_7f18</small></span></div><div><i/><span><b>Your working copy</b><small>Editable · exact provenance</small></span></div><div><i/><span><b>Your changes</b><small>rev_12bc · now</small></span></div></div>
}

function ProjectProof({ tone, label, title }: { tone: string; label: string; title: string }) {
  return <div className={`${styles.projectProof} ${styles[tone]}`}><header><b>{title}</b><span>Index&nbsp;&nbsp; About&nbsp;&nbsp; Contact</span></header><main><small>{label}</small><h4>{title}<br/>made to be used.</h4><i/></main><footer><span>Working source</span><span>01 — 04</span></footer></div>
}

function Testimonials() {
  const rail = useRef<HTMLDivElement>(null)
  const move = (direction: number) => rail.current?.scrollBy({ left: direction * Math.min(390, window.innerWidth * .8), behavior: "smooth" })
  const items = [
    { art: "source", quote: "The listing identifies a real source revision — not just an image of a finished page.", label: "Marketplace principle" },
    { art: "edit", quote: "Visual, code, and AI changes meet in one working copy with one history.", label: "Editing principle" },
    { art: "own", quote: "A purchase and a project stay separate, so ownership never becomes ambiguous.", label: "Product principle" },
    { art: "export", quote: "The useful outcome is a codebase you can inspect, change, and take with you.", label: "Portability principle" },
  ]
  return <section className={styles.testimonials} data-landing-reveal>
    <div className={styles.container}><h2>Built around what stays true.</h2><p className={styles.sectionCopy}>WebCanBe keeps the project, its source, and its ownership history legible from marketplace release to working copy.</p><AppLink href={routes.browse} className={styles.outlineButton}>Browse the catalog <Arrow/></AppLink></div>
    <div className={styles.testimonialRail} ref={rail}>{items.map(item => <article className={styles.testimonialCard} key={item.label}><div className={`${styles.testimonialArt} ${styles[item.art]}`}><span/><span/><span/></div><blockquote>{item.quote}</blockquote><p>{item.label}</p></article>)}</div>
    <div className={`${styles.container} ${styles.carouselControls}`}><button type="button" aria-label="Previous principles" onClick={() => move(-1)}><Arrow left/></button><button type="button" aria-label="Next principles" onClick={() => move(1)}><Arrow/></button></div>
  </section>
}

function Pricing() {
  const [annual, setAnnual] = useState(true)
  return <section className={styles.pricing} id="pricing" data-landing-reveal><div className={`${styles.container} ${styles.narrow}`}>
    <div className={styles.centerHeading}><h2>Plans for the workspace around your code.</h2><p>Project purchases are separate from workspace plans. Export is never treated as a premium format.</p></div>
    <div className={styles.planGrid}>{plans.map((plan, index) => <article className={index === 1 ? styles.featuredPlan : ""} key={plan.name}><h3>{plan.name}</h3><div className={styles.price}>{annual ? plan.annual : plan.monthly}{plan.name !== "Free" && <small> / month</small>}</div>{plan.name === "Free" ? <span className={styles.billingNote}>{plan.note}</span> : <label className={styles.billingSwitch}><input type="checkbox" checked={annual} onChange={() => setAnnual(value => !value)}/><i/><span>Billed annually</span></label>}<ul>{plan.features.map(feature => <li key={feature}><span>✓</span>{feature}</li>)}</ul><AppLink href={index ? routes.signup : routes.browse} className={index === 1 ? styles.blackButton : styles.outlineButton}>Get started</AppLink></article>)}</div>
  </div></section>
}

function FAQ() {
  return <section className={styles.faq} id="faq" data-landing-reveal><div className={`${styles.container} ${styles.narrow} ${styles.faqGrid}`}><div><h2>Got questions?</h2><p>Start with the product contract: real source, explicit releases, owned working copies, and server-side authority.</p><AppLink href={routes.browse}>Explore projects <Arrow/></AppLink></div><div className={styles.faqGroups}>{faqGroups.map(group => <section key={group.title}><h3>{group.title}</h3>{group.items.map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</section>)}</div></div></section>
}

function Footer() {
  return <footer className={styles.footer} data-landing-reveal><div className={`${styles.container} ${styles.footerCta}`}><h2>Open a real project.</h2><p>Browse the marketplace, create an editable working copy, and keep the source underneath it.</p><AppLink href={routes.browse} className={styles.blackButton}>Browse projects <Arrow/></AppLink></div><nav className={styles.footerNav}><div><AppLink href={routes.browse}>Browse</AppLink><AppLink href={routes.projects}>My projects</AppLink><AppLink href={routes.plans}>Plans</AppLink><AppLink href={routes.login}>Sign in</AppLink></div><small>© 2026 WebCanBe. Real projects, real source.</small></nav><div className={styles.footerWordmark}>WebCanBe</div></footer>
}

export default function Home() {
  return <div className={styles.page}>
    <Navbar/>
    <main>
      <div className={styles.topShell}>
        <section className={`${styles.hero} ${styles.container}`} data-landing-reveal><div className={styles.heroGrid}><div><h1>Start with a real project. Keep the real code.</h1><p>Browse working source-code projects, open an editable copy, and build through Visual, Code, or AI — all on the same files.</p><div className={styles.heroActions}><AppLink href={routes.browse} className={styles.blackButton}>Browse projects <Arrow/></AppLink><a href="#features" className={styles.outlineButton}>See how it works <Arrow/></a></div></div><div className={styles.heroPoints}>{heroPoints.map(point => <div key={point.title}><Icon name={point.icon}/><span><b>{point.title}</b><small>{point.body}</small></span></div>)}</div></div><EditorPreview/></section>
        <section className={`${styles.logos} ${styles.container}`} data-landing-reveal><h2>One source-first workflow, from discovery to export.<br/><span>Built for real projects instead of flattened previews.</span></h2><div className={styles.logoRows}><div>{["React", "Vite", "TypeScript", "Tailwind"].map(item => <span key={item}>{item}</span>)}</div><div>{["Marketplace", "Visual", "Code", "AI", "Export"].map(item => <span key={item}>{item}</span>)}</div></div></section>
        <section className={`${styles.features} ${styles.container}`} id="features" data-landing-reveal><div className={styles.ruleLabel}><span>REAL SOURCE. ONE HISTORY.</span></div><div className={styles.splitHeading}><h2>Made for people who need a real starting point.</h2><p>WebCanBe joins marketplace discovery with a source-first editor. The release you choose stays fixed; the working copy you create is yours to change.</p></div><div className={styles.featureCards}><article id="editing"><FeatureVisual kind="canvas"/><a href="#editing"><h3>Edit the same project visually</h3><Arrow/></a></article><article><FeatureVisual kind="market"/><a href="#marketplace"><h3>Browse projects that already run</h3><Arrow/></a></article><article id="ownership"><FeatureVisual kind="history"/><a href="#ownership"><h3>Keep release and copy lineage exact</h3><Arrow/></a></article></div></section>
        <section className={styles.resource} id="marketplace" data-landing-reveal><h2 className={styles.container}>From immutable release to editable working copy.</h2><div className={styles.resourceGrid}><article className={styles.resourceWide}><div><b>Start from a release.</b> <span>The listing identifies an exact source revision and snapshot.</span></div><ProjectProof tone="proofBlue" label="PORTFOLIO" title="Northstar"/></article><article className={styles.resourceWide}><div><b>Choose how you work.</b> <span>Visual, code, and AI stay attached to the same files.</span></div><div className={styles.modeStack}><span>Visual</span><span>Code</span><span>AI</span><span>Preview</span><span>History</span><span>Export</span></div></article><article><div><b>Keep purchases distinct.</b> <span>An entitlement can exist before a workspace copy does.</span></div><div className={styles.resourceMini}><small>PURCHASES</small><strong>Northstar v1.0</strong><span>Ready to create a project</span></div></article><article><div><b>Edit without rewriting history.</b> <span>The original release stays unchanged as your copy moves on.</span></div><div className={styles.changeList}><span>Hero.tsx <b>+12</b></span><span>styles.css <b>+8</b></span><span>README.md <b>+3</b></span></div></article><article><div><b>Take the source with you.</b> <span>Export the codebase and continue in your own tools.</span></div><div className={styles.exportVisual}>↓<span>northstar-studio.zip<small>Complete source · ready</small></span></div></article></div></section>
      </div>
      <Testimonials/>
      <div className={styles.bottomShell}><Pricing/><FAQ/></div>
    </main>
    <Footer/>
  </div>
}
