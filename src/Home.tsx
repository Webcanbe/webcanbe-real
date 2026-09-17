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

function ArrowRight() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11m-4-4 4 4-4 4"/></svg>
}

function Check() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 3.4 3.4L16 5.8"/></svg>
}

function FeatureIcon({ type }: { type: "source" | "visual" | "history" | "export" | "market" | "release" | "split" | "portable" }) {
  if (type === "source") return <svg viewBox="0 0 24 24"><path d="m8 7-5 5 5 5m8-10 5 5-5 5M14 4l-4 16"/></svg>
  if (type === "visual") return <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M9 21h6m-3-4v4"/></svg>
  if (type === "history") return <svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.2-5.5L4 9M4 4v5h5M12 8v5l3 2"/></svg>
  if (type === "export") return <svg viewBox="0 0 24 24"><path d="M12 4v12m0 0 4-4m-4 4-4-4M5 20h14"/></svg>
  if (type === "market") return <svg viewBox="0 0 24 24"><path d="M4 9h16l-1-5H5L4 9Zm1 0v11h14V9M9 13h6"/></svg>
  if (type === "release") return <svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zM8 8h8M8 12h5M8 16h7"/></svg>
  if (type === "split") return <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/></svg>
  return <svg viewBox="0 0 24 24"><path d="M5 6h14v12H5zM8 9h8M8 13h5"/></svg>
}

const items = [
  { icon: "source" as const, title: "Real source", body: "Work with actual React projects instead of a proprietary canvas format." },
  { icon: "visual" as const, title: "Visual editing", body: "Change the interface visually while the real source remains authoritative." },
  { icon: "split" as const, title: "Visual + Code", body: "Use Visual, Code, or Split without creating a second source of truth." },
  { icon: "history" as const, title: "Revision history", body: "Accepted changes stay attached to durable source revisions." },
  { icon: "market" as const, title: "Project marketplace", body: "Start from versioned working projects instead of static screenshots." },
  { icon: "release" as const, title: "Immutable releases", body: "A purchased release does not silently mutate after publication." },
  { icon: "export" as const, title: "Exact export", body: "Take the project source with you whenever you want." },
  { icon: "portable" as const, title: "Portable by design", body: "Keep using the codebase in your normal development workflow." },
]

const plans = [
  { name: "Free", price: "$0", note: "Explore WebCanBe", features: ["Browse published projects", "Open project demos", "One working workspace", "Code export included"] },
  { name: "Pro", price: "$19", note: "For regular building", featured: true, features: ["Everything in Free", "Unlimited personal workspaces", "Visual + Code editing", "Expanded product limits"] },
  { name: "Studio", price: "$49", note: "For creators and teams", features: ["Everything in Pro", "Creator Studio", "Shared workflows", "Priority support"] },
]

const faqs = [
  ["Are these static templates?", "No. Marketplace listings point to versioned working projects and immutable releases."],
  ["Do visual edits change the real source?", "Yes. Visual and Code modes operate on the same working copy and revision history."],
  ["What happens after I buy a project?", "Your purchase is bound to a release. From there you create an editable working copy."],
  ["Can I export the code?", "Yes. Export remains part of the product contract; the project is designed to remain portable."],
  ["Can a purchased release silently change?", "No. Changing the published source requires a new release identity."],
  ["Does WebCanBe need to stay in the runtime?", "No. The goal is a normal codebase that can continue in your own development workflow."],
]

function Navbar() {
  const [open, setOpen] = useState(false)
  return <header className={styles.navbar}>
    <div className={styles.navBlur}/>
    <div className={styles.navInner}>
      <AppLink href="/" className={styles.brand}><span className={styles.brandMark}>W</span><span>WebCanBe</span></AppLink>
      <nav className={styles.desktopNav} aria-label="Main navigation">
        <a href="#features">Features</a>
        <AppLink href={routes.browse}>Marketplace</AppLink>
        <a href="#faq">FAQ</a>
      </nav>
      <div className={styles.navActions}>
        <AppLink href={routes.login} className={styles.signIn}>Log in</AppLink>
        <AppLink href={routes.browse} className={styles.primaryButton}>Browse projects</AppLink>
        <button className={styles.menuButton} type="button" aria-expanded={open} aria-label="Toggle navigation" onClick={() => setOpen(value => !value)}><span/><span/><span/></button>
      </div>
      {open && <nav className={styles.mobileNav} aria-label="Mobile navigation"><a href="#features" onClick={() => setOpen(false)}>Features</a><AppLink href={routes.browse}>Marketplace</AppLink><a href="#faq" onClick={() => setOpen(false)}>FAQ</a><AppLink href={routes.login}>Log in</AppLink><AppLink href={routes.browse}>Browse projects</AppLink></nav>}
    </div>
  </header>
}

function EditorPreview() {
  return <div className={styles.mockupArea}>
    <div className={styles.glow}/>
    <div className={styles.mockupFrame}>
      <div className={styles.mockupBar}><span/><span/><span/><div>webcanbe.com/workspace</div></div>
      <div className={styles.mockup}><img src="/mainline/hero.webp" alt="WebCanBe product interface preview"/></div>
    </div>
  </div>
}

