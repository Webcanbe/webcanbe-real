// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, expect, it, vi } from "vitest"
import type { RequestCase } from "./hostedProductClient"
import { ControlRequests } from "./control-requests"

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const mocks = vi.hoisted(() => ({ queue: vi.fn(), mutate: vi.fn() }))
vi.mock("./hostedProductClient", () => ({ hostedProductClient: { controlRequestQueue: mocks.queue, controlMutateRequest: mocks.mutate } }))

const request: RequestCase = {
  requestId: "request-1", requestNumber: "WCB-1", requesterUserId: null, requesterEmail: null,
  category: "billing", subject: "Billing question", description: "A question", status: "open", priority: "normal",
  assignedOperatorUserId: null, references: {}, safeContext: {},
  createdAt: "2026-09-24T00:00:00Z", updatedAt: "2026-09-24T00:00:00Z", resolvedAt: null,
}

let host: HTMLDivElement, root: Root
afterEach(async () => { if (root) await act(async () => root.unmount()); host?.remove(); vi.clearAllMocks() })
const setup = async () => {
  mocks.queue.mockResolvedValue({ requests: [request], selected: request, events: [], operators: [] })
  mocks.mutate.mockResolvedValue(request)
  host = document.createElement("div"); document.body.append(host); root = createRoot(host)
  await act(async () => { root.render(<ControlRequests onBack={() => {}} />) })
  const control = (label: string) => [...host.querySelectorAll<HTMLElement>(".creator-select")]
    .find(element => element.querySelector("span")?.textContent === label)?.querySelector<HTMLButtonElement>('[role="combobox"]')
  return { control }
}

it("renders all request filters and actions as listboxes while preserving explicit Apply", async () => {
  const ui = await setup()
  expect(host.querySelector("select")).toBeNull()
  expect(host.querySelectorAll('[role="combobox"]')).toHaveLength(8)
  await act(async () => ui.control("Category")!.click())
  await act(async () => [...host.querySelectorAll<HTMLButtonElement>('[role="option"]')].find(option => option.textContent === "billing")!.click())
  expect(mocks.queue).toHaveBeenCalledTimes(1)
  await act(async () => [...host.querySelectorAll(".ops-filters>button")][0].dispatchEvent(new MouseEvent("click", { bubbles: true })))
  expect(mocks.queue).toHaveBeenLastCalledWith(expect.objectContaining({ category: "billing", assignment: "all" }))
})

it("does not mutate a request for the current choice, but uses the existing priority action for a change", async () => {
  const ui = await setup()
  await act(async () => ui.control("Change priority")!.click())
  await act(async () => [...host.querySelectorAll<HTMLButtonElement>('[role="option"]')].find(option => option.textContent === "normal")!.click())
  expect(mocks.mutate).not.toHaveBeenCalled()
  await act(async () => ui.control("Change priority")!.click())
  await act(async () => [...host.querySelectorAll<HTMLButtonElement>('[role="option"]')].find(option => option.textContent === "high")!.click())
  expect(mocks.mutate).toHaveBeenCalledWith("priority", { requestId: "request-1", priority: "high" })
})
