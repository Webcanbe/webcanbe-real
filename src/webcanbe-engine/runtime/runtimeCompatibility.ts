import fs from "node:fs"
import path from "node:path"
import ts from "typescript"
import semver from "semver"
import { parse as parseJsonc, type ParseError } from "jsonc-parser"
import { parse as parseHtml } from "parse5"
import { isWithin, safeArchivePath, type ProjectRecord } from "./projectRegistry"

export const PROFILE = "react19-vite6"
export const clientPackages = new Set(["react", "react-dom", "react-router-dom", "react-router", "clsx", "classnames"])
export type RuntimeIssue = { code: string; message: string; requiredCapability: string }
export type RuntimeReport = {
  profile: string; supported: boolean; entry?: string; aliases: Record<string, string>
  dependencies: Array<{ name: string; declared: string; selected?: string; locked?: string }>
  issues: RuntimeIssue[]; notes: string[]
}
export class RuntimeCompatibilityError extends Error {
  constructor(public readonly issues: RuntimeIssue[]) { super(issues.map(issue => issue.message).join(" ")) }
}
const object = (value: unknown): value is Record<string, any> => Boolean(value && typeof value === "object" && !Array.isArray(value))
export function confinedFile(root: string, relative: string) {
  if (!safeArchivePath(relative)) throw new Error(`Invalid project-local path: ${relative}`)
  const file = path.resolve(root, relative)
  if (!isWithin(root, file) || !fs.existsSync(file) || !isWithin(root, fs.realpathSync(file))) throw new Error(`Project-local path is unavailable or escapes its root: ${relative}`)
  return fs.realpathSync(file)
}
function json(root: string, file: string, comments = false): any {
  const code = fs.readFileSync(confinedFile(root, file), "utf8")
  if (!comments) return JSON.parse(code)
  const errors: ParseError[] = [], value = parseJsonc(code, errors, { allowTrailingComma: true })
  if (errors.length) throw new Error(`Invalid JSON data: ${file}`)
  return value
}

