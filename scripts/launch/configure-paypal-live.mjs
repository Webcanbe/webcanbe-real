import { randomUUID } from "node:crypto"
import { spawnSync } from "node:child_process"
import { createInterface } from "node:readline/promises"
import { stdin as input, stdout as output } from "node:process"

const API = "https://api-m.paypal.com"
const WEBHOOK_ID = "7T758752LK1378010"
const PRODUCT_NAME = "Webcanbe Subscriptions"
const ORIGIN = "https://webcanbe.com"

const plans = Object.freeze([
  { env: "PAYPAL_PLAN_PRO_MONTHLY", key: "pro_monthly", name: "Webcanbe Pro Monthly", interval: "MONTH", price: "12.00" },
  { env: "PAYPAL_PLAN_PRO_ANNUAL", key: "pro_annual", name: "Webcanbe Pro Annual", interval: "YEAR", price: "120.00" },
  { env: "PAYPAL_PLAN_STUDIO_MONTHLY", key: "studio_monthly", name: "Webcanbe Studio Monthly", interval: "MONTH", price: "29.00" },
  { env: "PAYPAL_PLAN_STUDIO_ANNUAL", key: "studio_annual", name: "Webcanbe Studio Annual", interval: "YEAR", price: "290.00" },
])

function fail(message) {
  console.error(message)
  process.exit(1)
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: options.input === undefined ? "inherit" : ["pipe","inherit","inherit"], input: options.input, encoding: "utf8", env: process.env })
  if (result.status !== 0) fail(`Command failed: ${command} ${args.join(" ")}`)
}

async function readCredential(label, envKey, secret = false) {
  const existing = process.env[envKey]?.trim()
  if (existing) return existing
  const rl = createInterface({ input, output })
  try {
    const value = (await rl.question(`${label}: `)).trim()
    if (!value) fail(`${label} is required.`)
    if (secret) output.write("\x1b[1A\x1b[2K")
    return value
  } finally {
    rl.close()
  }
}

async function paypal(path, token, options = {}) {
  const response = await fetch(API + path, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(options.body === undefined ? {} : { "Content-Type": "application/json", Prefer: "return=representation" }),
      ...(options.requestId ? { "PayPal-Request-Id": options.requestId } : {}),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  })
  let body
  try { body = await response.json() } catch { body = undefined }
  if (!response.ok) {
    const debug = body?.debug_id ? ` debug_id=${body.debug_id}` : ""
    throw new Error(`PayPal ${options.method || "GET"} ${path} failed (${response.status}).${debug}`)
  }
  return body
}

async function accessToken(clientId, clientSecret) {
  const response = await fetch(API + "/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || typeof body.access_token !== "string") {
    fail(`Live PayPal credentials were rejected (${response.status})${body.debug_id ? ` debug_id=${body.debug_id}` : ""}.`)
  }
  return body.access_token
}

async function listAll(path, key, token) {
  const items = []
  for (let page = 1; page <= 10; page += 1) {
    const separator = path.includes("?") ? "&" : "?"
    const body = await paypal(`${path}${separator}page_size=20&page=${page}&total_required=true`, token)
    const next = Array.isArray(body?.[key]) ? body[key] : []
    items.push(...next)
    if (next.length < 20) break
  }
  return items
}

async function ensureProduct(token) {
  const products = await listAll("/v1/catalogs/products", "products", token)
  const existing = products.find(product => product?.name === PRODUCT_NAME && typeof product?.id === "string")
  if (existing) return existing.id
  const created = await paypal("/v1/catalogs/products", token, {
    method: "POST",
    requestId: `webcanbe-live-product-${randomUUID()}`,
    body: {
      name: PRODUCT_NAME,
      description: "Webcanbe workspace subscription plans",
      type: "SERVICE",
    },
  })
  if (typeof created?.id !== "string") fail("PayPal created a product without an ID.")
  return created.id
}

function planMatches(plan, spec, productId) {
  if (!plan || plan.product_id !== productId) return false
  const cycle = Array.isArray(plan.billing_cycles) ? plan.billing_cycles.find(item => item?.tenure_type === "REGULAR") : undefined
  const fixed = cycle?.pricing_scheme?.fixed_price
  return cycle?.frequency?.interval_unit === spec.interval &&
    Number(cycle?.frequency?.interval_count) === 1 &&
    Number(cycle?.total_cycles) === 0 &&
    fixed?.currency_code === "USD" &&
    Number(fixed?.value) === Number(spec.price)
}

