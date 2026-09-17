import { useState, type MouseEvent, type ReactNode } from "react"
import styles from "./landing.module.css"

const routes = { browse: "/browse", login: "/login", signup: "/signup" }

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

function SimpleIcon({ name }: { name: "source" | "visual" | "history" | "export" }) {
  if (name === "source") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 8-4 4 4 4m8-8 4 4-4 4M14 4l-4 16"/></svg>
  if (name === "visual") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H4zM8 20h8M12 16v4"/></svg>
  if (name === "history") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5M4 4v4.5h4.5M12 8v4l3 2"/></svg>
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 18v3h14v-3"/></svg>
}

function DashedLine({ vertical = false, className = "" }: { vertical?: boolean; className?: string }) {
  return <span aria-hidden="true" className={`${vertical ? styles.dashedVertical : styles.dashedHorizontal} ${className}`}/>
}

const heroPoints = [
  { icon: "source" as const, title: "Real source underneath", body: "Every visual change belongs to the same project files you can open and export." },
  { icon: "visual" as const, title: "Visual + Code", body: "Work visually or directly in code without splitting the project into two truths." },
  { icon: "history" as const, title: "Revision-aware", body: "Working copies keep their source lineage and accepted change history attached." },
  { icon: "export" as const, title: "Code you keep", body: "Take the project with you instead of rebuilding it around a proprietary canvas." },
]

const featureCards = [
  { title: "Start from a complete working project", image: "/mainline/features/triage-card.svg" },
  { title: "Edit the same project visually and in code", image: "/mainline/features/cycle-card.svg" },
  { title: "Keep ownership, history, and portability", image: "/mainline/features/overview-card.svg" },
]

const logoRows = [
  [
    { name: "Mercury", src: "/mainline/logos/mercury.svg" },
    { name: "Watershed", src: "/mainline/logos/watershed.svg" },
    { name: "Retool", src: "/mainline/logos/retool.svg" },
    { name: "Descript", src: "/mainline/logos/descript.svg" },
  ],
  [
    { name: "Perplexity", src: "/mainline/logos/perplexity.svg" },
    { name: "Monzo", src: "/mainline/logos/monzo.svg" },
    { name: "Ramp", src: "/mainline/logos/ramp.svg" },
    { name: "Raycast", src: "/mainline/logos/raycast.svg" },
    { name: "Arc", src: "/mainline/logos/arc.svg" },
  ],
]

const testimonialCards = [
  { quote: "Start with a real codebase instead of recreating the design after you buy it.", role: "For founders", image: "/mainline/testimonials/amy-chase.webp" },
  { quote: "Move between the canvas and source without handing the project to a second editor model.", role: "For developers", image: "/mainline/testimonials/jonas-kotara.webp" },
  { quote: "Use one working copy for visual iteration, code review, export, and handoff.", role: "For studios", image: "/mainline/testimonials/kevin-yam.webp" },
  { quote: "Buy a project, make it yours, and leave with the code when you are done.", role: "For independent builders", image: "/mainline/testimonials/kundo-marta.webp" },
]

const plans = [
  { name: "Free", monthly: "$0", annual: "$0", description: "Explore public projects and the product flow.", features: ["Public marketplace", "Project detail and demos", "One working workspace", "Code export"] },
  { name: "Pro", monthly: "$19", annual: "$16", description: "For one person building regularly.", features: ["Everything in Free", "Unlimited personal workspaces", "Visual + Code editing", "Larger AI allowance in Phase 5"] },
  { name: "Studio", monthly: "$49", annual: "$41", description: "For client work and shared projects.", features: ["Everything in Pro", "Shared workspaces", "Creator tools", "Priority support"] },
]

