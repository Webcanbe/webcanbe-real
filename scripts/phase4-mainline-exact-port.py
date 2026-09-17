from pathlib import Path
import json, shutil, subprocess, tempfile

ROOT = Path.cwd()
TMP = Path(tempfile.mkdtemp(prefix="mainline-"))
repo = TMP / "mainline"
subprocess.run(["git","clone","--depth","1","https://github.com/shadcnblocks/mainline-nextjs-template.git",str(repo)], check=True)

package = json.loads((repo / "package.json").read_text())
if package.get("name") != "mainline-nextjs-template" or package.get("version") != "1.2.0":
    raise SystemExit(f"Unexpected Mainline source: {package.get('name')} {package.get('version')}")

required = [
    "public/hero.webp",
    "public/features/triage-card.svg",
    "public/features/cycle-card.svg",
    "public/features/overview-card.svg",
    "public/resource-allocation/templates.webp",
    "public/resource-allocation/graveyard.webp",
    "public/resource-allocation/discussions.webp",
    "public/resource-allocation/notifications.webp",
    "public/testimonials/amy-chase.webp",
    "public/testimonials/jonas-kotara.webp",
    "public/testimonials/kevin-yam.webp",
    "public/testimonials/kundo-marta.webp",
    "fonts/dm-sans/DMSans-Regular.ttf",
    "fonts/dm-sans/DMSans-Medium.ttf",
    "fonts/dm-sans/DMSans-SemiBold.ttf",
    "fonts/dm-sans/DMSans-Bold.ttf",
]
logo_names = ["jira","excel","notion","word","monday","drive","asana","openai"]
required += [f"public/logos/{name}.svg" for name in logo_names]
for rel in required:
    if not (repo / rel).is_file():
        raise SystemExit(f"Missing Mainline asset: {rel}")

assets = ROOT / "src/assets/mainline"
(assets / "features").mkdir(parents=True, exist_ok=True)
(assets / "resource-allocation").mkdir(parents=True, exist_ok=True)
(assets / "testimonials").mkdir(parents=True, exist_ok=True)
(assets / "logos").mkdir(parents=True, exist_ok=True)
(assets / "fonts").mkdir(parents=True, exist_ok=True)

shutil.copy2(repo / "public/hero.webp", assets / "hero.webp")
for name in ["triage-card.svg","cycle-card.svg","overview-card.svg"]:
    shutil.copy2(repo / "public/features" / name, assets / "features" / name)
for name in ["templates.webp","graveyard.webp","discussions.webp","notifications.webp"]:
    shutil.copy2(repo / "public/resource-allocation" / name, assets / "resource-allocation" / name)
for name in ["amy-chase.webp","jonas-kotara.webp","kevin-yam.webp","kundo-marta.webp"]:
    shutil.copy2(repo / "public/testimonials" / name, assets / "testimonials" / name)
for name in logo_names:
    shutil.copy2(repo / "public/logos" / f"{name}.svg", assets / "logos" / f"{name}.svg")
for name in ["DMSans-Regular.ttf","DMSans-Medium.ttf","DMSans-SemiBold.ttf","DMSans-Bold.ttf"]:
    shutil.copy2(repo / "fonts/dm-sans" / name, assets / "fonts" / name)

(ROOT / "src/Home.tsx").write_text('''import { useRef, useState, type MouseEvent, type ReactNode } from "react"
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
''')