function Hero() {
  return <section className={styles.hero}>
    <div className={styles.container}>
      <div className={styles.heroCopy}>
        <div className={styles.badge}><span>WebCanBe</span><strong>The source is the product</strong><ArrowRight/></div>
        <h1>Build from real code.<br/><span>Keep it yours.</span></h1>
        <p>Discover working web projects, edit the actual source visually or in code, and leave with a codebase you own.</p>
        <div className={styles.heroActions}><AppLink href={routes.browse} className={styles.primaryButton}>Browse projects</AppLink><AppLink href={routes.signup} className={styles.secondaryButton}>Start building <ArrowRight/></AppLink></div>
      </div>
      <EditorPreview/>
    </div>
  </section>
}

function Logos() {
  return <section className={styles.logos}><div className={styles.container}><p>One source, across the whole workflow</p><div className={styles.logoStrip}>{["Marketplace", "Release", "Visual", "Code", "History", "Export"].map(label => <span key={label}>{label}</span>)}</div></div></section>
}

function Items() {
  return <section id="features" className={styles.items}><div className={styles.container}><div className={styles.sectionHeading}><span>Built around source ownership</span><h2>Everything you need.<br/>Nothing that traps your code.</h2><p>WebCanBe connects the marketplace and browser workspace to the same source, revision, and authority model.</p></div><div className={styles.itemGrid}>{items.map(item => <article className={styles.item} key={item.title}><div className={styles.itemIcon}><FeatureIcon type={item.icon}/></div><h3>{item.title}</h3><p>{item.body}</p></article>)}</div></div></section>
}

function ProductStory() {
  return <section className={styles.story}><div className={styles.container}><div className={styles.storyGrid}><div className={styles.storyCopy}><span>From release to working copy</span><h2>Start with something real.</h2><p>Marketplace projects arrive as immutable releases. Create your own working copy, then change the actual project through Visual, Code, or Split.</p><AppLink href={routes.browse} className={styles.secondaryButton}>Explore marketplace <ArrowRight/></AppLink></div><div className={styles.storyImage}><img src="/mainline/resource-allocation/templates.webp" alt="Project templates interface"/></div></div><div className={styles.featureVisuals}><article><div><span>Visual editing</span><h3>Change the interface without hiding the source.</h3></div><img src="/mainline/features/triage-card.svg" alt="Visual editing interface"/></article><article><div><span>Same source</span><h3>Move between Visual and Code without conversion.</h3></div><img src="/mainline/features/cycle-card.svg" alt="Source editing interface"/></article><article><div><span>Ownership</span><h3>Keep the project portable from start to finish.</h3></div><img src="/mainline/features/overview-card.svg" alt="Project overview interface"/></article></div></div></section>
}

function Stats() {
  return <section className={styles.stats}><div className={styles.container}><div className={styles.statsGrid}><div><strong>1</strong><span>canonical source</span></div><div><strong>3</strong><span>workspace modes</span></div><div><strong>0</strong><span>proprietary export lock-in</span></div><div><strong>100%</strong><span>source ownership direction</span></div></div></div></section>
}

function Pricing() {
  return <section className={styles.pricing}><div className={styles.container}><div className={styles.sectionHeading}><span>Plans</span><h2>Start small. Keep the code.</h2><p>Plans change workspace capabilities, not whether your project source belongs to you.</p></div><div className={styles.planGrid}>{plans.map(plan => <article className={`${styles.planCard} ${plan.featured ? styles.featuredPlan : ""}`} key={plan.name}>{plan.featured && <span className={styles.planBadge}>Most popular</span>}<h3>{plan.name}</h3><p>{plan.note}</p><div className={styles.planPrice}>{plan.price}<small>{plan.name !== "Free" ? " / month" : ""}</small></div><div className={styles.planFeatures}>{plan.features.map(feature => <span key={feature}><Check/>{feature}</span>)}</div><AppLink href={plan.name === "Free" ? routes.browse : routes.signup} className={plan.featured ? styles.primaryButton : styles.secondaryButton}>Get started</AppLink></article>)}</div></div></section>
}

function FAQ() {
  return <section id="faq" className={styles.faq}><div className={styles.container}><div className={styles.sectionHeading}><span>FAQ</span><h2>Questions, answered.</h2></div><div className={styles.faqList}>{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div></div></section>
}

function CTA() {
  return <section className={styles.cta}><div className={styles.container}><div className={styles.ctaCard}><div><span>Start from real code</span><h2>Your next project does not need another blank canvas.</h2><p>Browse working projects, create a working copy, and keep building from source you own.</p></div><div className={styles.ctaActions}><AppLink href={routes.browse} className={styles.primaryButton}>Browse projects</AppLink><AppLink href={routes.signup} className={styles.secondaryButton}>Create account</AppLink></div></div></div></section>
}

function Footer() {
  return <footer className={styles.footer}><div className={styles.container}><div className={styles.footerTop}><AppLink href="/" className={styles.brand}><span className={styles.brandMark}>W</span><span>WebCanBe</span></AppLink><p>Edit visually. Leave with real code you own.</p></div><div className={styles.footerLinks}><div><strong>Product</strong><AppLink href={routes.browse}>Marketplace</AppLink><AppLink href={routes.login}>Log in</AppLink></div><div><strong>Workspace</strong><a href="#features">Visual</a><a href="#features">Code</a><a href="#features">History</a></div><div><strong>WebCanBe</strong><a href="#faq">FAQ</a><AppLink href={routes.signup}>Get started</AppLink></div></div><div className={styles.footerBottom}><span>© 2026 WebCanBe</span><span>The source is the product.</span></div></div></footer>
}

export default function Home() {
  return <main className={styles.page}><Navbar/><Hero/><Logos/><Items/><ProductStory/><Stats/><Pricing/><FAQ/><CTA/><Footer/></main>
}