const faqGroups = [
  { title: "Projects", items: [
    ["Are these just design templates?", "No. Marketplace listings are intended to point to working, versioned source projects rather than flattened screenshots or proprietary canvas documents."],
    ["What happens when I buy one?", "After payment is confirmed, the purchase becomes a release-bound entitlement. From there you can create an editable working copy."],
    ["Can the seller silently replace what I bought?", "No. A purchase stays bound to its immutable release identity. A changed source requires a new release."],
  ] },
  { title: "Editing", items: [
    ["Do visual edits change the actual source?", "Yes. Visual and code editing are designed to act on the same working copy and revision history."],
    ["Can I export the code?", "Code export is part of the product contract. The project should remain usable outside WebCanBe."],
  ] },
  { title: "Accounts", items: [
    ["Is a purchase the same as My Projects?", "No. Purchases are entitlements. My Projects contains editable working copies created from those entitlements."],
    ["Does WebCanBe expose private projects publicly?", "No. Private app routes and project operations remain behind the hosted session and authority boundaries."],
  ] },
]

function Navbar() {
  const [open, setOpen] = useState(false)
  const [featureOpen, setFeatureOpen] = useState(false)
  return <header className={styles.navbar}>
    <div className={styles.navInner}>
      <AppLink href="/" className={styles.wordmark}>WebCanBe</AppLink>
      <nav className={styles.desktopNav} aria-label="Main navigation">
        <button type="button" onClick={() => setFeatureOpen(value => !value)} className={styles.navDropButton}>Features <span>⌄</span></button>
        <a href="#about">About</a><a href="#faq">FAQ</a><a href="#contact">Contact</a>
        {featureOpen && <div className={styles.featureMenu}><a href="#features" onClick={() => setFeatureOpen(false)}><b>Source-first editing</b><span>Visual and code editing stay attached to the same project.</span></a><a href="#resource-allocation" onClick={() => setFeatureOpen(false)}><b>Working project flow</b><span>Purchase, copy, edit, export, and deploy without canvas lock-in.</span></a></div>}
      </nav>
      <div className={styles.navActions}>
        <button className={styles.themeDot} type="button" aria-label="Light theme"><span/></button>
        <AppLink href={routes.login} className={styles.loginButton}>Login</AppLink>
        <button className={styles.iconButton} type="button" aria-label="Open menu" onClick={() => setOpen(value => !value)}>↗</button>
      </div>
      <button className={styles.menuButton} type="button" aria-expanded={open} aria-label="Toggle navigation" onClick={() => setOpen(value => !value)}><span/><span/><span/></button>
    </div>
    <div className={`${styles.mobileMenu} ${open ? styles.mobileMenuOpen : ""}`}>
      <a href="#features" onClick={() => setOpen(false)}>Features</a><a href="#about" onClick={() => setOpen(false)}>About</a><a href="#faq" onClick={() => setOpen(false)}>FAQ</a><a href="#contact" onClick={() => setOpen(false)}>Contact</a><AppLink href={routes.login}>Login</AppLink>
    </div>
  </header>
}

function EditorPreview() {
  return <div className={styles.editorPreview} aria-label="Mainline landing preview asset"><img src="/mainline/hero.webp" alt="Product interface preview"/></div>
}

function Hero() {
  return <section className={styles.hero}>
    <div className={styles.container}>
      <div className={styles.heroGrid}>
        <div className={styles.heroCopy}>
          <h1>Real websites.<br/>Real code you keep.</h1>
          <p>Browse working web projects, buy the release you want, then edit the actual source visually or directly in code.</p>
          <div className={styles.heroActions}><AppLink href={routes.browse} className={styles.primaryButton}>Browse projects</AppLink><a href="#features" className={styles.outlineButton}>See how it works <Arrow/></a></div>
        </div>
        <div className={styles.heroPoints}>
          <DashedLine vertical className={styles.heroDivider}/>
          {heroPoints.map(point => <div className={styles.heroPoint} key={point.title}><SimpleIcon name={point.icon}/><div><h2>{point.title}</h2><p>{point.body}</p></div></div>)}
        </div>
      </div>
    </div>
    <div className={styles.heroPreviewWrap}><EditorPreview/></div>
  </section>
}

function Logos() {
  return <section className={styles.logos}>
    <div className={styles.container}>
      <h2>Built for the way modern web work already happens.<span> Start from real source and keep the workflow familiar.</span></h2>
      <div className={styles.logoRows}>{logoRows.map((row, index) => <div className={styles.logoRow} key={index}>{row.map(logo => <span className={styles.logoMark} key={logo.name}><img src={logo.src} alt={logo.name}/></span>)}</div>)}</div>
    </div>
  </section>
}