(ROOT / "src/landing.module.css").write_text('''@font-face{font-family:"DM Sans";src:url("./assets/mainline/fonts/DMSans-Regular.ttf") format("truetype");font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:"DM Sans";src:url("./assets/mainline/fonts/DMSans-Medium.ttf") format("truetype");font-weight:500;font-style:normal;font-display:swap}
@font-face{font-family:"DM Sans";src:url("./assets/mainline/fonts/DMSans-SemiBold.ttf") format("truetype");font-weight:600;font-style:normal;font-display:swap}
@font-face{font-family:"DM Sans";src:url("./assets/mainline/fonts/DMSans-Bold.ttf") format("truetype");font-weight:700;font-style:normal;font-display:swap}
.page{--bg:#fff;--fg:#252522;--muted:#72726d;--line:#deded8;background:var(--bg);color:var(--fg);font-family:"DM Sans",Inter,ui-sans-serif,system-ui,sans-serif;min-height:100vh;line-height:1.4}.page *{box-sizing:border-box}.page a{color:inherit}.container{width:min(1220px,calc(100% - 48px));margin-inline:auto}.narrowContainer{width:min(1024px,calc(100% - 48px));margin-inline:auto}.topShell{position:relative;margin:10px 10px 0;border-radius:32px 32px 16px 16px;background:linear-gradient(180deg,#eee6cf 0%,#f6f5f1 17%,#f5f5f2 100%);overflow:hidden}.bottomShell{position:relative;margin:0 10px 10px;border-radius:16px 16px 32px 32px;background:linear-gradient(180deg,#fff 0%,#fff 60%,#eee6cf 100%);overflow:hidden}
.navbar{position:absolute;top:48px;left:50%;transform:translateX(-50%);z-index:30;width:min(700px,90%);border:1px solid rgba(70,70,60,.16);border-radius:32px;background:rgba(255,255,255,.72);backdrop-filter:blur(16px);box-shadow:0 8px 30px rgba(20,20,15,.04)}.navInner{height:54px;padding:0 20px;display:flex;align-items:center;justify-content:space-between;gap:22px}.wordmark{font-size:16px;font-weight:700;letter-spacing:-.045em;text-decoration:none;white-space:nowrap}.desktopNav{display:flex;align-items:center;gap:16px}.desktopNav>a,.featureTrigger{border:0;background:transparent;text-decoration:none;font:inherit;font-size:13px;font-weight:500;padding:6px 4px;color:#383834;cursor:pointer}.featureTrigger{display:flex;align-items:center;gap:4px}.featureTrigger span{font-size:10px;color:#85857f}.navActions{display:flex;align-items:center;gap:9px}.loginButton{border:1px solid #d4d4cf;border-radius:8px;padding:7px 12px;text-decoration:none;font-size:13px;background:#fff}.iconButton{width:32px;height:32px;border-radius:50%;border:1px solid #d8d8d2;display:grid;place-items:center;text-decoration:none;color:#777770}.menuButton{display:none;border:0;background:transparent;width:32px;height:32px;position:relative}.menuButton span{position:absolute;width:18px;height:1.5px;background:#333;left:7px}.menuButton span:first-child{top:12px}.menuButton span:last-child{top:19px}.featureMenu{position:absolute;top:62px;left:50%;transform:translateX(-50%);width:420px;border:1px solid #dddcd5;background:#fff;border-radius:14px;padding:8px;box-shadow:0 14px 35px rgba(0,0,0,.08)}.featureMenu a{display:block;padding:12px;border-radius:9px;text-decoration:none}.featureMenu a:hover{background:#f4f4f1}.featureMenu b{display:block;font-size:13px}.featureMenu span{display:block;font-size:12px;color:var(--muted);margin-top:3px}.mobileNav{display:none}
.hero{padding:174px 0 108px}.heroGrid{display:grid;grid-template-columns:1fr 1fr;gap:72px;align-items:stretch}.heroCopy h1{font-size:clamp(38px,4vw,58px);line-height:1.02;letter-spacing:-.055em;font-weight:500;max-width:660px}.heroCopy p{font-size:clamp(20px,2vw,30px);line-height:1.15;letter-spacing:-.03em;color:#77766f;margin-top:24px;max-width:670px}.heroActions{display:flex;align-items:center;gap:12px;margin-top:32px}.primaryButton,.secondaryButton{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:40px;padding:10px 16px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;transition:.2s ease}.primaryButton{background:#2f302e;color:#fff!important;border:1px solid #2f302e}.primaryButton:hover{background:#171816}.secondaryButton{background:linear-gradient(90deg,#fff,#fff9);border:1px solid #dadad4;box-shadow:0 2px 7px rgba(0,0,0,.06)}.secondaryButton svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2}.heroPoints{position:relative;padding-left:42px;display:flex;flex-direction:column;justify-content:center;gap:20px}.heroPoint{display:grid;grid-template-columns:24px 1fr;gap:15px}.heroPoint>svg{width:19px;height:19px;stroke:currentColor;fill:none;stroke-width:1.7;margin-top:3px}.heroPoint h2{font-size:14px;font-weight:600}.heroPoint p{font-size:13px;color:var(--muted);margin-top:2px;max-width:310px}.heroMedia{margin-top:88px;height:793px;position:relative;overflow:hidden;border-radius:16px;box-shadow:0 24px 48px rgba(40,37,30,.12)}.heroMedia img{width:100%;height:100%;display:block;object-fit:cover;object-position:left top}
.logos{padding:0 0 120px}.logos h2{text-align:center;font-size:clamp(22px,2.4vw,34px);letter-spacing:-.035em;font-weight:500;line-height:1.15}.logos h2 span{color:#85857f}.logoRows{margin:62px auto 0;display:grid;grid-template-columns:repeat(4,1fr);gap:28px;align-items:center;max-width:930px}.logoRows span{text-align:center;font-size:16px;font-weight:600;color:#5f5f59;opacity:.82}.logoRows .logoMuted{opacity:.52}.dashedHorizontal{display:block;width:100%;height:1px;background:repeating-linear-gradient(90deg,transparent 0 4px,#9b9b94 4px 10px);mask-image:linear-gradient(90deg,transparent,#000 25%,#000 75%,transparent);opacity:.55}.dashedVertical{position:absolute;top:0;bottom:0;left:0;width:1px;background:repeating-linear-gradient(180deg,transparent 0 4px,#9b9b94 4px 10px);mask-image:linear-gradient(180deg,transparent,#000 25%,#000 75%,transparent);opacity:.55}
.features{padding-bottom:126px}.measureLine{position:relative;display:flex;justify-content:center;align-items:center}.measureLine>span:last-child{position:absolute;background:#f5f5f2;color:#888881;font:600 11px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;padding:0 12px}.featureIntro{max-width:900px;margin:90px auto 0;display:grid;grid-template-columns:1fr 1fr;gap:50px;align-items:center}.featureIntro h2{font-size:clamp(32px,4vw,52px);line-height:1.03;letter-spacing:-.052em;font-weight:500}.featureIntro p{font-size:16px;color:var(--muted);line-height:1.48}.featureCard{margin-top:72px;border:1px solid #d9d9d2;border-radius:24px;background:#fff;display:grid;grid-template-columns:repeat(3,1fr);overflow:hidden}.featureCell{position:relative;padding:24px;min-width:0}.featureCell>.dashedVertical{left:auto;right:0}.featureVisual{height:230px;position:relative;overflow:hidden}.featureVisual img{width:100%;height:100%;object-fit:cover;object-position:left top;padding:8px 0 0 16px}.featureVisual span{position:absolute;inset:35% 0 0;background:linear-gradient(transparent,#fff)}.featureCell>a{display:flex;justify-content:space-between;gap:18px;align-items:center;text-decoration:none;padding-top:20px}.featureCell h3{font-size:25px;line-height:1.07;letter-spacing:-.04em;font-weight:700;max-width:210px}.circleArrow{width:44px;height:44px;border:1px solid #dadad5;border-radius:50%;display:grid;place-items:center;flex:0 0 auto}.circleArrow svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8}
.resource{padding-bottom:124px;overflow:hidden}.resource>div>h2{text-align:center;max-width:920px;margin:0 auto;font-size:clamp(38px,5.2vw,68px);line-height:1;letter-spacing:-.055em;font-weight:500}.resourceGrid{margin-top:76px}.resourceGrid>.resourceWide{width:50%;display:inline-flex;vertical-align:top;min-height:345px}.resourceItem{position:relative;flex-direction:column;justify-content:space-between;padding:30px 28px;overflow:hidden}.resourceItem>.dashedVertical{left:auto;right:0}.resourceItem>div:first-child{margin-bottom:28px}.resourceItem h3{display:inline;font-size:15px;font-weight:600}.resourceItem p{display:inline;font-size:15px;color:var(--muted)}.resourceItem>img{display:block;max-width:100%;max-height:255px;object-fit:contain;object-position:left bottom}.toolGrid{display:grid;grid-template-columns:repeat(4,70px);gap:18px;justify-content:center;padding:12px}.toolGrid span{width:70px;height:70px;border-radius:16px;background:#fff;display:grid;place-items:center;box-shadow:0 2px 8px #0000000c}.toolGrid img{max-width:42px;max-height:42px}.resourceBottom{display:grid;grid-template-columns:repeat(3,1fr)}.resourceBottom .resourceItem{min-height:335px}.resourceBottom .resourceItem>img{margin-top:auto}
.testimonials{padding:116px 0 80px;overflow:hidden}.testimonialIntro h2{font-size:clamp(34px,4vw,52px);letter-spacing:-.05em;font-weight:500}.testimonialIntro p{max-width:430px;color:var(--muted);font-size:15px;line-height:1.5;margin:14px 0 22px}.testimonialRail{display:flex;gap:18px;overflow:auto;scrollbar-width:none;margin-top:70px;margin-right:calc((100vw - min(1220px,calc(100vw - 48px)))/-2);padding-right:48px;scroll-snap-type:x mandatory}.testimonialRail::-webkit-scrollbar{display:none}.testimonialCard{flex:0 0 340px;background:#f3f3f0;border-radius:14px;overflow:hidden;scroll-snap-align:start}.testimonialCard>img{width:100%;height:306px;object-fit:cover;object-position:top}.testimonialCard>div{min-height:245px;padding:24px;display:flex;flex-direction:column;justify-content:space-between}.testimonialCard blockquote{font-size:23px;line-height:1.04;letter-spacing:-.04em;font-weight:500}.testimonialCard p{margin-top:30px}.testimonialCard b{display:block;font-size:13px;color:#8e815d}.testimonialCard span{display:block;color:var(--muted);font-size:12px;margin-top:2px}.carouselButtons{display:flex;gap:10px;margin-top:22px}.carouselButtons button{width:56px;height:56px;border-radius:50%;border:0;background:#f2f2ef;font-size:21px;color:#555}
.pricing{padding:116px 0}.sectionIntro{text-align:center}.sectionIntro h2{font-size:clamp(36px,4.5vw,54px);font-weight:500;letter-spacing:-.05em}.sectionIntro p{max-width:590px;margin:14px auto 0;color:var(--muted);font-size:15px}.pricingGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;align-items:start;margin-top:72px}.priceCard{background:#fff;border:1px solid #dcdcd6;border-radius:12px;padding:22px;min-height:410px;display:flex;flex-direction:column;gap:22px}.priceFeatured{outline:4px solid #d6cba7}.priceCard h3{font-size:15px}.price{font-size:21px;color:#77766f;font-weight:600}.price span{font-size:13px;font-weight:400}.priceNote{font-size:13px;color:var(--muted)}.billingToggle{font-size:13px;display:flex;align-items:center;gap:9px}.billingToggle input{position:absolute;opacity:0}.billingToggle>span{width:33px;height:19px;border-radius:20px;background:#ddd;position:relative}.billingToggle>span:after{content:"";position:absolute;width:15px;height:15px;top:2px;left:2px;background:#fff;border-radius:50%;transition:.2s}.billingToggle input:checked+span{background:#292a28}.billingToggle input:checked+span:after{transform:translateX(14px)}.priceCard ul{display:flex;flex-direction:column;gap:10px;color:#66665f;font-size:13px;min-height:150px}.priceCard li{display:flex;gap:7px}.priceCard .primaryButton,.priceCard .secondaryButton{align-self:flex-start;margin-top:auto}
.faq{padding:100px 0 124px}.faqGrid{display:grid;grid-template-columns:1fr 1fr;gap:88px}.faqIntro h2{font-size:clamp(36px,4.5vw,54px);font-weight:500;letter-spacing:-.05em}.faqIntro p{max-width:390px;color:var(--muted);font-size:15px;line-height:1.5;margin-top:14px}.faqGroup h3{border-bottom:1px solid #dddcd6;padding:16px 0;color:var(--muted);font-size:14px;font-weight:400}.faqGroup details{border-bottom:1px solid #dddcd6}.faqGroup summary{padding:18px 0;cursor:pointer;display:flex;justify-content:space-between;gap:16px;font-size:14px;font-weight:500;list-style:none}.faqGroup summary::-webkit-details-marker{display:none}.faqGroup summary span{font-size:18px;color:#888}.faqGroup details p{padding:0 0 18px;color:var(--muted);font-size:13px;line-height:1.55}.faqQuestions{display:flex;flex-direction:column;gap:18px}
.footer{padding:110px 0 0;background:#fff;overflow:hidden}.footerCta{text-align:center}.footerCta h2{font-size:clamp(36px,4.5vw,54px);font-weight:500;letter-spacing:-.05em}.footerCta p{color:var(--muted);margin:12px auto 20px}.footerNav{margin-top:90px;display:flex;flex-direction:column;align-items:center;gap:13px}.footerNav>div{display:flex;gap:24px;flex-wrap:wrap;justify-content:center}.footerNav a{text-decoration:none;font-size:13px;font-weight:500}.footerNav>div:last-child a{color:var(--muted);font-weight:400}.footerWordmark{font-size:clamp(110px,19vw,285px);line-height:.82;text-align:center;letter-spacing:-.09em;font-weight:500;margin-top:85px;color:#d4c7a2;white-space:nowrap;transform:translateY(16%)}
@media(max-width:900px){.navbar{top:20px}.desktopNav,.loginButton{display:none}.menuButton{display:block}.mobileNav{position:absolute;top:64px;left:0;right:0;background:#fff;border:1px solid #dddcd5;border-radius:18px;padding:15px;flex-direction:column;gap:2px;box-shadow:0 12px 30px #0001}.mobileNav a{padding:12px;text-decoration:none;font-size:14px}.mobileNavOpen{display:flex}.hero{padding-top:130px}.heroGrid{grid-template-columns:1fr;gap:48px}.heroPoints{padding:38px 0 0}.heroPoints>.dashedVertical{display:none}.heroMedia{height:560px}.featureIntro{grid-template-columns:1fr;gap:18px;margin-top:58px}.featureCard{grid-template-columns:1fr}.featureCell>.dashedVertical{display:none}.featureCell:not(:last-child){border-bottom:1px dashed #aaa}.featureVisual{height:320px}.resourceGrid>.resourceWide{width:100%;min-height:300px}.resourceWide>.dashedVertical{display:none}.resourceWide:first-of-type{border-bottom:1px dashed #aaa}.resourceBottom{grid-template-columns:1fr}.resourceBottom .resourceItem>.dashedVertical{display:none}.resourceBottom .resourceItem:not(:last-child){border-bottom:1px dashed #aaa}.pricingGrid{grid-template-columns:1fr}.faqGrid{grid-template-columns:1fr;gap:50px}.logoRows{grid-template-columns:repeat(2,1fr)}}
@media(max-width:600px){.container,.narrowContainer{width:calc(100% - 28px)}.topShell,.bottomShell{margin-left:6px;margin-right:6px}.topShell{border-radius:24px 24px 12px 12px}.bottomShell{border-radius:12px 12px 24px 24px}.navInner{padding:0 15px}.hero{padding-bottom:82px}.heroCopy p{font-size:21px}.heroActions{align-items:stretch;flex-direction:column}.heroMedia{height:500px;margin-right:-14px;border-radius:14px 0 0 14px}.logos{padding-bottom:88px}.logoRows{gap:22px 10px;margin-top:42px}.logoRows span{font-size:13px}.features{padding-bottom:90px}.measureLine>span:last-child{display:none}.featureCard{margin-top:45px}.featureCell{padding:16px}.featureVisual{height:220px}.featureCell h3{font-size:21px}.resource{padding-bottom:88px}.resourceGrid{margin-top:52px}.resourceItem{padding:24px 4px}.toolGrid{grid-template-columns:repeat(4,58px);gap:10px}.toolGrid span{width:58px;height:58px}.toolGrid img{max-width:34px;max-height:34px}.testimonials{padding-top:88px}.testimonialRail{margin-top:48px}.testimonialCard{flex-basis:82vw}.testimonialCard>img{height:270px}.pricing{padding:88px 0}.pricingGrid{margin-top:48px}.faq{padding:80px 0 95px}.footer{padding-top:88px}.footerNav{margin-top:62px}.footerWordmark{font-size:27vw}}
@media(prefers-reduced-motion:reduce){.page *{scroll-behavior:auto!important;transition:none!important}}
''')

notice_dir = ROOT / "third_party/mainline"
notice_dir.mkdir(parents=True, exist_ok=True)
shutil.copy2(repo / "LICENSE", notice_dir / "LICENSE")
(notice_dir / "SOURCE.md").write_text("# Mainline landing source\n\nSource: https://github.com/shadcnblocks/mainline-nextjs-template\nVersion verified during port: 1.2.0\nOnly landing-page assets/layout were adapted into WebCanBe; WebCanBe remains React/Vite rather than Next.js.\n")
