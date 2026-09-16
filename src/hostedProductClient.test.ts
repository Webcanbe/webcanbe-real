import { describe, expect, it } from "vitest"
import { HostedProductClient, HostedProductError } from "./hostedProductClient"

type Seen = { path: string; body: Record<string, unknown>; headers: Headers }
const response = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

function fixture(replies: Array<[string, Record<string, unknown>, number?]>) {
  const seen: Seen[] = []
  const request = async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input), body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>, headers = new Headers(init?.headers)
    seen.push({ path, body, headers })
    const next = replies.shift()
    if (!next || next[0] !== path) throw new Error(`Unexpected request: ${path}`)
    return response(next[2] ?? 200, next[1])
  }
  return { client: new HostedProductClient(request), seen, remaining: replies }
}

describe("hosted product route adapter", () => {
  it("reads browse and listing detail only through the authenticated controller", async () => {
    const f = fixture([
      ["/__webcanbe/auth/session", { csrf: "csrf-1" }],
      ["/__webcanbe/api/product/catalog/browse", { listings: [{ listingId: "listing-1", releaseId: "release-1", slug: "real-project", title: "Real Project" }] }],
      ["/__webcanbe/api/product/catalog/detail", { listing: { listingId: "listing-1", releaseId: "release-1", slug: "real-project", title: "Real Project" } }],
    ])
    expect(await f.client.browse({ query: "real", tags: ["React"], limit: 20 })).toMatchObject([{ releaseId: "release-1" }])
    expect(await f.client.detail("real-project")).toMatchObject({ listingId: "listing-1", releaseId: "release-1" })
    expect(f.seen.slice(1).every(call => call.headers.get("X-WCB-CSRF") === "csrf-1")).toBe(true)
    expect(f.seen[1].body).toEqual({ query: "real", tags: ["React"], limit: 20 })
    expect(f.remaining).toHaveLength(0)
  })

  it("uses the existing entitlement contract and repeats materialization idempotently", async () => {
    const entitlement = { entitlementId: "entitlement-1", releaseId: "release-1", status: "active" }
    const copy = { workspaceProjectId: "copy-1", entitlementId: "entitlement-1", releaseId: "release-1" }
    const f = fixture([
      ["/__webcanbe/auth/session", { csrf: "csrf-2" }],
      ["/__webcanbe/api/product/purchases", { entitlements: [] }],
      ["/__webcanbe/api/product/entitlements/test/grant-self", { entitlement }, 201],
      ["/__webcanbe/api/workspaces", { workspaces: ["workspace-1"] }],
      ["/__webcanbe/api/product/workspace-projects/materialize", { workspaceProject: copy }, 201],
      ["/__webcanbe/api/product/purchases", { entitlements: [entitlement] }],
      ["/__webcanbe/api/workspaces", { workspaces: ["workspace-1"] }],
      ["/__webcanbe/api/product/workspace-projects/materialize", { workspaceProject: copy }, 201],
    ])
    expect(await f.client.purchaseAndMaterialize("release-1", "Real Project")).toEqual(copy)
    expect(await f.client.purchaseAndMaterialize("release-1", "Real Project")).toEqual(copy)
    const grants = f.seen.filter(call => call.path.endsWith("/entitlements/test/grant-self")), copies = f.seen.filter(call => call.path.endsWith("/workspace-projects/materialize"))
    expect(grants).toHaveLength(1)
    expect(grants[0].body).toEqual({ releaseId: "release-1", idempotencyKey: "route-grant:release-1" })
    expect(copies).toHaveLength(2)
    expect(copies[0].body).toEqual(copies[1].body)
    expect(copies[0].body).toMatchObject({ workspaceId: "workspace-1", entitlementId: "entitlement-1", idempotencyKey: "route-copy:entitlement-1" })
  })

  it("keeps purchases and owned workspace projects as separate hosted reads", async () => {
    const f = fixture([
      ["/__webcanbe/auth/session", { csrf: "csrf-3" }],
      ["/__webcanbe/api/product/purchases", { entitlements: [{ entitlementId: "entitlement-1", releaseId: "release-1" }] }],
      ["/__webcanbe/api/product/workspace-projects/list", { workspaceProjects: [{ workspaceProjectId: "copy-1", entitlementId: "entitlement-1", releaseId: "release-1" }] }],
    ])
    expect(await f.client.purchases()).toHaveLength(1)
    expect(await f.client.workspaceProjects()).toHaveLength(1)
    expect(f.seen.map(call => call.path)).toContain("/__webcanbe/api/product/workspace-projects/list")
  })

  it("refuses unauthenticated product access before issuing a product request", async () => {
    const f = fixture([["/__webcanbe/auth/session", { error: "Sign in to continue." }, 403]])
    await expect(f.client.browse()).rejects.toEqual(new HostedProductError(403, "Sign in to continue."))
    expect(f.seen).toHaveLength(1)
  })
})
