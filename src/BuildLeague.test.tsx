// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, expect, it, vi } from "vitest"
import { BuildLeagueEvent } from "./BuildLeague"

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const mocks = vi.hoisted(() => ({ sourceProjects: vi.fn(), state: vi.fn(), leaderboard: vi.fn() }))
vi.mock("./hostedProductClient", () => ({ hostedProductClient: {
  buildLeagueLeaderboard: mocks.leaderboard, buildLeagueState: mocks.state, sourceProjects: mocks.sourceProjects,
}, productReadMode: () => true }))
vi.mock("./analytics", () => ({ analytics: { capture: vi.fn() } }))

let host: HTMLDivElement, root: Root
afterEach(async () => { if (root) await act(async () => root.unmount()); host?.remove(); vi.clearAllMocks() })

it("selects an owned final-entry project by keyboard without a native select", async () => {
  mocks.leaderboard.mockResolvedValue({ leaders: [], weights: null })
  mocks.state.mockResolvedValue({ counts: {}, stage: 1, points: 0, actions: 0, milestones: [], recent: [], referralCode: "abcdefghijkl", uniqueReferredVisits: 0, entry: null })
  mocks.sourceProjects.mockResolvedValue([{ id: "owned-project", name: "Owned project" }])
  host = document.createElement("div"); document.body.append(host); root = createRoot(host)
  await act(async () => { root.render(<BuildLeagueEvent />) })
  expect(host.textContent).toContain("WEBCANBE EVENT")
  expect(host.textContent).not.toMatch(/leaderboard|points|stage|league/i)
  const trigger = host.querySelector<HTMLButtonElement>('.bl-entry [role="combobox"]')!
  expect(trigger).toBeTruthy()
  expect(host.querySelector('.bl-entry select')).toBeNull()
  expect(trigger.textContent).toContain("Select a project")
  await act(async () => trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })))
  const placeholder = host.querySelector<HTMLButtonElement>('.bl-entry [role="option"]')!
  await act(async () => placeholder.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })))
  const project = [...host.querySelectorAll<HTMLButtonElement>('.bl-entry [role="option"]')].find(option => option.textContent === "Owned project")!
  expect(document.activeElement).toBe(project)
  await act(async () => project.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })))
  expect(trigger.textContent).toContain("Owned project")
  expect(trigger.getAttribute("aria-expanded")).toBe("false")
})
