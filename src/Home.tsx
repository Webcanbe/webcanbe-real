import { useRef, useState, type MouseEvent, type ReactNode } from "react"
import styles from "./landing.module.css"

import heroImage from "./assets/mainline/hero.webp"
import triageImage from "./assets/mainline/features/triage-card.svg"
import cycleImage from "./assets/mainline/features/cycle-card.svg"
import overviewImage from "./assets/mainline/features/overview-card.svg"
import templatesImage from "./assets/mainline/resource-allocation/templates.webp"
import graveyardImage from "./assets/mainline/resource-allocation/graveyard.webp"
import discussionsImage from "./assets/mainline/resource-allocation/discussions.webp"
import notificationsImage from "./assets/mainline/resource-allocation/notifications.webp"
import jiraLogo from "./assets/mainline/logos/jira.svg"
import excelLogo from "./assets/mainline/logos/excel.svg"
import notionLogo from "./assets/mainline/logos/notion.svg"
import wordLogo from "./assets/mainline/logos/word.svg"
import mondayLogo from "./assets/mainline/logos/monday.svg"
import driveLogo from "./assets/mainline/logos/drive.svg"
import asanaLogo from "./assets/mainline/logos/asana.svg"
import openaiLogo from "./assets/mainline/logos/openai.svg"
import testimonialOne from "./assets/mainline/testimonials/amy-chase.webp"
import testimonialTwo from "./assets/mainline/testimonials/jonas-kotara.webp"
import testimonialThree from "./assets/mainline/testimonials/kevin-yam.webp"
import testimonialFour from "./assets/mainline/testimonials/kundo-marta.webp"

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

function Chevron() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg> }
function ArrowRight() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-5 5 5-5 5"/></svg> }
function Icon({ name }: { name: "source" | "visual" | "history" | "export" }) {
  if (name === "source") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 8-4 4 4 4m8-8 4 4-4 4M14 4l-4 16"/></svg>
  if (name === "visual") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H4zM8 20h8M12 16v4"/></svg>
  if (name === "history") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5M4 4v4.5h4.5M12 8v4l3 2"/></svg>
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 18v3h14v-3"/></svg>
}
function DashedLine({ vertical = false }: { vertical?: boolean }) { return <span className={vertical ? styles.dashedVertical : styles.dashedHorizontal} aria-hidden="true"/> }

const heroPoints = [
  { icon: "source" as const, title: "Real source", body: "Start from a working codebase, not a flattened mockup." },
  { icon: "visual" as const, title: "Visual + Code", body: "Edit visually or directly in code. Both touch the same files." },
  { icon: "history" as const, title: "Revision history", body: "Accepted changes stay attached to exact source revisions." },
  { icon: "export" as const, title: "Code you own", body: "Export the project and keep building wherever you want." },
]
const featureCards = [
  { title: "Browse working projects", image: triageImage },
  { title: "Edit the actual source", image: cycleImage },
  { title: "Keep every change grounded", image: overviewImage },
]
const toolLogos = [["Jira", jiraLogo], ["Excel", excelLogo], ["Notion", notionLogo], ["Word", wordLogo], ["Monday", mondayLogo], ["Drive", driveLogo], ["Asana", asanaLogo], ["OpenAI", openaiLogo]]
const testimonials = [
  { image: testimonialOne, quote: "A marketplace should give me a real starting point, not something I have to rebuild after download.", author: "Early product direction", role: "Buyer workflow" },
  { image: testimonialTwo, quote: "The visual editor matters because it changes the same source I can inspect and export.", author: "Source-first principle", role: "Editor workflow" },
  { image: testimonialThree, quote: "Purchases and working copies should stay separate. I want to know exactly what I bought and what I changed.", author: "Product architecture", role: "Ownership workflow" },
  { image: testimonialFour, quote: "Compatibility should be visible before I buy. A project should say what WebCanBe can really edit.", author: "WebCanBe Ready", role: "Marketplace trust" },
]
const plans = [
  { name: "Free", price: "$0", suffix: "", features: ["Browse public projects", "Inspect project details", "One personal workspace", "Code export"] },
  { name: "Pro", price: "$19", suffix: " / month", features: ["Everything in Free", "Unlimited personal workspaces", "Visual + Code editing", "Larger AI allowance later"] },
  { name: "Studio", price: "$49", suffix: " / month", features: ["Everything in Pro", "Shared workspaces", "Creator tools", "Priority support"] },
]
const faqGroups = [
  { title: "Projects", questions: [["Are these just templates?", "No. Marketplace listings bind to versioned working source releases. You receive an entitlement to a specific release."], ["Can I see what I am buying?", "Project detail and compatibility information are designed to make the source, stack, release and WebCanBe support level clear before purchase."], ["Does the seller change my purchased release later?", "No. A published release remains immutable. New source requires a new release identity."]] },
  { title: "Editing", questions: [["Do visual edits change the source?", "Yes. Visual and code editing operate on the same working copy and revision history."], ["Can I export the code?", "Yes. Source ownership and export are part of the product contract."]] },
  { title: "Purchases", questions: [["What happens after purchase?", "A confirmed payment creates an entitlement. You can then create an editable working copy without mutating the original release."], ["Why are Purchases and My Projects separate?", "A purchase is an entitlement to a release. My Projects contains the working copies you actually edit."]] },
]

