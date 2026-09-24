// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { act, useState } from "react"
import { createRoot, type Root } from "react-dom/client"
import { CreatorSelect } from "./creator-select"

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

let host: HTMLDivElement, root: Root
afterEach(async () => { if (root) await act(async () => root.unmount()); host?.remove() })

const setup = async (options = [{ value: "available", label: "Available" }, { value: "unavailable", label: "Unavailable" }]) => {
  host = document.createElement("div")
  document.body.append(host)
  root = createRoot(host)
  const onChange = vi.fn()
  function Fixture() { const [value, setValue] = useState(options[0]?.value || ""); return <CreatorSelect label="Availability" value={value} options={options} onChange={next => { onChange(next); setValue(next) }} /> }
  await act(async () => root.render(<Fixture />))
  return { onChange, trigger: () => host.querySelector<HTMLButtonElement>('[role="combobox"]')!, options: () => [...host.querySelectorAll<HTMLButtonElement>('[role="option"]')] }
}

describe("CreatorSelect", () => {
  it("selects with arrow keys and Enter, then reopens with the saved option selected", async () => {
    const ui = await setup()
    const names = ui.trigger().getAttribute("aria-labelledby")!.split(" ")
    expect(names.map(id => document.getElementById(id)?.textContent)).toEqual(["Availability", "Available"])
    await act(async () => ui.trigger().click())
    expect(ui.trigger().getAttribute("aria-expanded")).toBe("true")
    expect(ui.options()[0].getAttribute("aria-selected")).toBe("true")
    await act(async () => ui.options()[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })))
    expect(document.activeElement).toBe(ui.options()[1])
    await act(async () => ui.options()[1].dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })))
    expect(ui.onChange).toHaveBeenCalledWith("unavailable")
    expect(ui.trigger().getAttribute("aria-expanded")).toBe("false")
    expect(ui.trigger().textContent).toContain("Unavailable")
    await act(async () => ui.trigger().click())
    expect(ui.options()[1].getAttribute("aria-selected")).toBe("true")
  })

  it("closes with Escape and outside interaction without changing the value", async () => {
    const ui = await setup()
    await act(async () => ui.trigger().click())
    await act(async () => ui.options()[0].dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })))
    expect(ui.trigger().getAttribute("aria-expanded")).toBe("false")
    expect(document.activeElement).toBe(ui.trigger())
    await act(async () => ui.trigger().click())
    await act(async () => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })))
    expect(ui.trigger().getAttribute("aria-expanded")).toBe("false")
    expect(ui.onChange).not.toHaveBeenCalled()
  })

  it("disables the control when no options exist", async () => {
    const ui = await setup([])
    expect(ui.trigger().disabled).toBe(true)
    expect(ui.trigger().textContent).toContain("No options available")
  })

  it("supports Home, End, Space, and Tab without changing a selected value", async () => {
    const ui = await setup([{ value: "one", label: "One" }, { value: "two", label: "Two" }, { value: "three", label: "Three" }])
    await act(async () => ui.trigger().dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true })))
    await act(async () => ui.options()[0].dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true })))
    expect(document.activeElement).toBe(ui.options()[2])
    await act(async () => ui.options()[2].dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true })))
    expect(document.activeElement).toBe(ui.options()[0])
    await act(async () => ui.options()[0].dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })))
    expect(ui.onChange).not.toHaveBeenCalled()
    await act(async () => ui.trigger().click())
    await act(async () => ui.options()[0].dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true })))
    expect(ui.trigger().getAttribute("aria-expanded")).toBe("false")
    expect(ui.onChange).not.toHaveBeenCalled()
  })
})
