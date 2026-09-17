import { useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react"
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

function Chevron() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 6 6-6 6"/></svg>
}
function ArrowRight() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11m-4-4 4 4-4 4"/></svg>
}
function Check() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 3.4 3.4L16 5.8"/></svg>
}
function MiniIcon({ type }: { type: "source" | "visual" | "history" | "export" }) {
  if (type === "source") return <svg viewBox="0 0 24 24"><path d="m8 7-5 5 5 5m8-10 5 5-5 5M14 4l-4 16"/></svg>
  if (type === "visual") return <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M9 21h6m-3-4v4"/></svg>
  if (type === "history") return <svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.2-5.5L4 9M4 4v5h5M12 8v5l3 2"/></svg>
  return <svg viewBox="0 0 24 24"><path d="M12 4v12m0 0 4-4m-4 4-4-4M5 20h14"/></svg>
}

const heroPoints = [
  { icon: "source" as const, title: "Real source projects", body: "Start with working routes, components, styles, and source." },
  { icon: "visual" as const, title: "Visual + Code", body: "Edit the same source through the interface or directly in code." },
  { icon: "history" as const, title: "Revision history", body: "Every accepted change remains attached to a real source revision." },
  { icon: "export" as const, title: "Code you own", body: "Export the complete project and keep building wherever you want." },
]

const logoRows = [
  ["Mercury", "Watershed", "Retool", "Descript"],
  ["Perplexity", "Monzo", "Ramp", "Raycast", "Arc"],
]

const featureCards = [
  { title: "Start from a working project", image: "/mainline/features/triage-card.svg" },
  { title: "Edit the real source visually", image: "/mainline/features/cycle-card.svg" },
  { title: "Keep ownership from start to finish", image: "/mainline/features/overview-card.svg" },
]

const testimonials = [
  { quote: "A real starting point is more useful than another blank canvas.", author: "Working project", role: "Marketplace", company: "WebCanBe", image: "/mainline/testimonials/amy-chase.webp" },
  { quote: "Visual editing is valuable when the source underneath stays real.", author: "Same source", role: "Workspace", company: "WebCanBe", image: "/mainline/testimonials/jonas-kotara.webp" },
  { quote: "The project should still belong to you when you leave the tool.", author: "Portable code", role: "Ownership", company: "WebCanBe", image: "/mainline/testimonials/kevin-yam.webp" },
  { quote: "Buy the project, make a working copy, then change the actual files.", author: "Versioned release", role: "Marketplace", company: "WebCanBe", image: "/mainline/testimonials/kundo-marta.webp" },
]

const plans = [
  { name: "Free", monthly: "$0", yearly: "$0", note: "Explore the product.", features: ["Browse published projects", "Open product demos", "One working workspace", "Code export included"] },
  { name: "Pro", monthly: "$19", yearly: "$16", note: "For regular building.", features: ["Everything in Free", "Unlimited personal workspaces", "Visual + Code editing", "Larger AI allowance"] },
  { name: "Studio", monthly: "$49", yearly: "$41", note: "For teams and creators.", features: ["Everything in Pro", "Shared workspaces", "Creator tools", "Priority support"] },
]

const faqGroups = [
  { title: "Projects", items: [
    ["Are these static templates?", "No. Marketplace listings point to versioned working projects and immutable releases."],
    ["What happens after I buy one?", "The purchase becomes an entitlement first. From there you create an editable working copy."],
    ["Can the purchased release silently change?", "No. A new source state requires a new release identity."],
  ]},
  { title: "Editing", items: [
    ["Do visual edits change the source?", "Yes. Visual and code editing operate on the same working copy and source history."],
    ["Can I export the code?", "Yes. Code export remains part of the WebCanBe product contract."],
  ]},
  { title: "Ownership", items: [
    ["Is WebCanBe the only place the project works?", "No. The goal is a normal codebase you can take into your own development workflow."],
    ["Can another user guess my project URL?", "Project and workspace authority are checked server-side rather than trusting browser IDs."],
  ]},
]

function DashedLine({ vertical = false }: { vertical?: boolean }) {
  return <span className={vertical ? styles.dashedVertical : styles.dashedHorizontal} aria-hidden="true"/>
}

