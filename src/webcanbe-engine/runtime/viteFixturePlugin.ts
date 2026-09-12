import fs from "node:fs"
import path from "node:path"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { Plugin } from "vite"
import { analyzeReactSource, instrumentReactSource } from "../adapters/react/reactSourceAdapter"
import { summarizeCompatibility } from "../core/compatibility"
import type { SourceIdentity, StyleProperty } from "../core/types"
import { patchStyle, patchText, type SourceStore } from "../mutations/sourceMutations"

const fixtureRoute = "/__webcanbe/fixture/"
const apiRoute = "/__webcanbe/api"

function json(response: ServerResponse, status: number, value: unknown) {
  response.statusCode = status
  response.setHeader("Content-Type", "application/json")
  response.end(JSON.stringify(value))
}

function readBody(request: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let body = ""
    request.on("data", (chunk) => {
      body += chunk
      if (body.length > 65_536) reject(new Error("Request is too large."))
    })
    request.on("end", () => resolve(body))
    request.on("error", reject)
  })
}

export function webCanBeFixturePlugin(projectRoot: string): Plugin {
  const fixtureRoot = path.resolve(projectRoot, "fixtures/compatible-react-vite")
  const sourceRoot = path.resolve(fixtureRoot, "src")
  const allowed = (file: string) => file.startsWith("src/") && /\.(tsx|ts|css)$/.test(file) && !file.includes("..")
  const absolute = (file: string) => path.resolve(fixtureRoot, file)
  const store: SourceStore = {
    read(file) {
      if (!allowed(file)) return undefined
      const target = absolute(file)
      return target.startsWith(sourceRoot) && fs.existsSync(target) ? fs.readFileSync(target, "utf8") : undefined
    },
    write(file, content) {
      if (!allowed(file)) throw new Error("Mutation target is not allowed.")
      const target = absolute(file)
      if (!target.startsWith(sourceRoot)) throw new Error("Mutation target is outside the fixture source root.")
      fs.writeFileSync(target, content, "utf8")
    },
  }
  const sourceFiles = () => fs.readdirSync(sourceRoot, { recursive: true }).filter((entry) => typeof entry === "string" && /\.(tsx|ts)$/.test(entry)).map((entry) => `src/${entry}`)

  return {
    name: "webcanbe-compatible-fixture",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use(fixtureRoute, (_request, response) => {
        response.statusCode = 200
        response.setHeader("Content-Type", "text/html")
        response.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' ws:;")
        response.end(`<!doctype html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>Compatible fixture</title></head><body><div id="root"></div><script type="module" src="/src/webcanbe-engine/runtime/reactPreamble.ts"></script><script type="module" src="/fixtures/compatible-react-vite/src/main.tsx"></script></body></html>`)
      })
      server.middlewares.use(apiRoute, async (request, response) => {
        if (request.method !== "POST") return json(response, 405, { error: "Method not allowed" })
        try {
          const requestPath = request.url?.split("?")[0]
          const body = JSON.parse(await readBody(request)) as Record<string, unknown>
          if (requestPath === "/compatibility") {
            const targets = sourceFiles().flatMap((file) => analyzeReactSource(file, store.read(file) ?? "", store.read))
            return json(response, 200, { summary: summarizeCompatibility(targets) })
          }
          const identity = body.identity as SourceIdentity
          if (!identity || !allowed(identity.file) || !Number.isInteger(identity.elementStart)) return json(response, 400, { error: "Invalid source identity." })
          if (requestPath === "/inspect") {
            const source = store.read(identity.file)
            const target = source && analyzeReactSource(identity.file, source, store.read).find((candidate) => candidate.identity.elementStart === identity.elementStart)
            return target ? json(response, 200, { target }) : json(response, 404, { error: "Source target is no longer available." })
          }
          if (requestPath === "/mutate") {
            const edit = body.edit as Record<string, unknown>
            const mutation = edit?.type === "text"
              ? patchText(store, identity, String(edit.value ?? ""))
              : edit?.type === "style"
                ? patchStyle(store, identity, edit.property as StyleProperty, String(edit.value ?? ""))
                : undefined
            return mutation ? json(response, mutation.success ? 200 : 422, { transaction: mutation }) : json(response, 400, { error: "Unsupported mutation." })
          }
          return json(response, 404, { error: "Unknown engine endpoint." })
        } catch (error) {
          return json(response, 400, { error: error instanceof Error ? error.message : "Invalid editor request." })
        }
      })
    },
    transform(code, id) {
      const filename = id.split("?")[0]
      if (!filename.startsWith(sourceRoot) || !filename.endsWith(".tsx")) return null
      const file = path.relative(fixtureRoot, filename).split(path.sep).join("/")
      const instrumented = instrumentReactSource(file, code)
      const withBridge = filename.endsWith("/src/main.tsx") ? `${instrumented}\nimport \"/src/webcanbe-engine/runtime/previewBridge.ts\"` : instrumented
      return { code: withBridge, map: null }
    },
  }
}