/** HTML is parsed as data. No uploaded scripts, custom templates or head code are run. */
export function htmlEntry(root: string) {
  if (!fs.existsSync(path.join(root, "index.html"))) return undefined
  const document = parseHtml(fs.readFileSync(confinedFile(root, "index.html"), "utf8"))
  const entries: string[] = []
  let invalid = false, rootMount = false
  const walk = (node: any) => {
    const attrs = Object.fromEntries((node.attrs ?? []).map((attr: any) => [attr.name, attr.value]))
    if (attrs.id === "root" && node.tagName === "div") rootMount = true
    if (node.tagName === "script") {
      if (attrs.type !== "module" || !attrs.src || node.childNodes?.some((child: any) => child.value?.trim())) invalid = true
      else entries.push(attrs.src.replace(/^\//, ""))
    }
    if (["base", "style", "iframe"].includes(node.tagName) || node.tagName === "link" && attrs.rel === "stylesheet" || Object.keys(attrs).some(name => name.startsWith("on"))) invalid = true
    for (const child of node.childNodes ?? []) walk(child)
  }
  walk(document)
  if (invalid || entries.length !== 1 || !rootMount || !entries[0].startsWith("src/") || !/\.[jt]sx$/.test(entries[0])) throw new Error("index.html requires one local JSX/TSX module and a div#root mount; custom HTML execution needs an isolated Vite runner.")
  confinedFile(root, entries[0])
  return entries[0]
}

/** Interpret only a fixed AST grammar; never import/eval the Vite module. */
function staticViteConfig(root: string, declared: Record<string, unknown>): Record<string, string> {
  const files = ["vite.config.ts", "vite.config.js", "vite.config.mts", "vite.config.mjs", "vite.config.cts", "vite.config.cjs"].filter(file => fs.existsSync(path.join(root, file)))
  if (files.length > 1) throw new Error("Multiple Vite configurations are ambiguous.")
  if (!files.length) return {}
  const source = ts.createSourceFile(files[0], fs.readFileSync(confinedFile(root, files[0]), "utf8"), ts.ScriptTarget.Latest, true)
  if ((source as ts.SourceFile & { parseDiagnostics: unknown[] }).parseDiagnostics.length) throw new Error("Invalid Vite configuration syntax.")
  const bindings = new Map<string, string>()
  const pluginValues = new Set<unknown>()
  for (const statement of source.statements.filter(ts.isImportDeclaration)) {
    if (!ts.isStringLiteral(statement.moduleSpecifier)) throw new Error("Unknown configuration import.")
    const module = statement.moduleSpecifier.text, clause = statement.importClause
    if (!["node:url", "url"].includes(module) && !declared[module]) throw new Error(`Undeclared Vite configuration dependency: ${module}.`)
    if (clause?.isTypeOnly) throw new Error("Type-only configuration imports cannot be runtime bindings.")
    if (clause?.name) bindings.set(clause.name.text, module + ":default")
    if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) for (const item of clause.namedBindings.elements) bindings.set(item.name.text, module + ":" + (item.propertyName?.text ?? item.name.text))
    if (!["vite", "@vitejs/plugin-react", "@tailwindcss/vite", "node:url", "url"].includes(module)) throw new Error(`Unsupported Vite configuration import: ${module}.`)
  }
  const value = (node: ts.Expression): any => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
    if (ts.isNumericLiteral(node)) return Number(node.text)
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false
    if (ts.isObjectLiteralExpression(node)) {
      const result: Record<string, any> = Object.create(null)
      for (const property of node.properties) {
        if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name) && !ts.isStringLiteral(property.name)) throw new Error("Computed/spread Vite configuration requires execution.")
        const key = property.name.text
        if (Object.prototype.hasOwnProperty.call(result, key)) throw new Error("Duplicate configuration field.")
        result[key] = value(property.initializer)
      }
      return result
    }
    if (ts.isArrayLiteralExpression(node)) return node.elements.map(item => value(item as ts.Expression))
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const binding = bindings.get(node.expression.text)
      if (binding === "vite:defineConfig" && node.arguments.length === 1) return value(node.arguments[0])
      if (["@vitejs/plugin-react:default", "@tailwindcss/vite:default"].includes(binding ?? "") && !node.arguments.length) { const plugin = { plugin: binding!.split(":")[0] }; pluginValues.add(plugin); return plugin }
      if (["node:url:fileURLToPath", "url:fileURLToPath"].includes(binding ?? "") && node.arguments.length === 1) {
        const url = node.arguments[0]
        if (ts.isNewExpression(url) && ts.isIdentifier(url.expression) && url.expression.text === "URL" && !bindings.has("URL") && url.arguments?.length === 2 && ts.isStringLiteral(url.arguments[0]) && url.arguments[1].getText(source) === "import.meta.url") {
          const relative = url.arguments[0].text
          if (!relative.startsWith("./")) throw new Error("Alias must remain inside the project.")
          return confinedFile(root, relative.slice(2))
        }
      }
    }
    throw new Error("Executable Vite configuration is not supported by the static runtime profile.")
  }
  const exports = source.statements.filter(ts.isExportAssignment)
  if (exports.length !== 1 || source.statements.some(statement => !ts.isImportDeclaration(statement) && !ts.isExportAssignment(statement))) throw new Error("Vite configuration has executable statements; an isolated configuration runner is required.")
  const config = value(exports[0].expression)
  if (!object(config) || Object.keys(config).some(key => !["plugins", "resolve", "base"].includes(key))) throw new Error("Unsupported Vite configuration field; an isolated configuration runner is required.")
  if (config.base !== undefined && !["/", "./"].includes(config.base)) throw new Error("Custom Vite base requires an HTTP preview runner.")
  if (config.plugins !== undefined && (!Array.isArray(config.plugins) || config.plugins.some((plugin: any) => !pluginValues.has(plugin)))) throw new Error("Unsupported Vite build plugin.")
  const aliases: Record<string, string> = Object.create(null)
  if (config.resolve !== undefined) {
    if (!object(config.resolve) || Object.keys(config.resolve).some(key => key !== "alias") || !object(config.resolve.alias)) throw new Error("Only static project-local resolve.alias objects are supported.")
    for (const [key, replacement] of Object.entries(config.resolve.alias)) {
      if (!/^[@~][\w/-]*$/.test(key) || typeof replacement !== "string") throw new Error("Only explicit @/~ project-local aliases are supported.")
      // Vite string aliases must be absolute; relative replacements have different resolution semantics.
      if (!path.isAbsolute(replacement) || !isWithin(root, replacement)) throw new Error("Alias escapes the project or requires executable path resolution.")
      aliases[key] = path.relative(root, confinedFile(root, path.relative(root, replacement))).split(path.sep).join("/")
    }
  }
  return aliases
}

