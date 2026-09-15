import { afterEach, expect, it } from "vitest"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { MutationHistory } from "./mutations/sourceMutations"
import { exportProjectZip } from "./runtime/projectExport"
import { detectProject, extractSafeZip, ProjectRegistry, type ProjectRecord } from "./runtime/projectRegistry"

const roots: string[] = []
const temp = (name: string) => { const root = path.join(os.tmpdir(), `wcb-p05-${name}-${randomUUID()}`); fs.mkdirSync(root); roots.push(root); return root }
const tempPath = (name: string) => { const root = path.join(os.tmpdir(), `wcb-p05-${name}-${randomUUID()}`); roots.push(root); return root }
afterEach(() => { while (roots.length) fs.rmSync(roots.pop()!, { recursive: true, force: true }) })

function viteApp(root: string, name: string) {
  fs.mkdirSync(path.join(root, "src"), { recursive: true })
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name, private: true, dependencies: { react: "18.3.1", "react-dom": "18.3.1" }, devDependencies: { vite: "5.2.11" } }))
  fs.writeFileSync(path.join(root, "index.html"), '<div id="root"></div><script type="module" src="/src/main.tsx"></script>')
  fs.writeFileSync(path.join(root, "src/main.tsx"), "export const retained = 'exact';\n")
}

function record(archiveRoot: string, root: string): ProjectRecord {
  const detection = detectProject(root, process.cwd())
  return { id: randomUUID(), name: "nested", archiveRoot, root: fs.realpathSync(root), sourceRoot: path.join(root, "src"), imported: true, detection, history: new MutationHistory() }
}

function host() {
  const root = temp("host")
  fs.mkdirSync(path.join(root, "fixtures"), { recursive: true })
  fs.cpSync(path.join(process.cwd(), "fixtures/compatible-react-vite"), path.join(root, "fixtures/compatible-react-vite"), { recursive: true })
  return root
}

it("selects one nested Vite application while preserving the complete archive", async () => {
  const repository = temp("repository"), app = path.join(repository, "apps/react-vite")
  fs.writeFileSync(path.join(repository, "package.json"), JSON.stringify({ name: "repository-root", private: true, scripts: { prepare: "do-not-run" } }))
  fs.mkdirSync(path.join(repository, "apps/nextjs-app"), { recursive: true })
  fs.writeFileSync(path.join(repository, "apps/nextjs-app/package.json"), JSON.stringify({ name: "other-app", private: true }))
  fs.writeFileSync(path.join(repository, "README.md"), "retained repository bytes\n")
  viteApp(app, "selected-vite-app")
  const registry = new ProjectRegistry(host()), imported = await registry.importZip("nested.zip", await exportProjectZip(record(repository, app)))
  expect(path.relative(imported.archiveRoot!, imported.root).split(path.sep).join("/")).toBe("apps/react-vite")
  const extracted = tempPath("export"), before = fs.readFileSync(path.join(repository, "README.md"))
  await extractSafeZip(await exportProjectZip(imported), extracted)
  expect(fs.readFileSync(path.join(extracted, "README.md"))).toEqual(before)
  expect(fs.readFileSync(path.join(extracted, "package.json"))).toEqual(fs.readFileSync(path.join(repository, "package.json")))
  expect(fs.readFileSync(path.join(extracted, "apps/react-vite/src/main.tsx"))).toEqual(fs.readFileSync(path.join(app, "src/main.tsx")))
})

it("rejects ambiguous nested application roots", async () => {
  const repository = temp("ambiguous"), first = path.join(repository, "apps/first"), second = path.join(repository, "apps/second")
  fs.writeFileSync(path.join(repository, "package.json"), JSON.stringify({ name: "repository-root", private: true }))
  viteApp(first, "first"); viteApp(second, "second")
  const registry = new ProjectRegistry(host())
  await expect(registry.importZip("ambiguous.zip", await exportProjectZip(record(repository, first)))).rejects.toThrow("multiple supported application roots")
})

const exact = process.env.WCB_BULLETPROOF_ARCHIVE ? it : it.skip
exact("selects apps/react-vite from the exact retained Bulletproof archive", async () => {
  const bytes = fs.readFileSync(process.env.WCB_BULLETPROOF_ARCHIVE!)
  const registry = new ProjectRegistry(host()), imported = await registry.importZip("bulletproof-react.zip", bytes)
  expect(path.relative(imported.archiveRoot!, imported.root).split(path.sep).join("/")).toBe("apps/react-vite")
  expect(imported.detection.supported).toBe(true)
  const exported = tempPath("exact-export")
  await extractSafeZip(await exportProjectZip(imported), exported)
  expect(fs.readFileSync(path.join(exported, "package.json"), "utf8")).toEqual(JSON.stringify({
    name: "bulletproof-react",
    private: true,
    version: "1.0.0",
    description: "A simple, scalable, and powerful architecture for building production ready React applications.",
    scripts: { prepare: "cd ./apps/nextjs-app && yarn && cd ../nextjs-pages && yarn && cd ../react-vite && yarn" },
    author: "alan2207",
    license: "MIT",
  }, null, 2) + "\n")
  expect(fs.readFileSync(path.join(exported, "apps/react-vite/package.json"))).toEqual(fs.readFileSync(path.join(imported.root, "package.json")))
})
