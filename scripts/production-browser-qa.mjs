import fs from "node:fs/promises"
import path from "node:path"
import { createRequire } from "node:module"
import puppeteer from "puppeteer-core"

const require = createRequire(import.meta.url)
const axe = require("axe-core")

const origin = new URL(process.env.WEBCANBE_BROWSER_ORIGIN || "https://webcanbe.com")
const chrome = process.env.CHROME_BIN
if (!chrome) throw new Error("CHROME_BIN is required.")

const outDir = ".production-browser-qa"
await fs.mkdir(outDir, { recursive: true })

const routes = [
  { path: "/", name: "home" },
  { path: "/browse", name: "browse" },
  { path: "/docs", name: "docs" },
  { path: "/plans", name: "plans" },
  { path: "/policy", name: "policy" },
]
const viewports = [
  { name: "desktop", width: 1440, height: 900, deviceScaleFactor: 1 },
  { name: "mobile", width: 390, height: 844, deviceScaleFactor: 1 },
]
const failingImpacts = new Set(["critical", "serious"])
const report = { origin: origin.origin, generatedAt: new Date().toISOString(), pages: [], failures: [] }

function safeName(value) {
  return value.replace(/[^a-z0-9_-]+/gi, "-")
}

function addFailure(page, kind, detail) {
  report.failures.push({ page, kind, detail })
  console.error(`FAIL  ${page} — ${kind}: ${detail}`)
}

async function inspectFocus(page) {
  const stops = []
  let visibleIndicator = false
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press("Tab")
    const state = await page.evaluate(() => {
      const el = document.activeElement
      if (!(el instanceof HTMLElement) || el === document.body) return null
      const style = getComputedStyle(el)
      const text = (
        el.getAttribute("aria-label") ||
        el.getAttribute("title") ||
        el.textContent ||
        el.getAttribute("placeholder") ||
        ""
      ).trim().replace(/\s+/g, " ").slice(0, 120)
      const outlineWidth = Number.parseFloat(style.outlineWidth || "0")
      const focusVisible = (style.outlineStyle !== "none" && outlineWidth > 0) || style.boxShadow !== "none"
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || "",
        text,
        focusVisible,
      }
    })
    if (!state) continue
    const key = `${state.tag}#${state.id}:${state.text}`
    if (!stops.some(item => item.key === key)) stops.push({ key, ...state })
    if (state.focusVisible) visibleIndicator = true
  }
  return { stops, visibleIndicator }
}

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
})

try {
  for (const viewport of viewports) {
    for (const route of routes) {
      const label = `${route.name}-${viewport.name}`
      const page = await browser.newPage()
      await page.setViewport(viewport)

      const consoleErrors = []
      const pageErrors = []
      const requestFailures = []
      page.on("console", message => {
        if (message.type() === "error") consoleErrors.push(message.text())
      })
      page.on("pageerror", error => pageErrors.push(error.message))
      page.on("requestfailed", request => {
        const url = request.url()
        if (url.startsWith(origin.origin)) requestFailures.push(`${request.method()} ${url}: ${request.failure()?.errorText || "failed"}`)
      })

      const url = new URL(route.path, origin).toString()
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 })
      await page.waitForFunction(() => document.body && document.body.innerText.trim().length > 80, { timeout: 15_000 })
      await new Promise(resolve => setTimeout(resolve, 700))

      const layout = await page.evaluate(() => {
        const doc = document.documentElement
        const viewportMeta = document.querySelector('meta[name="viewport"]')?.getAttribute("content") || ""
        return {
          title: document.title,
          bodyTextLength: document.body.innerText.trim().length,
          clientWidth: doc.clientWidth,
          scrollWidth: doc.scrollWidth,
          viewportMeta,
        }
      })

      await page.addScriptTag({ content: axe.source })
      const axeResult = await page.evaluate(async () => {
        return await window.axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
        })
      })
      const violations = axeResult.violations.map(violation => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        nodes: violation.nodes.length,
        targets: violation.nodes.slice(0, 5).map(node => node.target),
      }))
      const focus = await inspectFocus(page)

      const screenshot = path.join(outDir, `${safeName(label)}.png`)
      await page.screenshot({ path: screenshot, fullPage: true })

      const pageReport = {
        label,
        url,
        status: response?.status() ?? null,
        layout,
        focus,
        violations,
        consoleErrors,
        pageErrors,
        requestFailures,
      }
      report.pages.push(pageReport)

      if (!response || response.status() >= 400) addFailure(label, "navigation", `HTTP ${response?.status() ?? "no response"}`)
      if (layout.bodyTextLength < 80) addFailure(label, "content", "page rendered without meaningful text")
      if (!layout.viewportMeta.includes("width=device-width")) addFailure(label, "viewport", `viewport meta is "${layout.viewportMeta}"`)
      if (layout.scrollWidth > layout.clientWidth + 2) addFailure(label, "horizontal-overflow", `${layout.scrollWidth}px > ${layout.clientWidth}px`)
      if (pageErrors.length) addFailure(label, "pageerror", pageErrors.join(" | "))
      if (requestFailures.length) addFailure(label, "same-origin-request-failure", requestFailures.join(" | "))
      if (consoleErrors.length) addFailure(label, "console-error", consoleErrors.slice(0, 5).join(" | "))
      if (focus.stops.length < 3) addFailure(label, "keyboard-focus", `only ${focus.stops.length} distinct tab stops found`)
      if (!focus.visibleIndicator) addFailure(label, "focus-visible", "no visible focus indicator found across sampled tab stops")
      for (const violation of violations) {
        console.log(`A11Y ${label} ${violation.impact || "unknown"} ${violation.id} nodes=${violation.nodes}`)
        if (failingImpacts.has(violation.impact)) addFailure(label, `a11y-${violation.impact}`, `${violation.id}: ${violation.help} (${violation.nodes} nodes)`)
      }

      console.log(`PASS? ${label} status=${pageReport.status} text=${layout.bodyTextLength} width=${layout.scrollWidth}/${layout.clientWidth} focus=${focus.stops.length} a11y=${violations.length}`)
      await page.close()
    }
  }
} finally {
  await browser.close()
}

await fs.writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2))
console.log(`Browser QA complete: ${report.pages.length} page/viewport checks, ${report.failures.length} failures.`)
if (report.failures.length) process.exit(1)
