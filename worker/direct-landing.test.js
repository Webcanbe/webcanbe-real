import { describe, expect, it, vi } from "vitest"
import worker from "./index.js"

describe("direct retained landing delivery", () => {
  it("serves the retained self-hosted landing directly at root without booting the SPA document", async () => {
    const assetFetch = vi.fn(async request => {
      const path = new URL(request.url).pathname
      if (path === "/wcb-landing/index.html") {
        return new Response("<!doctype html><html><body><h1>Retained landing</h1></body></html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        })
      }
      return new Response("spa", { status: 200, headers: { "Content-Type": "text/html" } })
    })
    const response = await worker.fetch(
      new Request("https://webcanbe.com/", { headers: { Accept: "text/html" } }),
      { ASSETS: { fetch: assetFetch } },
    )
    expect(response.status).toBe(200)
    expect(await response.text()).toContain("Retained landing")
    expect(assetFetch).toHaveBeenCalledTimes(1)
    expect(new URL(assetFetch.mock.calls[0][0].url).pathname).toBe("/wcb-landing/index.html")
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'self'")
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff")
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=0, must-revalidate")
  })

  it("leaves non-root application routes on the SPA asset path", async () => {
    const assetFetch = vi.fn(async request => new Response("spa:" + new URL(request.url).pathname, {
      status: 200,
      headers: { "Content-Type": "text/html" },
    }))
    const response = await worker.fetch(
      new Request("https://webcanbe.com/browse", { headers: { Accept: "text/html" } }),
      { ASSETS: { fetch: assetFetch } },
    )
    expect(await response.text()).toContain("spa:/browse")
    expect(new URL(assetFetch.mock.calls[0][0].url).pathname).toBe("/browse")
  })
})