function Features() {
  return <section id="features" className={styles.features}>
    <div className={styles.container}>
      <div className={styles.dashedLabel}><DashedLine/><span>THE SOURCE IS THE PRODUCT.</span></div>
      <div className={styles.featureIntro}><h2>Made for people who want the site and the code.</h2><p>WebCanBe keeps the visual workspace attached to a real source project, so the starting point, edits, history, export, and handoff remain one system.</p></div>
      <div className={styles.featureCardRow}>{featureCards.map((card, index) => <article className={styles.featureCard} key={card.title}><div className={styles.featureImage}><img src={card.image} alt=""/></div><div className={styles.featureCardTitle}><h3>{card.title}</h3><span>›</span></div>{index < featureCards.length - 1 && <DashedLine vertical className={styles.cardDivider}/>}</article>)}</div>
    </div>
  </section>
}

function ResourceAllocation() {
  const appTiles = [
    { name: "Jira", src: "/mainline/logos/jira.svg" },
    { name: "Excel", src: "/mainline/logos/excel.svg" },
    { name: "Notion", src: "/mainline/logos/notion.svg" },
    { name: "Word", src: "/mainline/logos/word.svg" },
    { name: "Monday", src: "/mainline/logos/monday.svg" },
    { name: "Drive", src: "/mainline/logos/drive.svg" },
    { name: "Jira", src: "/mainline/logos/jira.svg" },
    { name: "Asana", src: "/mainline/logos/asana.svg" },
  ]
  return <section id="resource-allocation" className={styles.resource}>
    <h2 className={styles.resourceTitle}>From marketplace release to a source-backed working copy</h2>
    <div className={styles.resourceLines}><DashedLine/></div>
    <div className={`${styles.container} ${styles.resourceGrid}`}>
      <article className={`${styles.resourceItem} ${styles.resourceTopWide}`}><div><h3>Start from something real.</h3><p>Marketplace projects carry an immutable release identity instead of becoming an untracked download.</p></div><img src="/mainline/resource-allocation/templates.webp" alt=""/></article>
      <article className={styles.resourceItem}><div><h3>Keep the stack familiar.</h3><p>WebCanBe should fit normal web development rather than replacing it.</p></div><div className={styles.appTiles}>{appTiles.map((app, index) => <span key={`${app.name}-${index}`}><img src={app.src} alt={app.name}/></span>)}</div></article>
    </div>
    <div className={styles.resourceLines}><DashedLine/></div>
    <div className={`${styles.container} ${styles.resourceGridBottom}`}>
      <article className={styles.resourceItem}><div><h3>Release stays frozen.</h3><p>The purchased source snapshot cannot silently change underneath you.</p></div><img src="/mainline/resource-allocation/graveyard.webp" alt=""/></article>
      <article className={styles.resourceItem}><div><h3>Changes stay reviewable.</h3><p>Visual and code work belong to the same source revision flow.</p></div><img className={styles.resourceDiscussion} src="/mainline/resource-allocation/discussions.webp" alt=""/></article>
      <article className={styles.resourceItem}><div><h3>State stays visible.</h3><p>Purchases, working copies, revisions, and Ready evidence remain distinct.</p></div><img src="/mainline/resource-allocation/notifications.webp" alt=""/></article>
    </div>
    <div className={styles.resourceLines}><DashedLine/></div>
  </section>
}

