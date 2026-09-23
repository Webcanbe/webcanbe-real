import fs from "node:fs"
import { expect, it } from "vitest"
import { analyzeProjectStyles } from "./adapters/react/projectStyles"
import { patchProjectStyle, patchText, type SourceStore } from "./mutations/sourceMutations"

for (const slug of ["aperture-north", "stillform"]) {
  it(`${slug} exposes source-mapped text and styles in its real template files`, () => {
    const files = new Map([
      ["src/main.tsx", fs.readFileSync(`fixtures/${slug}/src/main.tsx`, "utf8")],
      ["src/style.css", fs.readFileSync(`fixtures/${slug}/src/style.css`, "utf8")],
    ])
    const store: SourceStore = {
      tailwind: false,
      read: file => files.get(file),
      write: (file, value, expected) => { expect(files.get(file)).toBe(expected); files.set(file, value) },
    }
    const original = analyzeProjectStyles(files, false).targets
    const textSamples = slug === "aperture-north"
      ? ["Making the everyday", "A small studio, worldwide", "Start a conversation"]
      : ["Independent architecture & interiors", "The way we see it", "A new beginning"]
    for (const [index, text] of textSamples.entries()) {
      const target = analyzeProjectStyles(files, false).targets.find(item => item.text === text)
      expect(target, `${slug}: ${text} should be source mapped`).toBeDefined()
      const result = patchText(store, target!.identity, `Edited section ${index + 1}`)
      expect(result.success, result.error).toBe(true)
    }
    const styleSamples = slug === "aperture-north" ? ["site-header", "intro", "contact"] : ["site-header", "intro", "journal-copy"]
    for (const [index, className] of styleSamples.entries()) {
      const target = analyzeProjectStyles(files, false).targets.find(item => item.classNames?.includes(className) && item.styleOrigins.some(origin => origin.property === "padding" && origin.editable))
      expect(target, `${slug}: ${className} should have an editable padding origin`).toBeDefined()
      const result = patchProjectStyle(store, files, target!.identity, "padding", `${32 + index * 8}px`, { scope: "source" })
      expect(result.success, result.error).toBe(true)
    }
    expect(files.get("src/main.tsx")).toContain("Edited section 3")
    expect(files.get("src/style.css")).toContain("48px")
    expect(original.length).toBeGreaterThan(20)
  })
}