async function ensurePlan(token, productId, spec) {
  const summaries = await listAll(`/v1/billing/plans?product_id=${encodeURIComponent(productId)}`, "plans", token)
  for (const summary of summaries.filter(item => item?.name === spec.name && typeof item?.id === "string").reverse()) {
    const detail = await paypal(`/v1/billing/plans/${encodeURIComponent(summary.id)}`, token)
    if (!planMatches(detail, spec, productId)) continue
    if (detail.status !== "ACTIVE") {
      await paypal(`/v1/billing/plans/${encodeURIComponent(summary.id)}/activate`, token, { method: "POST" })
    }
    return summary.id
  }
  const created = await paypal("/v1/billing/plans", token, {
    method: "POST",
    requestId: `webcanbe-live-${spec.key}-${randomUUID()}`,
    body: {
      product_id: productId,
      name: spec.name,
      description: `Webcanbe ${spec.key.replaceAll("_"," ")} subscription`,
      billing_cycles: [{
        frequency: { interval_unit: spec.interval, interval_count: 1 },
        tenure_type: "REGULAR",
        sequence: 1,
        total_cycles: 0,
        pricing_scheme: { fixed_price: { value: spec.price, currency_code: "USD" } },
      }],
      payment_preferences: {
        auto_bill_outstanding: true,
        payment_failure_threshold: 3,
      },
    },
  })
  if (typeof created?.id !== "string") fail(`${spec.name} was created without a plan ID.`)
  if (created.status !== "ACTIVE") await paypal(`/v1/billing/plans/${encodeURIComponent(created.id)}/activate`, token, { method: "POST" })
  return created.id
}

function putSecrets(values) {
  const command = process.platform === "win32" ? "npx.cmd" : "npx"
  run(command, ["--yes","wrangler@4","versions","secret","bulk"], { input: JSON.stringify(values) })
}

function deployNewestSecretVersion() {
  const command = process.platform === "win32" ? "npx.cmd" : "npx"
  const listed = spawnSync(command, ["--yes","wrangler@4","versions","list","--json"], { encoding: "utf8", env: process.env })
  if (listed.status !== 0) fail("Could not list Worker versions after publishing secrets.")
  let versions
  try { versions = JSON.parse(listed.stdout) } catch { fail("Wrangler returned invalid versions JSON.") }
  const rows = Array.isArray(versions) ? versions : Array.isArray(versions?.versions) ? versions.versions : []
  const latest = rows[0]
  const id = latest?.id || latest?.version_id || latest?.versionId
  if (typeof id !== "string" || !id) fail("Could not resolve the newest Worker version ID.")
  run(command, ["--yes","wrangler@4","versions","deploy",`${id}@100%`,"-y"])
}

async function verifyProduction() {
  let last
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      const [diagnosticResponse, configResponse] = await Promise.all([
        fetch(ORIGIN + "/__webcanbe/api/payments/diagnostic", { cache: "no-store" }),
        fetch(ORIGIN + "/__webcanbe/api/payments/config", { cache: "no-store" }),
      ])
      const diagnostic = await diagnosticResponse.json()
      const config = await configResponse.json()
      last = { diagnostic, config }
      const keys = [
        "WEBCANBE_PAYMENTS","PAYPAL_ENVIRONMENT_PRESENT","PAYPAL_CLIENT_ID","PAYPAL_CLIENT_SECRET",
        "PAYPAL_WEBHOOK_ID","PAYPAL_PLAN_PRO_MONTHLY","PAYPAL_PLAN_PRO_ANNUAL",
        "PAYPAL_PLAN_STUDIO_MONTHLY","PAYPAL_PLAN_STUDIO_ANNUAL","paymentConfigured",
      ]
      if (keys.every(key => diagnostic[key] === true) &&
          diagnostic.PAYPAL_ENVIRONMENT_VALUE === "live" &&
          config.checkoutAvailable === true &&
          config.environment === "live") {
        return { diagnostic, config }
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 5000))
  }
  console.error("Production payment verification did not become ready.", JSON.stringify(last))
  process.exit(1)
}

const clientId = await readCredential("PayPal Live Client ID", "PAYPAL_CLIENT_ID")
const clientSecret = await readCredential("PayPal Live Client Secret", "PAYPAL_CLIENT_SECRET", true)
const token = await accessToken(clientId, clientSecret)
const productId = await ensureProduct(token)

const resolved = {}
for (const spec of plans) {
  resolved[spec.env] = await ensurePlan(token, productId, spec)
}

console.log("Live PayPal catalog ready.")
console.log(`PRODUCT_ID=${productId}`)
for (const spec of plans) console.log(`${spec.env}=${resolved[spec.env]}`)

console.log("Publishing Worker secrets/bindings…")
putSecrets({
  PAYPAL_CLIENT_ID: clientId,
  PAYPAL_CLIENT_SECRET: clientSecret,
  ...resolved,
})

console.log("Deploying the newest secret-bearing Worker version…")
deployNewestSecretVersion()

console.log("Building and deploying current Webcanbe Worker…")
run(process.platform === "win32" ? "npm.cmd" : "npm", ["run","build"])
run(process.platform === "win32" ? "npx.cmd" : "npx", ["--yes","wrangler@4","deploy"])

await verifyProduction()
console.log("PAYPAL_LIVE=ready")
console.log("CHECKOUT_AVAILABLE=true")
console.log("PAYPAL_ENVIRONMENT=live")
console.log(`PAYPAL_WEBHOOK_ID=${WEBHOOK_ID}`)