function Testimonials() {
  const [page, setPage] = useState(0)
  return <section id="about" className={styles.testimonials}>
    <div className={styles.container}>
      <div className={styles.testimonialIntro}><h2>Built around a simpler ownership model</h2><p>Use the marketplace as a starting point, not a lock-in point. The project should still make sense when WebCanBe is not in the room.</p><AppLink href={routes.browse} className={styles.storyButton}>Browse the marketplace <Arrow/></AppLink></div>
      <div className={styles.testimonialViewport}><div className={styles.testimonialTrack} style={{ transform: `translateX(-${page * 25}%)` }}>{testimonialCards.concat(testimonialCards).map((card, index) => <article className={styles.testimonialCard} key={`${card.role}-${index}`}><img src={card.image} alt=""/><div><blockquote>{card.quote}</blockquote><footer><strong>{card.role}</strong><span>WebCanBe use case</span></footer></div></article>)}</div></div>
      <div className={styles.carouselButtons}><button type="button" onClick={() => setPage(value => Math.max(0, value - 1))} aria-label="Previous"><Arrow left/></button><button type="button" onClick={() => setPage(value => Math.min(4, value + 1))} aria-label="Next"><Arrow/></button></div>
    </div>
    <DashedLine className={styles.testimonialLine}/>
  </section>
}

function Pricing() {
  const [annual, setAnnual] = useState(true)
  return <section id="pricing" className={styles.pricing}>
    <div className={`${styles.container} ${styles.narrow}`}>
      <div className={styles.centerIntro}><h2>Workspace plans</h2><p>Code ownership is not a premium feature. Paid billing is still a Phase 5 integration; these cards are the current product-plan direction, not a live checkout claim.</p></div>
      <div className={styles.pricingGrid}>{plans.map(plan => <article className={`${styles.planCard} ${plan.name === "Pro" ? styles.featuredPlan : ""}`} key={plan.name}><div><h3>{plan.name}</h3><p className={styles.price}>{annual ? plan.annual : plan.monthly}{plan.name !== "Free" && <span> / month</span>}</p></div>{plan.name !== "Free" ? <button type="button" className={styles.billingToggle} onClick={() => setAnnual(value => !value)}><span className={annual ? styles.toggleOn : ""}/><b>Billed annually</b></button> : <p className={styles.planNote}>{plan.description}</p>}<ul>{plan.features.map(feature => <li key={feature}>✓ <span>{feature}</span></li>)}</ul><AppLink href={plan.name === "Free" ? routes.browse : routes.signup} className={plan.name === "Pro" ? styles.primaryButton : styles.outlineButton}>Get started</AppLink></article>)}</div>
    </div>
  </section>
}

function FAQ() {
  const [open, setOpen] = useState<string | null>(null)
  return <section id="faq" className={styles.faq}>
    <div className={`${styles.container} ${styles.narrow} ${styles.faqGrid}`}>
      <div><h2>Got Questions?</h2><p>If the answer is not here, use the product flow first and keep the implementation claims tied to what is actually live.</p></div>
      <div>{faqGroups.map(group => <section className={styles.faqGroup} key={group.title}><h3>{group.title}</h3>{group.items.map(([question, answer], index) => { const id = `${group.title}-${index}`; const active = open === id; return <div className={styles.faqItem} key={question}><button type="button" onClick={() => setOpen(active ? null : id)} aria-expanded={active}><span>{question}</span><b>{active ? "−" : "+"}</b></button>{active && <p>{answer}</p>}</div> })}</section>)}</div>
    </div>
  </section>
}

function Footer() {
  return <footer id="contact" className={styles.footer}>
    <div className={`${styles.container} ${styles.footerCta}`}><h2>Start from a project you can actually keep.</h2><p>Browse real working releases, make a working copy, and build on the same source.</p><AppLink href={routes.browse} className={styles.primaryButton}>Browse projects</AppLink></div>
    <nav className={styles.footerNav}><div><a href="#features">Product</a><a href="#about">About</a><a href="#faq">FAQ</a><AppLink href={routes.login}>Login</AppLink></div><div><span>© 2026 WebCanBe</span></div></nav>
    <div className={styles.footerWordmark}>webcanbe</div>
  </footer>
}

export default function Home() {
  return <div className={styles.page}>
    <Navbar/>
    <main>
      <div className={styles.topShell}><Hero/><Logos/><Features/><ResourceAllocation/></div>
      <Testimonials/>
      <div className={styles.bottomShell}><Pricing/><FAQ/></div>
    </main>
    <Footer/>
  </div>
}