export function inspectRuntime(project: ProjectRecord, applicationRoot: string): RuntimeReport {
  const report: RuntimeReport = { profile: PROFILE, supported: false, aliases: {}, dependencies: [], issues: [], notes: [] }
  const issue = (code: string, message: string, requiredCapability = "A separately approved dependency/runtime profile or isolated build runner") => report.issues.push({ code, message, requiredCapability })
  const root = project.root
  const profileRoot = path.join(applicationRoot, "runtime-profiles", PROFILE)
  try {
    if (fs.realpathSync(root) !== root) throw new Error("Registered project root changed.")
    const manifest = json(root, "package.json"), profile = JSON.parse(fs.readFileSync(path.join(profileRoot, "package.json"), "utf8"))
    const profileLock = JSON.parse(fs.readFileSync(path.join(profileRoot, "package-lock.json"), "utf8"))
    if (!object(manifest) || !object(manifest.dependencies ?? {}) || !object(manifest.devDependencies ?? {})) throw new Error("Invalid package manifest.")
    for (const field of ["overrides", "resolutions", "workspaces", "imports"]) if (manifest[field]) issue("package-configuration", `package.json ${field} requires a different resolver.`)
    const declared = { ...manifest.devDependencies, ...manifest.dependencies }
    for (const name of ["react", "react-dom", "vite"]) if (!declared[name]) issue("missing-dependency", `Missing required declared dependency: ${name}.`)
    for (const name of Object.keys(manifest.dependencies ?? {})) if (manifest.devDependencies?.[name] && manifest.devDependencies[name] !== manifest.dependencies[name]) issue("dependency-conflict", `Conflicting declarations for ${name}.`)
    const lockNames = ["package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml", "bun.lock", "bun.lockb"].filter(file => fs.existsSync(path.join(root, file)))
    let lock: any
    if (lockNames.length > 1 || lockNames.length === 1 && lockNames[0] !== "package-lock.json") issue("unsupported-lockfile", "Only a single npm package-lock v2/v3 is supported; other lockfiles are not ignored.")
    if (lockNames.includes("package-lock.json")) {
      lock = json(root, "package-lock.json")
      if (![2, 3].includes(lock.lockfileVersion) || !object(lock.packages) || !object(lock.packages[""])) { issue("unsupported-lockfile", "npm package-lock v2/v3 with package records is required."); lock = undefined }
    }
    for (const [name, range] of Object.entries(declared)) {
      const selected = profile.dependencies[name] as string | undefined, locked = lock?.packages[`node_modules/${name}`]?.version as string | undefined
      report.dependencies.push({ name, declared: String(range), selected, locked })
      if (typeof range !== "string" || !semver.validRange(range) || !selected || !semver.satisfies(selected, range)) issue("unsupported-version", `${name}@${String(range)} cannot use this profile${selected ? ` (${selected})` : " (package not provided)"}.`)
      if (lock && (!locked || locked !== selected || lock.packages[`node_modules/${name}`]?.integrity !== profileLock.packages[`node_modules/${name}`]?.integrity || (lock.packages[""].dependencies?.[name] ?? lock.packages[""].devDependencies?.[name]) !== range)) issue("lock-conflict", `${name} lockfile version/declaration does not match the selected profile and manifest.`)
      if (selected) {
        const installed = path.join(profileRoot, "node_modules", name, "package.json")
        if (!fs.existsSync(installed) || !isWithin(fs.realpathSync(path.join(profileRoot, "node_modules")), fs.realpathSync(installed)) || JSON.parse(fs.readFileSync(installed, "utf8")).version !== selected) issue("profile-unavailable", `The dedicated profile package ${name}@${selected} is missing or changed.`, "Operator installation of the repository-owned locked runtime profile with scripts disabled")
      }
    }
    // The executed transitive client graph must also match an uploaded lock; no hidden version substitution.
    if (lock) for (const [location, record] of Object.entries(lock.packages) as Array<[string, any]>) {
      const name = location.split("node_modules/").at(-1)!
      if (["react", "react-dom", "scheduler", "react-router-dom", "react-router", "cookie", "set-cookie-parser", "clsx", "classnames"].includes(name)) {
        if (record.link || record.version !== profileLock.packages[`node_modules/${name}`]?.version || record.integrity !== profileLock.packages[`node_modules/${name}`]?.integrity) issue("lock-conflict", `Locked client package ${location} differs from the dedicated runtime profile.`)
      }
    }
    if (lock) {
      const checked = new Set<string>(), pending = Object.keys(declared).filter(name => clientPackages.has(name))
      while (pending.length) {
        const name = pending.pop()!
        if (checked.has(name)) continue
        checked.add(name)
        const selected = profileLock.packages[`node_modules/${name}`], locked = lock.packages[`node_modules/${name}`]
        if (!selected || !locked || locked.version !== selected.version || locked.integrity !== selected.integrity || locked.link) issue("lock-conflict", `Required client dependency ${name} is missing or differs in the uploaded lock.`)
        for (const dependency of Object.keys(selected?.dependencies ?? {})) pending.push(dependency)
      }
    }
    report.notes.push(lock ? "Client versions checked against the npm lockfile." : "No lockfile: disclosed pinned profile versions must satisfy every declared range.")
    if (object(manifest.scripts) && Object.keys(manifest.scripts).length) report.notes.push("Package scripts, including install/build hooks, are inspected only and never run during intake or preview.")
    try { report.entry = htmlEntry(root) ?? project.detection.entry; if (!report.entry) throw new Error("No supported client entry found.") } catch (error) { issue("html-entry", (error as Error).message) }
    try { report.aliases = staticViteConfig(root, declared) } catch (error) { issue("executable-config", (error as Error).message, "An isolated Vite configuration/plugin runner") }
    const configs = new Set<string>()
    const readTsconfig = (file: string) => {
      if (configs.has(file)) return
      if (configs.size >= 8) throw new Error("Too many referenced TypeScript configurations.")
      configs.add(file)
      const config = json(root, file, true), options = config.compilerOptions ?? {}
      if (config.extends) throw new Error("Extended TypeScript configurations require explicit isolated resolution.")
      if (options.jsxImportSource && options.jsxImportSource !== "react" || options.experimentalDecorators || options.useDefineForClassFields === false || options.plugins || options.jsxFactory || options.jsxFragmentFactory || options.jsx && !["react-jsx", "react-jsxdev", "preserve"].includes(options.jsx)) throw new Error("Unsupported TypeScript runtime transformation setting.")
      if (options.paths) {
        if (!object(options.paths) || options.baseUrl && options.baseUrl !== ".") throw new Error("Only project-root TypeScript aliases are supported.")
        for (const [key, replacements] of Object.entries(options.paths)) {
          if (!key.endsWith("/*") || !Array.isArray(replacements) || replacements.length !== 1 || typeof replacements[0] !== "string" || !replacements[0].endsWith("/*")) throw new Error("Only single-target TypeScript path aliases are supported.")
          const target = replacements[0].slice(0, -2).replace(/^\.\//, ""), alias = key.slice(0, -2)
          confinedFile(root, target)
          if (report.aliases[alias] !== target) throw new Error(`TypeScript alias ${alias} must match an explicit static Vite alias.`)
        }
      }
      if (Array.isArray(config.references)) for (const reference of config.references) { if (typeof reference.path !== "string") throw new Error("Invalid tsconfig reference."); readTsconfig(path.posix.normalize(path.posix.join(path.posix.dirname(file), reference.path))) }
    }
    try { if (fs.existsSync(path.join(root, "tsconfig.json"))) readTsconfig("tsconfig.json") } catch (error) { issue("tsconfig", (error as Error).message) }
    if (["tailwind.config.ts", "tailwind.config.js", "tailwind.config.cjs", "tailwind.config.mjs", "postcss.config.js", "postcss.config.cjs", "postcss.config.mjs"].some(file => fs.existsSync(path.join(root, file)))) issue("css-config", "Custom Tailwind/PostCSS configuration requires an isolated plugin runner; only Tailwind 4 defaults are supported.")
    report.notes.push("Supported configuration is interpreted as static data, never executed. HashRouter is supported; browser-history/server routing requires a separate HTTP preview runner.")
  } catch (error) { issue("runtime-inspection", (error as Error).message) }
  report.supported = report.issues.length === 0
  return report
}
