import { describe, expect, it } from "vitest"
import { analyzeReactSource, instrumentReactSource } from "./adapters/react/reactSourceAdapter"
import { isPreviewMessage, PREVIEW_CHANNEL } from "./bridge/previewProtocol"
import { summarizeCompatibility } from "./core/compatibility"
import { patchStyle, patchText, type SourceStore } from "./mutations/sourceMutations"

function memory(files: Record<string, string>): SourceStore & { files: Record<string, string> } {
  return { files, read: (file) => files[file], write: (file, content) => { files[file] = content } }
}

describe("React source mapping", () => {
  it("maps normal native JSX elements and only instruments the runtime copy", () => {
    const source = `export function Hero() { return <section className="hero"><h1>Build something real.</h1></section> }`
    const targets = analyzeReactSource("src/Hero.tsx", source, () => undefined)
    const heading = targets.find((target) => target.elementName === "h1")!
    expect(heading.identity.file).toBe("src/Hero.tsx")
    expect(heading.text).toBe("Build something real.")
    expect(instrumentReactSource("src/Hero.tsx", source)).toContain("data-wcb-id")
    expect(source).not.toContain("data-wcb-id")
  })

  it("does not claim dynamic text is a safe visual text edit", () => {
    const source = `export function Hero({ title }: { title: string }) { return <h1>{title}</h1> }`
    const target = analyzeReactSource("src/Hero.tsx", source, () => undefined)[0]
    expect(target.capabilities.text).toBe(false)
    expect(target.compatibility).toBe("partial")
  })
})

describe("minimal source mutation transactions", () => {
  it("patches static JSX text without touching the surrounding component", () => {
    const store = memory({ "src/Hero.tsx": `// preserve this\nexport function Hero() { return <h1>Build something real.</h1> }` })
    const target = analyzeReactSource("src/Hero.tsx", store.read("src/Hero.tsx")!, store.read)[0]
    const result = patchText(store, target.identity, "Build a real product.")
    expect(result.success).toBe(true)
    expect(store.files["src/Hero.tsx"]).toBe(`// preserve this\nexport function Hero() { return <h1>Build a real product.</h1> }`)
  })

  it("patches an external CSS declaration at its declaration range", () => {
    const store = memory({
      "src/Card.tsx": `import "./Card.css"\nexport function Card() { return <article className="card">Card</article> }`,
      "src/Card.css": `.card {\n  padding: 24px;\n  background-color: #fff;\n}\n`,
    })
    const target = analyzeReactSource("src/Card.tsx", store.read("src/Card.tsx")!, store.read)[0]
    const result = patchStyle(store, target.identity, "padding", "40px")
    expect(result.success).toBe(true)
    expect(store.files["src/Card.css"]).toContain("padding: 40px;")
    expect(store.files["src/Card.tsx"]).toContain("className=\"card\"")
  })

  it("patches a CSS Module declaration", () => {
    const store = memory({
      "src/Card.tsx": `import styles from "./Card.module.css"\nexport function Card() { return <article className={styles.card}>Card</article> }`,
      "src/Card.module.css": `.card { border-radius: 8px; }`,
    })
    const target = analyzeReactSource("src/Card.tsx", store.read("src/Card.tsx")!, store.read)[0]
    const result = patchStyle(store, target.identity, "borderRadius", "12px")
    expect(result.success).toBe(true)
    expect(store.files["src/Card.module.css"]).toContain("border-radius: 12px")
  })

  it("patches a safe inline style literal", () => {
    const store = memory({ "src/Note.tsx": `export function Note() { return <aside style={{ padding: 24, backgroundColor: "#ffffff" }}>Note</aside> }` })
    const target = analyzeReactSource("src/Note.tsx", store.read("src/Note.tsx")!, store.read)[0]
    const result = patchStyle(store, target.identity, "padding", "40")
    expect(result.success).toBe(true)
    expect(store.files["src/Note.tsx"]).toContain("padding: 40")
  })

  it("replaces a static Tailwind utility instead of adding an inline style", () => {
    const store = memory({ "src/Panel.tsx": `export function Panel() { return <section className="bg-black px-6 py-4 text-white">Panel</section> }` })
    const target = analyzeReactSource("src/Panel.tsx", store.read("src/Panel.tsx")!, store.read)[0]
    const result = patchStyle(store, target.identity, "paddingX", "40px")
    expect(result.success).toBe(true)
    expect(store.files["src/Panel.tsx"]).toContain("px-10")
    expect(store.files["src/Panel.tsx"]).not.toContain("style=")
  })
})

describe("compatibility and preview bridge validation", () => {
  it("derives a score from analyzed capabilities", () => {
    const source = `export function Page() { return <><h1>Hello</h1><h2>{"dynamic"}</h2></> }`
    const summary = summarizeCompatibility(analyzeReactSource("src/Page.tsx", source, () => undefined))
    expect(summary.total).toBe(2)
    expect(summary.score).toBeGreaterThan(0)
  })

  it("accepts only shaped preview messages", () => {
    expect(isPreviewMessage({ channel: PREVIEW_CHANNEL, type: "ready", session: "a" })).toBe(true)
    expect(isPreviewMessage({ channel: PREVIEW_CHANNEL, type: "select", session: "a" })).toBe(false)
    expect(isPreviewMessage({ channel: "other", type: "ready", session: "a" })).toBe(false)
  })
})
