const DEFAULT_ORIGIN = "https://webcanbe.com"
const origin = new URL(process.env.WEBCANBE_SMOKE_ORIGIN || DEFAULT_ORIGIN)
const expectedDatabase = process.env.WEBCANBE_EXPECT_DATABASE || "either"
const allowedDatabaseExpectations = new Set(["either", "unconfigured", "ready"])

if (origin.protocol !== "https:") throw new Error("Production smoke origin must use HTTPS.")
if (!allowedDatabaseExpectations.has(expectedDatabase)) throw new Error("WEBCANBE_EXPECT_DATABASE must be either, unconfigured, or ready.")

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

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || "")
}

async function request(path, init = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    return await fetch(new URL(path, origin), {
      redirect: "follow",
      ...init,
      headers: {
        "User-Agent": "Webcanbe-Production-Smoke/1.0",
        ...(init.headers || {}),
      },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

async function readJson(response) {
  const text = await response.text()
  try { return JSON.parse(text || "{}") }
  catch { throw new Error(`Expected JSON from ${response.url}, received ${text.slice(0, 120)}`) }
}

async function run() {
  const root = await request("/", { headers: { Accept: "text/html" } })
  assert("root returns 200", root.status === 200, `status ${root.status}`)
  assert("HSTS enabled", (root.headers.get("strict-transport-security") || "").includes("max-age="), root.headers.get("strict-transport-security") || "missing")
  assert("nosniff enabled", root.headers.get("x-content-type-options") === "nosniff", root.headers.get("x-content-type-options") || "missing")
  assert("framing denied", root.headers.get("x-frame-options") === "DENY", root.headers.get("x-frame-options") || "missing")
  assert("popup-compatible COOP retained", root.headers.get("cross-origin-opener-policy") === "same-origin-allow-popups", root.headers.get("cross-origin-opener-policy") || "missing")
  const csp = root.headers.get("content-security-policy") || ""
  assert("CSP enforced", csp.includes("default-src 'self'") && csp.includes("script-src 'self'"), csp || "missing")
  assert("CSP blocks unsafe eval", !csp.includes("'unsafe-eval'"), csp || "missing")
  assert("request ID attached", isUuid(root.headers.get("x-request-id")), root.headers.get("x-request-id") || "missing")

  const missing = await request("/__webcanbe-smoke-missing-route", { headers: { Accept: "text/html" } })
  assert("unknown SPA route returns real 404", missing.status === 404, `status ${missing.status}`)
  assert("unknown route is noindex", (missing.headers.get("x-robots-tag") || "").includes("noindex"), missing.headers.get("x-robots-tag") || "missing")

  const dashboard = await request("/dashboard", { headers: { Accept: "text/html" } })
  assert("dashboard shell route resolves", dashboard.status === 200, `status ${dashboard.status}`)
  assert("dashboard is server-side noindex", (dashboard.headers.get("x-robots-tag") || "").includes("noindex"), dashboard.headers.get("x-robots-tag") || "missing")

  const robots = await request("/robots.txt")
  const robotsText = await robots.text()
  assert("robots.txt resolves", robots.status === 200, `status ${robots.status}`)
  assert("robots protects private/API routes", robotsText.includes("Disallow: /dashboard") && robotsText.includes("Disallow: /__webcanbe/"), "dashboard + API disallow rules")

  const sitemap = await request("/sitemap.xml")
  const sitemapText = await sitemap.text()
  assert("sitemap resolves", sitemap.status === 200, `status ${sitemap.status}`)
  assert("sitemap excludes private routes", !sitemapText.includes("/dashboard") && !sitemapText.includes("/settings"), "no dashboard/settings URLs")
  assert("sitemap includes public marketplace", sitemapText.includes("https://webcanbe.com/browse"), "browse route present")

  const postHeaders = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Origin: origin.origin,
  }
  const readiness = await request("/__webcanbe/ops/readiness", { method: "POST", headers: postHeaders, body: "{}" })
  const readinessBody = await readJson(readiness)
  assert("readiness stays Worker-owned", readinessBody.worker === "ok" && isUuid(readiness.headers.get("x-request-id")), `status ${readiness.status}, database ${readinessBody.database || "unknown"}`)

  const readinessText = JSON.stringify(readinessBody).toLowerCase()
  const sensitiveWords = ["connectionstring", "password", "credential", "database_url"]
  assert("readiness does not expose credentials", sensitiveWords.every(word => !readinessText.includes(word)), "bounded readiness payload")

  if (expectedDatabase === "unconfigured") {
    assert("database is intentionally unconfigured", readiness.status === 503 && readinessBody.database === "unconfigured" && readinessBody.schema === "unknown", `status ${readiness.status}, ${readinessBody.database}/${readinessBody.schema}`)
  } else if (expectedDatabase === "ready") {
    assert("database is production-ready", readiness.status === 200 && readinessBody.database === "ready" && readinessBody.schema === "ready", `status ${readiness.status}, ${readinessBody.database}/${readinessBody.schema}`)
  } else {
    assert("readiness has a valid deployment state", [200, 503].includes(readiness.status) && ["unconfigured", "unavailable", "reachable", "ready"].includes(readinessBody.database), `status ${readiness.status}, database ${readinessBody.database || "unknown"}`)
  }

  const catalog = await request("/__webcanbe/api/product/catalog/browse", { method: "POST", headers: postHeaders, body: "{}" })
  const catalogBody = await readJson(catalog)
  if (expectedDatabase === "unconfigured") {
    assert("catalog fails closed before Hyperdrive", catalog.status === 503 && catalogBody.error === "Product database is not configured.", `status ${catalog.status}`)
  } else if (expectedDatabase === "ready") {
    assert("catalog reads authoritative DB", catalog.status === 200 && Array.isArray(catalogBody.listings), `status ${catalog.status}`)
  } else {
    assert("catalog is Worker-owned", (catalog.status === 200 && Array.isArray(catalogBody.listings)) || (catalog.status === 503 && typeof catalogBody.error === "string"), `status ${catalog.status}`)
  }

  console.log(`\nProduction smoke complete: ${checks.length} checks, ${failures.length} failures.`)
  if (failures.length) process.exit(1)
}

run().catch(error => {
  console.error("Production smoke crashed:", error instanceof Error ? error.message : String(error))
  process.exit(1)
})
