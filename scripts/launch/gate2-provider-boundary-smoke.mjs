import { chromium } from "playwright"

const origin = new URL(process.env.WEBCANBE_GATE2_ORIGIN || "https://webcanbe.com")
if (origin.protocol !== "https:") throw new Error("Gate 2 provider smoke origin must use HTTPS.")

const gatePath = "/_ops/gate2-auth-smoke"
const forbiddenPaths = new Set([
  "/__webcanbe/auth/firebase-exchange",
  "/__webcanbe/api/account/identities/link/firebase",
])

const checks = []
const failures = []

function pass(label, detail = "") {
  checks.push({ label, detail })
  console.log(`PASS  ${label}${detail ? " — " + detail : ""}`)
}

function fail(label, detail) {
  failures.push({ label, detail })
  console.error(`FAIL  ${label} — ${detail}`)
}

function assert(label, condition, detail) {
  if (condition) pass(label, detail)
  else fail(label, detail)
}

function isOfficialGithubHost(value) {
  try {
    const host = new URL(value).hostname.toLowerCase()
    return host === "github.com" || host.endsWith(".github.com")
  } catch {
    return false
  }
}

const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    colorScheme: "light",
    reducedMotion: "reduce",
  })

  const forbiddenRequests = []
  context.on("request", request => {
    try {
      const url = new URL(request.url())
      if (url.origin === origin.origin && forbiddenPaths.has(url.pathname)) {
        forbiddenRequests.push(`${request.method()} ${url.pathname}`)
      }
    } catch {
      // Ignore non-URL requests.
    }
  })

  const page = await context.newPage()

  // This smoke checks only whether the deployed Firebase GitHub provider can
  // reach GitHub. The sessionStorage value bypasses the diagnostic page's
  // "linked provider" UX guard only; the popup is closed before credentials or
  // authorization, and server-side exchange/link endpoints are forbidden below.
  await page.addInitScript(() => {
    sessionStorage.setItem("wcb-gate2-linked-providers", JSON.stringify(["GitHub"]))
  })

  const response = await page.goto(new URL(gatePath, origin).href, {
    waitUntil: "domcontentloaded",
    timeout: 25_000,
  })
  assert("Gate 2 diagnostic resolves", Boolean(response && response.status() === 200), `status ${response?.status() ?? "none"}`)
  assert(
    "Gate 2 diagnostic is noindex",
    (response?.headers()["x-robots-tag"] || "").includes("noindex"),
    response?.headers()["x-robots-tag"] || "missing",
  )

  await page.getByRole("heading", { name: "Gate 2 authenticated read smoke" }).waitFor({ timeout: 10_000 })
  const githubButton = page.getByRole("button", { name: "Test linked GitHub" })
  await githubButton.waitFor({ state: "visible", timeout: 10_000 })
  assert("GitHub provider probe control is enabled", !(await githubButton.isDisabled()), "button disabled")

  const popupPromise = page.waitForEvent("popup", { timeout: 12_000 })
  await githubButton.click()
  const popup = await popupPromise

  let providerUrl = popup.url()
  const deadline = Date.now() + 20_000
  while (!isOfficialGithubHost(providerUrl) && Date.now() < deadline) {
    await popup.waitForTimeout(250)
    providerUrl = popup.url()
  }

  assert(
    "Firebase GitHub flow reaches the official GitHub provider boundary",
    isOfficialGithubHost(providerUrl),
    providerUrl || "popup never reached github.com",
  )

  // Stop at the provider boundary. Do not enter credentials and do not make an
  // authorization decision.
  await popup.close().catch(() => {})
  await page.waitForTimeout(350)

  assert(
    "Provider-boundary probe never exchanges or links an identity",
    forbiddenRequests.length === 0,
    forbiddenRequests.join(" | ") || "no exchange/link requests",
  )

  const cookies = await context.cookies(origin.origin)
  const firstPartySession = cookies.find(cookie => cookie.name === "__Host-wcb-session")
  assert(
    "Provider-boundary probe creates no Webcanbe first-party session",
    !firstPartySession,
    firstPartySession ? "unexpected __Host-wcb-session cookie" : "no first-party session cookie",
  )

  await context.close()
} finally {
  await browser.close()
}

console.log(`\nGate 2 provider-boundary smoke complete: ${checks.length} checks, ${failures.length} failures.`)
if (failures.length) process.exit(1)