function Navbar() {
  const [open, setOpen] = useState(false)
  return <section className={styles.navbar}>
    <div className={styles.navInner}>
      <AppLink href="/" className={styles.brand}>WebCanBe</AppLink>
      <nav className={styles.desktopNav} aria-label="Main navigation">
        <a href="#features">Features</a>
        <AppLink href={routes.browse}>Marketplace</AppLink>
        <a href="#faq">FAQ</a>
      </nav>
      <div className={styles.navActions}>
        <AppLink href={routes.login} className={styles.loginButton}>Log in</AppLink>
        <AppLink href={routes.browse} className={styles.primaryButton}>Browse projects</AppLink>
        <button className={styles.menuButton} type="button" aria-expanded={open} aria-label="Toggle navigation" onClick={() => setOpen(value => !value)}><span/><span/><span/></button>
      </div>
    </div>
    <nav className={`${styles.mobileNav} ${open ? styles.mobileNavOpen : ""}`} aria-label="Mobile navigation">
      <a href="#features" onClick={() => setOpen(false)}>Features</a>
      <AppLink href={routes.browse}>Marketplace</AppLink>
      <a href="#faq" onClick={() => setOpen(false)}>FAQ</a>
      <AppLink href={routes.login}>Log in</AppLink>
      <AppLink href={routes.browse}>Browse projects</AppLink>
    </nav>
  </section>
}

function EditorPreview() {
  return <div className={styles.heroVisual}>
    <img src="/mainline/hero.webp" alt="WebCanBe product interface preview"/>
  </div>
}

function Hero() {
  return <section className={styles.hero}>
    <div className={styles.container}>
      <div className={styles.heroGrid}>
        <div className={styles.heroCopy}>
          <h1>Build from real code.<br/>Keep it yours.</h1>
          <p>Discover working web projects, edit the actual source visually or in code, and leave with a codebase you own.</p>
          <div className={styles.heroActions}>
            <AppLink href={routes.browse} className={styles.primaryButton}>Browse projects</AppLink>
            <AppLink href={routes.signup} className={styles.outlineButton}>Start building <ArrowRight/></AppLink>
          </div>
        </div>
        <div className={styles.heroPoints}>
          <DashedLine vertical/>
          {heroPoints.map(item => <div className={styles.heroPoint} key={item.title}>
            <MiniIcon type={item.icon}/>
            <div><h2>{item.title}</h2><p>{item.body}</p></div>
          </div>)}
        </div>
      </div>
    </div>
    <EditorPreview/>
  </section>
}

function Logos() {
  return <section className={styles.logos}>
    <div className={styles.container}>
      <h2>Built for people who want a better starting point.<br/><span>Real projects in, real source out.</span></h2>
      <div className={styles.logoRows}>
        {logoRows.map((row, rowIndex) => <div className={styles.logoRow} key={rowIndex}>
          {row.map(name => <span key={name}>{name}</span>)}
        </div>)}
      </div>
    </div>
  </section>
}

function Features() {
  return <section id="features" className={styles.features}>
    <div className={styles.container}>
      <div className={styles.dashedLabel}><DashedLine/><span>THE SOURCE IS THE PRODUCT.</span></div>
      <div className={styles.featureIntro}>
        <h2>Made for building on something real</h2>
        <p>WebCanBe keeps the marketplace, visual editor, code editor, and revision history attached to one canonical source instead of creating a second proprietary version of your project.</p>
      </div>
      <div className={styles.featureCard}>
        {featureCards.map((item, index) => <div className={styles.featureColumn} key={item.title}>
          <div className={styles.featureImageWrap}><img src={item.image} alt=""/></div>
          <AppLink href={index === 0 ? routes.browse : routes.signup} className={styles.featureLink}><h3>{item.title}</h3><span><Chevron/></span></AppLink>
          {index < featureCards.length - 1 && <DashedLine vertical/>}
        </div>)}
      </div>
    </div>
  </section>
}

function ResourceItem({ title, body, image, iconCloud, last = false }: { title: string; body: string; image?: string; iconCloud?: string[]; last?: boolean }) {
  return <div className={styles.resourceItem}>
    <div className={styles.resourceTitle}><h3>{title}</h3><span>{body}</span></div>
    {image && <div className={styles.resourceImage}><img src={image} alt=""/></div>}
    {iconCloud && <div className={styles.iconCloud}>{iconCloud.map((label, i) => <div key={`${label}-${i}`}>{label}</div>)}</div>}
    {!last && <DashedLine vertical/>}
  </div>
}

function ResourceAllocation() {
  return <section className={styles.resource}>
    <h2 className={styles.resourceHeadline}>From marketplace release to editable working copy</h2>
    <div className={`${styles.container} ${styles.resourceGrid}`}>
      <DashedLine/>
      <div className={styles.resourceTop}>
        <ResourceItem title="Reusable starting points." body="Buy or open a versioned project and create your own working copy." image="/mainline/resource-allocation/templates.webp"/>
        <ResourceItem title="Simplify the handoff." body="Marketplace, source, editor, history, export." iconCloud={["Browse","Release","Source","Visual","Code","History","Export","Deploy"]} last/>
      </div>
      <DashedLine/>
      <div className={styles.resourceBottom}>
        <ResourceItem title="Immutable releases." body="A published release does not silently change after purchase." image="/mainline/resource-allocation/graveyard.webp"/>
        <ResourceItem title="Same-source editing." body="Visual changes and code changes converge on the same source." image="/mainline/resource-allocation/discussions.webp"/>
        <ResourceItem title="Revision-aware." body="History and provenance stay attached as the working copy evolves." image="/mainline/resource-allocation/notifications.webp" last/>
      </div>
      <DashedLine/>
    </div>
  </section>
}

