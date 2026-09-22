import { chromium, firefox, webkit } from "playwright"

const origin = new URL(process.env.WEBCANBE_BROWSER_SMOKE_ORIGIN || "https://webcanbe.com")
if (origin.protocol !== "https:") throw new Error("Browser smoke origin must use HTTPS.")

const browsers = [
  ["chromium", chromium],
  ["firefox", firefox],
  ["webkit", webkit],
]

const viewports = [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
]

const routes = ["/", "/browse", "/plans", "/login", "/dashboard", "/projects", "/purchases", "/workspace/00000000-0000-4000-8000-000000000001", "/checkout/return?payment=return", "/checkout/return?payment=cancelled", "/updates", "/docs/security"]
const failures = []
let checks = 0

function pass(label) {
  checks += 1
  console.log("PASS  " + label)
}
function fail(label, detail) {
  checks += 1
  failures.push({ label, detail })
  console.error("FAIL  " + label + " — " + detail)
}
function assert(label, condition, detail) {
  if (condition) pass(label)
  else fail(label, detail)
}

for (const [browserName, browserType] of browsers) {
  const browser = await browserType.launch({ headless: true })
  try {
    for (const [viewportName, viewport] of viewports) {
      const context = await browser.newContext({
        viewport,
        colorScheme: "light",
        reducedMotion: "reduce",
      })
      try {
        const page = await context.newPage()
        const pageErrors = []
        page.on("pageerror", error => pageErrors.push(error.message))

        for (const route of routes) {
          pageErrors.length = 0
          const url = new URL(route, origin).href
          let response
          try {
            response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 })
            await page.waitForSelector("h1", { state: "attached", timeout: 7_000 }).catch(() => {})
            if (route === "/") await page.locator(".landing-react-host a[href]").first().waitFor({ state: "visible", timeout: 7_000 })
            if (route === "/plans") await page.locator(".plan-grid").waitFor({ state: "visible", timeout: 7_000 })
          } catch (error) {
            fail(`${browserName}/${viewportName} ${route} loads`, error instanceof Error ? error.message : String(error))
            continue
          }

          assert(
            `${browserName}/${viewportName} ${route} returns <400`,
            Boolean(response && response.status() < 400),
            `status ${response?.status() ?? "none"}`,
          )

          const state = await page.evaluate(() => {
            const interactive = element => {
              if (!(element instanceof HTMLElement)) return false
              const tag = element.tagName.toLowerCase()
              return tag === "a" || tag === "button" || tag === "input" || tag === "select" || tag === "textarea"
            }
            const buttonName = button => {
              if (!(button instanceof HTMLButtonElement)) return ""
              return (
                button.getAttribute("aria-label") ||
                button.getAttribute("title") ||
                button.textContent ||
                ""
              ).trim()
            }
            const inputName = input => {
              if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement || input instanceof HTMLTextAreaElement)) return ""
              const aria = input.getAttribute("aria-label") || input.getAttribute("title") || input.getAttribute("placeholder")
              if (aria?.trim()) return aria.trim()
              const id = input.getAttribute("id")
              const explicit = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent : ""
              const wrapping = input.closest("label")?.textContent
              return (explicit || wrapping || "").trim()
            }
            const namelessButtons = [...document.querySelectorAll('button:not([disabled]):not([aria-hidden="true"])')]
              .filter(button => !buttonName(button))
              .map(button => button.outerHTML.slice(0, 180))
            const namelessFields = [...document.querySelectorAll("input:not([type=hidden]),select,textarea")]
              .filter(field => !inputName(field))
              .map(field => field.outerHTML.slice(0, 180))
            const nav = performance.getEntriesByType("navigation")[0]
            return {
              textLength: document.body.innerText.trim().length,
              h1: document.querySelectorAll("h1").length,
              overflow: document.documentElement.scrollWidth - window.innerWidth,
              namelessButtons,
              namelessFields,
              dcl: nav && "domContentLoadedEventEnd" in nav ? nav.domContentLoadedEventEnd : 0,
              activeInteractive: interactive(document.activeElement),
            }
          })

          assert(`${browserName}/${viewportName} ${route} renders content`, state.textLength > 40, `text length ${state.textLength}`)
          assert(`${browserName}/${viewportName} ${route} has an h1`, state.h1 >= 1, `h1 count ${state.h1}`)
          assert(`${browserName}/${viewportName} ${route} has no meaningful horizontal overflow`, state.overflow <= 6, `overflow ${state.overflow}px`)
          assert(`${browserName}/${viewportName} ${route} buttons have accessible names`, state.namelessButtons.length === 0, state.namelessButtons.join(" | ") || "ok")
          assert(`${browserName}/${viewportName} ${route} fields have accessible names`, state.namelessFields.length === 0, state.namelessFields.join(" | ") || "ok")
          assert(`${browserName}/${viewportName} ${route} DCL stays within launch budget`, state.dcl > 0 && state.dcl < 12_000, `DCL ${Math.round(state.dcl)}ms`)
          assert(`${browserName}/${viewportName} ${route} has no uncaught page error`, pageErrors.length === 0, pageErrors.join(" | ") || "ok")

          await page.keyboard.press("Tab")
          const focus = await page.evaluate(() => {
            const el = document.activeElement
            if (!(el instanceof HTMLElement)) return { interactive: false, tag: "" }
            const tag = el.tagName.toLowerCase()
            return { interactive: ["a","button","input","select","textarea"].includes(tag), tag }
          })
          assert(`${browserName}/${viewportName} ${route} accepts keyboard focus`, focus.interactive, `active tag ${focus.tag || "none"}`)
          if (["/browse", "/login", "/checkout/return?payment=cancelled"].includes(route)) {
            await page.reload({ waitUntil: "domcontentloaded" })
            await page.locator("h1").first().waitFor({ state: "visible" })
            await page.goto(new URL("/docs/security", origin).href, { waitUntil: "domcontentloaded" })
            await page.goBack({ waitUntil: "domcontentloaded" })
            await page.locator("h1").first().waitFor({ state: "visible" })
            assert(`${browserName}/${viewportName} ${route} refresh/back restores route`, page.url() === url, page.url())
            await page.goForward({ waitUntil: "domcontentloaded" })
            assert(`${browserName}/${viewportName} ${route} forward restores route`, new URL(page.url()).pathname === "/docs/security", page.url())
          }
        }

        await page.goto(new URL("/login", origin).href, { waitUntil: "domcontentloaded", timeout: 25_000 })
        await page.waitForTimeout(250)
        const login = await page.evaluate(() => {
          const button = needle => [...document.querySelectorAll("button")].find(node => (node.textContent || "").includes(needle))
          const google = button("Continue with Google")
          const github = button("Continue with GitHub")
          const phone = button("Continue with phone")
          const dialog = document.querySelector(".auth-demo-modal")
          const close = document.querySelector(".auth-demo-close")
          return {
            googleSvg: google?.firstElementChild?.tagName.toLowerCase() === "svg",
            githubSvg: github?.firstElementChild?.tagName.toLowerCase() === "svg",
            phoneDisabled: phone instanceof HTMLButtonElement && phone.disabled,
            dialogLabelled: dialog?.getAttribute("aria-labelledby") === "wcb-auth-title",
            closeName: close?.getAttribute("aria-label") || "",
          }
        })
        assert(`${browserName}/${viewportName} login uses Google SVG mark`, login.googleSvg, "Google brand mark missing")
        assert(`${browserName}/${viewportName} login uses GitHub SVG mark`, login.githubSvg, "GitHub brand mark missing")
        assert(`${browserName}/${viewportName} unavailable phone login is disabled`, login.phoneDisabled, "phone login is interactive")
        assert(`${browserName}/${viewportName} auth dialog has labelled title`, login.dialogLabelled, "aria-labelledby missing")
        assert(`${browserName}/${viewportName} auth close control has a name`, login.closeName === "Close sign-in", `label ${login.closeName || "missing"}`)

        await page.goto(new URL("/plans", origin).href, { waitUntil: "domcontentloaded", timeout: 25_000 })
        await page.locator(".plan-grid").waitFor({ state: "visible", timeout: 7_000 })
        const configurationResponse = await page.request.get(new URL("/__webcanbe/api/payments/config", origin).href)
        if (!configurationResponse.ok()) throw new Error("Payment configuration is unavailable during browser verification.")
        const configuration = await configurationResponse.json()
        const plans = await page.evaluate(() => {
          const cards = [...document.querySelectorAll(".plan-grid article")]
          return {
            paid: cards.slice(1).map(card => ({ label: card.querySelector("button")?.textContent?.trim(), disabled: card.querySelector("button")?.disabled })),
            free: cards[0]?.querySelector("button")?.textContent?.includes("Start for free") && !cards[0]?.querySelector("button")?.disabled,
            available: document.body.innerText.includes("PayPal subscription checkout is available."),
            unavailable: document.body.innerText.includes("Paid checkout is currently unavailable"),
          }
        })
        const available = configuration.checkoutAvailable === true
        assert(`${browserName}/${viewportName} paid plan CTAs match server availability`, plans.paid.length === 2 && plans.paid.every((button, index) => button.disabled === !available && button.label === (available ? ["Choose Pro", "Choose Studio"][index] : "Checkout unavailable")), JSON.stringify(plans.paid))
        assert(`${browserName}/${viewportName} free plan remains actionable`, plans.free, "free plan CTA missing")
        assert(`${browserName}/${viewportName} plans explain authoritative billing state`, available ? plans.available && !plans.unavailable : plans.unavailable && !plans.available, "billing state differs from payment configuration")

        for (const path of ["/project/not-a-real-project", "/project/not-a-real-project/preview"]) {
          await page.goto(new URL(path, origin).href, { waitUntil: "domcontentloaded", timeout: 25_000 })
          await page.getByRole("link", { name: "Back to marketplace", exact: true }).waitFor({ timeout: 7_000 })
          const text = await page.locator("main").innerText()
          assert(`${browserName}/${viewportName} ${path} is truthfully unavailable`, /unavailable/i.test(text) && !/Northstar|Buy project|Public preview/.test(text), text.slice(0,200))
        }

      } finally {
        await context.close()
      }
    }
  } finally {
    await browser.close()
  }
}

console.log(`\nBrowser smoke complete: ${checks} checks, ${failures.length} failures.`)
if (failures.length) process.exit(1)
