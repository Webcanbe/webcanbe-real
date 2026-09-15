import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const harness = readFileSync(new URL("../../scripts/qa/p39-native-macos.cjs", import.meta.url), "utf8")
const inputSourceProbe = readFileSync(new URL("../../scripts/qa/p39-input-source.swift", import.meta.url), "utf8")

describe("P39 macOS native evidence harness", () => {
  it("contains no synthetic composition, browser text insertion or paste substitute", () => {
    for (const prohibited of ["cdp.send(\"Input.", "insertText(", "dispatchEvent(", ".keyboard.", ".paste(", "typeText("]) {
      expect(harness).not.toContain(prohibited)
    }
    expect(harness).toContain("javascriptCompositionEvents: false")
    expect(harness).toContain("cdpCompositionEvents: false")
    expect(harness).toContain("playwrightInsertText: false")
    expect(harness).toContain("pasteAsIme: false")
  })

  it("requires the complete trusted IME lifecycle and exact product effect", () => {
    for (const event of ["compositionstart", "compositionupdate", "compositionend", "beforeinput", "input", "keydown", "keyup"]) {
      expect(harness).toContain(`\"${event}\"`)
    }
    expect(harness).toContain("event.trusted")
    expect(harness).toContain("trusted native Korean composition completion")
    expect(harness).toContain("native IME product effect")
    expect(harness).toContain("actual Korean 2-Set composition lifecycle completed through OS key events")
  })

  it("gates VoiceOver on a running process, focus navigation and trusted activation", () => {
    expect(harness).toContain("voiceOverProcess()")
    expect(harness).toContain('event.type === "focusin" && event.name === "Canvas"')
    expect(harness).toContain('event.type === "click" && event.name === "Canvas" && event.trusted')
    expect(harness).toContain("VoiceOver was not running at activation")
    expect(inputSourceProbe).toContain("TISCopyCurrentKeyboardInputSource")
    expect(inputSourceProbe).toContain("kTISPropertyInputSourceID")
  })
})