function Testimonials() {
  const [index, setIndex] = useState(0)
  const visible = useMemo(() => [...testimonials.slice(index), ...testimonials.slice(0, index)], [index])
  return <section className={styles.testimonials}>
    <div className={styles.container}>
      <div className={styles.sectionHeading}><h2>Built around ownership</h2><p>WebCanBe is designed around one simple constraint: the thing you edit should be the thing you can keep.</p><AppLink href={routes.browse} className={styles.outlineButton}>Explore marketplace <ArrowRight/></AppLink></div>
      <div className={styles.testimonialViewport}>
        <div className={styles.testimonialTrack}>
          {visible.map((item, i) => <article className={styles.testimonialCard} key={`${item.author}-${i}`}>
            <img src={item.image} alt=""/>
            <div><blockquote>{item.quote}</blockquote><p><strong>{item.author}, {item.role}</strong><span>{item.company}</span></p></div>
          </article>)}
        </div>
      </div>
      <div className={styles.carouselButtons}><button onClick={() => setIndex((index - 1 + testimonials.length) % testimonials.length)} aria-label="Previous">←</button><button onClick={() => setIndex((index + 1) % testimonials.length)} aria-label="Next">→</button></div>
    </div>
    <DashedLine/>
  </section>
}

function Pricing() {
  const [annual, setAnnual] = useState(true)
  return <section id="pricing" className={styles.pricing}>
    <div className={styles.narrowContainer}>
      <div className={styles.centerHeading}><h2>Plans</h2><p>Start with the marketplace, then pay for the workspace capabilities you need. Your code stays exportable.</p></div>
      <div className={styles.planGrid}>
        {plans.map(plan => <article className={`${styles.planCard} ${plan.name === "Pro" ? styles.featuredPlan : ""}`} key={plan.name}>
          <h3>{plan.name}</h3>
          <div className={styles.planPrice}>{annual ? plan.yearly : plan.monthly}{plan.name !== "Free" && <small> / month</small>}</div>
          {plan.name === "Free" ? <p className={styles.planNote}>{plan.note}</p> : <label className={styles.billingToggle}><input type="checkbox" checked={annual} onChange={() => setAnnual(v => !v)}/><span/><b>Billed annually</b></label>}
          <div className={styles.planFeatures}>{plan.features.map(feature => <p key={feature}><Check/>{feature}</p>)}</div>
          <AppLink href={plan.name === "Free" ? routes.browse : routes.signup} className={plan.name === "Pro" ? styles.primaryButton : styles.outlineButton}>Get started</AppLink>
        </article>)}
      </div>
    </div>
  </section>
}

function FAQ() {
  const [open, setOpen] = useState<string | null>(faqGroups[0].items[0][0])
  return <section id="faq" className={styles.faq}>
    <div className={styles.narrowContainer}>
      <div className={styles.faqGrid}>
        <div className={styles.faqIntro}><h2>Got questions?</h2><p>These answers describe the current product contract. Payment-provider specifics remain part of the later production integration.</p></div>
        <div className={styles.faqGroups}>
          {faqGroups.map(group => <div key={group.title}><h3>{group.title}</h3>{group.items.map(([question, answer]) => {
            const expanded = open === question
            return <div className={styles.faqItem} key={question}><button onClick={() => setOpen(expanded ? null : question)} aria-expanded={expanded}><span>{question}</span><b>{expanded ? "−" : "+"}</b></button>{expanded && <p>{answer}</p>}</div>
          })}</div>)}
        </div>
      </div>
    </div>
  </section>
}

function Footer() {
  return <footer className={styles.footer}>
    <div className={styles.container}>
      <div className={styles.footerCta}><h2>Start with a real project</h2><p>Browse versioned projects, make one yours, and keep the source attached to every edit.</p><AppLink href={routes.browse} className={styles.primaryButton}>Browse projects</AppLink></div>
      <nav className={styles.footerNav}><AppLink href={routes.browse}>Marketplace</AppLink><a href="#features">Features</a><a href="#faq">FAQ</a><AppLink href={routes.login}>Log in</AppLink></nav>
      <div className={styles.footerWordmark}>WebCanBe</div>
    </div>
  </footer>
}

export default function Home() {
  return <main className={styles.page}>
    <div className={styles.topShell}>
      <Navbar/>
      <Hero/>
      <Logos/>
      <Features/>
      <ResourceAllocation/>
    </div>
    <Testimonials/>
    <div className={styles.bottomShell}>
      <Pricing/>
      <FAQ/>
    </div>
    <Footer/>
  </main>
}