function Navbar() {
  const [open, setOpen] = useState(false), [featuresOpen, setFeaturesOpen] = useState(false)
  return <header className={styles.navbar}><div className={styles.navInner}><AppLink href="/" className={styles.wordmark}>WebCanBe</AppLink><nav className={styles.desktopNav} aria-label="Main navigation"><button className={styles.featureTrigger} onClick={() => setFeaturesOpen(value => !value)}>Features <span>⌄</span></button><AppLink href={routes.browse}>Marketplace</AppLink><a href="#faq">FAQ</a></nav><div className={styles.navActions}><AppLink href={routes.login} className={styles.loginButton}>Login</AppLink><AppLink href={routes.browse} className={styles.iconButton}>↗</AppLink><button className={styles.menuButton} type="button" aria-expanded={open} aria-label="Toggle navigation" onClick={() => setOpen(value => !value)}><span/><span/></button></div></div>{featuresOpen && <div className={styles.featureMenu}><a href="#feature-modern-teams" onClick={() => setFeaturesOpen(false)}><b>Working projects</b><span>Browse source-backed releases built to keep moving.</span></a><a href="#resource-allocation" onClick={() => setFeaturesOpen(false)}><b>One source of truth</b><span>Visual, code and later AI edits share the same project source.</span></a></div>}<nav className={`${styles.mobileNav} ${open ? styles.mobileNavOpen : ""}`} aria-label="Mobile navigation"><a href="#feature-modern-teams" onClick={() => setOpen(false)}>Features</a><AppLink href={routes.browse}>Marketplace</AppLink><a href="#faq" onClick={() => setOpen(false)}>FAQ</a><AppLink href={routes.login}>Login</AppLink></nav></header>
}
function EditorPreview() { return <div className={styles.heroMedia}><img src={heroImage} alt="WebCanBe product interface preview"/></div> }
function Hero() { return <section className={styles.hero}><div className={styles.container}><div className={styles.heroGrid}><div className={styles.heroCopy}><h1>Working websites.<br/>Real code. Yours.</h1><p>Buy a real web project, change the actual source visually or in code, and leave with a codebase you own.</p><div className={styles.heroActions}><AppLink href={routes.browse} className={styles.primaryButton}>Browse projects</AppLink><a href="#feature-modern-teams" className={styles.secondaryButton}>See how it works <ArrowRight/></a></div></div><div className={styles.heroPoints}><DashedLine vertical/>{heroPoints.map(point => <div className={styles.heroPoint} key={point.title}><Icon name={point.icon}/><div><h2>{point.title}</h2><p>{point.body}</p></div></div>)}</div></div><EditorPreview/></div></section> }
function Logos() { return <section className={styles.logos}><div className={styles.container}><h2>One project can keep moving after purchase.<br/><span>Source, editing, history and export stay connected.</span></h2><div className={styles.logoRows}>{["Marketplace", "Visual", "Code", "History", "Export", "Creator Studio", "Ready", "Deploy"].map((name,index)=><span key={name} className={index > 3 ? styles.logoMuted : ""}>{name}</span>)}</div></div></section> }
function Features() { return <section id="feature-modern-teams" className={styles.features}><div className={styles.container}><div className={styles.measureLine}><DashedLine/><span>THE SOURCE IS THE PRODUCT.</span></div><div className={styles.featureIntro}><h2>Made for people who want a head start, not a lock-in.</h2><p>WebCanBe starts with working projects and keeps the source canonical. Browse a release, make a working copy, then edit the same files through the interface or directly in code.</p></div><div className={styles.featureCard}>{featureCards.map((item,index)=><div className={styles.featureCell} key={item.title}><div className={styles.featureVisual}><img src={item.image} alt=""/><span/></div><a href={index===0 ? "/browse" : "#resource-allocation"} onClick={event => index===0 ? route(event, "/browse") : undefined}><h3>{item.title}</h3><span className={styles.circleArrow}><Chevron/></span></a>{index < featureCards.length-1 && <DashedLine vertical/>}</div>)}</div></div></section> }
function ResourceAllocation() { return <section id="resource-allocation" className={styles.resource}><div className={styles.container}><h2>One source of truth from purchase to export</h2><div className={styles.resourceGrid}><DashedLine/><div className={`${styles.resourceItem} ${styles.resourceWide}`}><div><h3>Start from a real release.</h3><p> Every marketplace purchase stays bound to an immutable source release.</p></div><img src={templatesImage} alt="Release and project interface"/><DashedLine vertical/></div><div className={`${styles.resourceItem} ${styles.resourceWide}`}><div><h3>Keep your normal stack.</h3><p> WebCanBe sits on top of real project files instead of replacing them with a proprietary canvas.</p></div><div className={styles.toolGrid}>{toolLogos.map(([name,logo])=><span key={name}><img src={logo} alt={name}/></span>)}</div></div><DashedLine/><div className={styles.resourceBottom}><div className={styles.resourceItem}><div><h3>Release history.</h3><p> Original release provenance remains visible after you create a working copy.</p></div><img src={graveyardImage} alt="Revision history interface"/><DashedLine vertical/></div><div className={styles.resourceItem}><div><h3>Changes stay explainable.</h3><p> Visual and code edits share the same revision model.</p></div><img src={discussionsImage} alt="Project change discussion interface"/><DashedLine vertical/></div><div className={styles.resourceItem}><div><h3>Know what needs attention.</h3><p> Compatibility and product state surface without invented analytics.</p></div><img src={notificationsImage} alt="Project notifications interface"/></div></div><DashedLine/></div></div></section> }
function Testimonials() { const rail = useRef<HTMLDivElement>(null); const move=(amount:number)=>rail.current?.scrollBy({left:amount,behavior:"smooth"}); return <section className={styles.testimonials}><div className={styles.container}><div className={styles.testimonialIntro}><h2>Built around ownership</h2><p>The product rules are intentionally simple: the release is immutable, your working copy is editable, and the actual source remains yours.</p><AppLink href={routes.browse} className={styles.secondaryButton}>Browse the marketplace <ArrowRight/></AppLink></div><div ref={rail} className={styles.testimonialRail}>{testimonials.map((item,index)=><article className={styles.testimonialCard} key={index}><img src={item.image} alt=""/><div><blockquote>{item.quote}</blockquote><p><b>{item.author}</b><span>{item.role}</span></p></div></article>)}</div><div className={styles.carouselButtons}><button onClick={()=>move(-360)}>←</button><button onClick={()=>move(360)}>→</button></div></div><DashedLine/></section> }
function Pricing() { const [annual,setAnnual]=useState(true); return <section id="pricing" className={styles.pricing}><div className={styles.narrowContainer}><div className={styles.sectionIntro}><h2>Pricing</h2><p>Start with the marketplace. Pay for the workspace features you actually need.</p></div><div className={styles.pricingGrid}>{plans.map((plan,index)=><article className={`${styles.priceCard} ${index===1 ? styles.priceFeatured : ""}`} key={plan.name}><h3>{plan.name}</h3><div className={styles.price}>{plan.price}{plan.suffix && <span>{plan.suffix}</span>}</div>{plan.name==="Free" ? <p className={styles.priceNote}>Free to start.</p> : <label className={styles.billingToggle}><input type="checkbox" checked={annual} onChange={()=>setAnnual(v=>!v)}/><span/>Billed {annual ? "annually" : "monthly"}</label>}<ul>{plan.features.map(feature=><li key={feature}>✓ <span>{feature}</span></li>)}</ul><AppLink href={plan.name==="Free" ? routes.browse : routes.signup} className={index===1 ? styles.primaryButton : styles.secondaryButton}>Get started</AppLink></article>)}</div></div></section> }
function FAQ() { return <section id="faq" className={styles.faq}><div className={styles.narrowContainer}><div className={styles.faqGrid}><div className={styles.faqIntro}><h2>Got Questions?</h2><p>Start with the product details here, then use Help & Docs inside the app when you need implementation-specific information.</p></div><div className={styles.faqQuestions}>{faqGroups.map(group=><div className={styles.faqGroup} key={group.title}><h3>{group.title}</h3>{group.questions.map(([question,answer])=><details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div>)}</div></div></div></section> }
function Footer() { return <footer className={styles.footer}><div className={styles.container}><div className={styles.footerCta}><h2>Start from something real</h2><p>Browse source-backed projects, then make one yours.</p><AppLink href={routes.browse} className={styles.primaryButton}>Browse projects</AppLink></div><nav className={styles.footerNav}><div><a href="#feature-modern-teams">Product</a><AppLink href={routes.browse}>Marketplace</AppLink><a href="#faq">FAQ</a></div><div><AppLink href={routes.login}>Login</AppLink><AppLink href={routes.signup}>Create account</AppLink></div></nav><div className={styles.footerWordmark}>WebCanBe</div></div></footer> }
export default function Home() { return <div className={styles.page}><Navbar/><main><div className={styles.topShell}><Hero/><Logos/><Features/><ResourceAllocation/></div><Testimonials/><div className={styles.bottomShell}><Pricing/><FAQ/></div></main><Footer/></div> }
