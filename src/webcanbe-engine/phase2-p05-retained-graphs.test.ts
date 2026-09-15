import { expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { normalizeAlternateLock, parseYarnBerry, parseYarnClassic } from "./runtime/alternateLockfiles"
import { parseBunBinary } from "./runtime/bunBinaryLock"
import { inspectRuntime } from "./runtime/runtimeCompatibility"
import { detectProject, type ProjectRecord } from "./runtime/projectRegistry"
import { MutationHistory } from "./mutations/sourceMutations"
import { buildIsolatedHttpPreview } from "./runtime/isolatedPreview"
import semver from "semver"

const fixture = (name: string) => path.join(process.env.WCB_P05_APPS ?? "", name)
const profileNames: Record<string, string> = { redux: "react18-vite5-redux-msw-v1", bulletproof: "react18-vite5-tailwind3-query-radix-v1" }
const profile = (name: string) => JSON.parse(fs.readFileSync(path.join(process.env.WCB_P05_PROFILES ?? "", profileNames[name] ?? name, "package-lock.json"), "utf8"))
const enabled = process.env.WCB_P05_APPS && process.env.WCB_P05_PROFILES ? it : it.skip
const project = (root: string): ProjectRecord => {
  const detection = detectProject(root, process.cwd())
  return { id: path.basename(root), name: path.basename(root), root: fs.realpathSync(root), sourceRoot: path.join(root, detection.sourceDirectory ?? "src"), imported: true, detection, history: new MutationHistory() }
}

enabled("normalizes the exact reachable Redux browser graph against operator npm integrity", () => {
  const root = fixture("redux"), manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
  const required = ["@faker-js/faker", "@mswjs/data", "@reduxjs/toolkit", "date-fns", "mock-socket", "msw", "react", "react-dom", "react-router-dom"]
  const lock = parseYarnBerry(fs.readFileSync(path.join(root, "yarn.lock"), "utf8"))
  const normalized = normalizeAlternateLock(lock, manifest, profile("redux"), required)
  for (const name of required) expect(normalized.packages[`node_modules/${name}`]?.integrity).toMatch(/^sha512-/)
  expect(normalized.packages["node_modules/react-redux"]).toBeUndefined()
})

enabled("normalizes the exact reachable Bulletproof Vite graph and excludes unrelated tooling records", () => {
  const root = fixture("bulletproof"), manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
  const required = ["@hookform/resolvers", "@mswjs/data", "@ngneat/falso", "@tailwindcss/typography", "@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-icons", "@radix-ui/react-label", "@radix-ui/react-slot", "@radix-ui/react-switch", "@tanstack/react-query", "@tanstack/react-query-devtools", "autoprefixer", "axios", "class-variance-authority", "clsx", "dayjs", "dompurify", "js-cookie", "lucide-react", "marked", "msw", "nanoid", "postcss", "react", "react-dom", "react-error-boundary", "react-helmet-async", "react-hook-form", "react-query-auth", "react-router", "tailwind-merge", "tailwindcss", "tailwindcss-animate", "zod", "zustand"]
  const needed = Object.fromEntries(required.map(name => [name, manifest.dependencies?.[name] ?? manifest.devDependencies?.[name]]))
  const lock = parseYarnClassic(fs.readFileSync(path.join(root, "yarn.lock"), "utf8"), needed)
  const normalized = normalizeAlternateLock(lock, manifest, profile("bulletproof"), required)
  for (const name of required) expect(normalized.packages[`node_modules/${name}`]?.integrity).toMatch(/^sha512-/)
  expect(() => lock.resolve("eslint-plugin-check-file", manifest.dependencies["eslint-plugin-check-file"])).toThrow("outside")
})

enabled("retains the exact Todo peer mismatch as a strict admission failure", () => {
  const root = fixture("todo"), manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
  const lock = parseBunBinary(fs.readFileSync(path.join(root, "bun.lockb")))
  const uno = lock.resolve("unocss", manifest.devDependencies.unocss), forms = lock.resolve("@julr/unocss-preset-forms", manifest.devDependencies["@julr/unocss-preset-forms"])
  const operator = JSON.parse(fs.readFileSync(path.join(process.cwd(), "runtime-profiles/react19-vite6-uno65-v1/package-lock.json"), "utf8")).packages["node_modules/@julr/unocss-preset-forms"]
  expect({ uno: uno.version, forms: forms.version }).toEqual({ uno: "66.0.0", forms: "1.0.0" })
  expect(operator.integrity).toMatch(/^sha512-/)
  expect(operator.peerDependencies.unocss).toBe("^0.31.0 || ^65.0.0")
  expect(semver.satisfies(uno.version, operator.peerDependencies.unocss)).toBe(false)
})

enabled("admits only the statically reachable exact Redux and Bulletproof runtime graphs", () => {
  const redux = inspectRuntime(project(fixture("redux")), process.cwd())
  expect({ profile: redux.profile, issues: redux.issues }).toEqual({ profile: "react18-vite5-redux-msw-v1", issues: [] })
  expect(redux.clientDependencies).toEqual(expect.arrayContaining(["@reduxjs/toolkit", "@mswjs/data", "msw", "react", "react-dom", "react-router-dom"]))
  expect(redux.clientDependencies).not.toContain("react-redux")

  const bulletproof = inspectRuntime(project(fixture("bulletproof")), process.cwd(), { VITE_APP_API_URL: "https://api.bulletproofapp.com", VITE_APP_ENABLE_API_MOCKING: "true" })
  expect({ profile: bulletproof.profile, issues: bulletproof.issues }).toEqual({ profile: "react18-vite5-tailwind3-query-radix-v1", issues: [] })
  expect(bulletproof.clientDependencies).toEqual(expect.arrayContaining(["@tanstack/react-query", "@radix-ui/react-dialog", "react", "react-dom", "react-router"]))
  expect(bulletproof.clientDependencies).not.toEqual(expect.arrayContaining(["@storybook/react", "@playwright/test", "vitest"]))
})

enabled("builds the exact Redux and Bulletproof browser entries through confined profiles", async () => {
  const redux = await buildIsolatedHttpPreview(project(fixture("redux")), process.cwd())
  expect(redux.files.has("/_wcb/app.js")).toBe(true)
  const bulletproof = await buildIsolatedHttpPreview(project(fixture("bulletproof")), process.cwd(), undefined, { VITE_APP_API_URL: "https://api.bulletproofapp.com", VITE_APP_ENABLE_API_MOCKING: "true" })
  expect(bulletproof.files.has("/_wcb/app.js")).toBe(true)
  expect(bulletproof.files.has("/_wcb/app.css")).toBe(true)
}, 35_000)
