import { isOpaqueBunLock, isExampleEnvironment, isInertMetadata, validateIntakeMetadata } from "./intakeMetadata"
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import yauzl from "yauzl"
import { assertSourceDirectory, sourceDirectory } from "./sourceDirectory"
import { htmlEntry, staticViteConfig } from "./runtimeCompatibility"
import { crc32 } from "node:zlib"
import { DurableSource } from "../mutations/durableSource"
import type { ProjectGrant } from "./hostedAuthority"
import type { ProjectPersistence, ProjectStoreFactory } from "./storageContracts"
import type { RunnerOwner } from "./runnerScheduler"
import { MutationHistory, type SourceStore } from "../mutations/sourceMutations"

export const ZIP_LIMITS = Object.freeze({ archiveBytes: 25 * 1024 * 1024, totalBytes: 40 * 1024 * 1024, fileBytes: 2 * 1024 * 1024, entries: 2_000, ratio: 100 })
const sourceExtension = /\.([cm]?[jt]sx?|css|json)$/
export type SessionOperation = "inspect" | "compatibility" | "preview" | "source" | "export" | "mutate" | "undo" | "redo" | "files" | "code" | "validate" | "history" | "revert" | "checkpoint" | "drafts"
export type SessionBinding = { grant: ProjectGrant; check: (operation: SessionOperation) => boolean }
export type SessionAuthority = { previewId: string; capability: string; operation: SessionOperation }
const operations: SessionOperation[] = ["inspect", "compatibility", "preview", "source", "export", "mutate", "undo", "redo", "files", "code", "validate", "history", "revert", "checkpoint", "drafts"]

export type FrameworkDetection = {
  supported: boolean
  framework: "react-vite" | "unknown"
  sourceDirectory?: string
  entry?: string
  tailwind: boolean
  reason?: string
  dependencies: Array<{ name: string; declared: string; resolved: boolean }>
}

export type ProjectRecord = {
  id: string
  name: string
  root: string
  sourceRoot: string
  imported: boolean
  detection: FrameworkDetection
  history: MutationHistory
}

export type PreviewSession = { projectId: string; previewId: string; capability: string; expiresAt: string }

export function isWithin(root: string, candidate: string) { const relative = path.relative(root, candidate); return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)) }
function sha(value: string) { return createHash("sha256").update(value).digest("hex") }

export function safeArchivePath(entryName: string) {
  if (!entryName || entryName.length > 512 || /[\x00-\x1f\x7f\\:]/.test(entryName) || entryName.startsWith("/") || entryName !== entryName.normalize("NFC")) return undefined
  const parts = entryName.replace(/\/$/, "").split("/")
  if (parts.length > 20 || parts.some(part => part.length > 128 || !part || part === "." || part === ".." || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part))) return undefined
  if (parts.some(part => ["node_modules", ".git", ".webcanbe"].includes(part.toLowerCase()) || /^\.env(?:$|\.)/i.test(part) && !isExampleEnvironment(part))) return undefined
  return parts.join("/")
}

/** Validate every member before writing. Never follow archive links or run project code. */
export async function extractSafeZip(archive: Buffer, destination: string) {
  if (archive.byteLength > ZIP_LIMITS.archiveBytes) throw new Error("ZIP exceeds the 25 MiB upload limit.")
  const files = new Map<string, Buffer>()
  const seen = new Map<string, boolean>()
  let entries = 0, total = 0
  await new Promise<void>((resolve, reject) => {
    yauzl.fromBuffer(archive, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }, (error, zip) => {
      if (error || !zip) return reject(error ?? new Error("Invalid ZIP."))
      let stopped = false
      const fail = (err: Error) => { if (!stopped) { stopped = true; zip.close(); reject(err) } }
      zip.on("error", fail)
      zip.on("entry", entry => {
        const name = safeArchivePath(entry.fileName)
        const directory = entry.fileName.endsWith("/")
        const mode = (entry.externalFileAttributes >>> 16) & 0o170000
        if (!name || ++entries > ZIP_LIMITS.entries || ![0, 0o100000, 0o040000].includes(mode) || (mode === 0o040000 && !directory) || (entry.generalPurposeBitFlag & 1) || entry.uncompressedSize > ZIP_LIMITS.fileBytes || total + entry.uncompressedSize > ZIP_LIMITS.totalBytes || entry.uncompressedSize / Math.max(1, entry.compressedSize) > ZIP_LIMITS.ratio) return fail(new Error("Unsafe ZIP path, type, or archive limit."))
        const key = name.toLowerCase()
        if (seen.has(key) || [...seen].some(([other, dir]) => key.startsWith(other + "/") && !dir || other.startsWith(key + "/") && !directory)) return fail(new Error("Duplicate or conflicting ZIP path."))
        seen.set(key, directory)
        if (directory) { zip.readEntry(); return }
        if (path.posix.basename(name)!=="bun.lockb" && !isInertMetadata(path.posix.basename(name)) && !/\.(tsx?|jsx?|css|json|html|md|txt|svg|png|jpe?g|gif|webp|ico|woff2?|mjs|cjs|mts|cts|yaml|yml|lock|hbs)$/i.test(name) && !/(^|\/)(LICENSE|_gitignore|\.gitignore|\.env.example)$/.test(name)) return fail(new Error("Unsupported archive file type."))
        zip.openReadStream(entry, async (streamError, stream) => {
          if (streamError || !stream) return fail(streamError ?? new Error("Invalid ZIP stream."))
          try {
            const chunks: Buffer[] = []; let size = 0
            for await (const raw of stream) {
              const chunk = Buffer.from(raw); size += chunk.length; total += chunk.length
              if (size > ZIP_LIMITS.fileBytes || total > ZIP_LIMITS.totalBytes) throw new Error("ZIP inflated beyond its limit.")
              chunks.push(chunk)
            }
            if (size !== entry.uncompressedSize) throw new Error("Invalid ZIP member size.")
            const content = Buffer.concat(chunks)
            if (crc32(content) !== entry.crc32) throw new Error("ZIP member checksum mismatch.")
            if(path.posix.basename(name)==="bun.lockb"&&!isOpaqueBunLock("bun.lockb",content))throw Error("Unsupported opaque Bun lock format.")
            if (!isOpaqueBunLock(path.posix.basename(name),content) && !/\.(png|jpe?g|gif|webp|ico|woff2?)$/i.test(name)) { if (content.includes(0)) throw new Error("Binary data in a text file."); new TextDecoder("utf-8", { fatal: true }).decode(content) }
            validateIntakeMetadata(path.posix.basename(name), content)
            files.set(name, content)
            if (!stopped) zip.readEntry()
          } catch (err) { stream.destroy(); fail(err instanceof Error ? err : new Error("Invalid ZIP content.")) }
        })
      })
      zip.on("end", () => { if (!stopped) { stopped = true; resolve() } })
      zip.readEntry()
    })
  })
  // The caller supplies a fresh UUID under a trusted private storage directory.
  fs.mkdirSync(destination, { mode: 0o700 })
  try {
    for (const [name, content] of files) {
      const target = path.join(destination, name)
      fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 })
      fs.writeFileSync(target, content, { flag: "wx", mode: 0o600 })
    }
  } catch (error) { fs.rmSync(destination, { recursive: true, force: true }); throw error }
}

function packageAt(root: string) {
  try { return JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as { name?: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string> } } catch { return undefined }
}

function projectRootFromArchive(root: string) {
  if (packageAt(root)) return root
  const entries = fs.readdirSync(root, { withFileTypes: true }).filter((entry) => entry.name !== ".upload.zip")
  if (entries.length === 1 && entries[0].isDirectory()) {
    const nested = path.join(root, entries[0].name)
    if (packageAt(nested)) return nested
  }
  return root
}

function findSource(root: string, declared: Record<string, unknown>) {
  try {
    const config = staticViteConfig(root, declared), runtimeRoot = config.runtimeRoot ?? '.'
    const entry = htmlEntry(root, config.publicDir, runtimeRoot)
    if (!entry) throw Error('Missing static HTML entry.')
    const relative = path.posix.relative(runtimeRoot, entry), parts = relative.split('/')
    // The first source directory below the proven HTML root owns the entry.
    // A Vite root which is itself the source directory owns a direct entry.
    const directory = parts[0] === '..' ? entry.split('/')[0] : parts.length > 1 ? path.posix.join(runtimeRoot, parts[0]) : runtimeRoot
    assertSourceDirectory({ root, sourceRoot: path.join(root, directory) })
    return { entry, sourceDirectory: directory }
  } catch {
    // Preserve legacy intake/configuration stage separation only for top-level src.
    // Nested trees are never guessed when their configuration cannot be proven.
    try { const entry = htmlEntry(root); if (entry?.startsWith('src/')) return { entry, sourceDirectory: 'src' } } catch { /* Runtime admission still refuses this configuration. */ }
    for (const entry of ['src/main.tsx', 'src/main.jsx', 'src/index.tsx', 'src/index.jsx']) if (fs.existsSync(path.join(root, entry))) return { entry, sourceDirectory: 'src' }
    return undefined
  }
}

export function detectProject(root: string, dependencyRoot: string): FrameworkDetection {
  const manifest = packageAt(root)
  if (!manifest) return { supported: false, framework: "unknown", tailwind: false, reason: "package.json is required.", dependencies: [] }
  const declared = { ...(manifest.dependencies ?? {}), ...(manifest.devDependencies ?? {}) }
  const dependencies = Object.entries(declared).map(([name, version]) => ({ name, declared: String(version), resolved: false }))
  const source = findSource(root, declared), entry = source?.entry
  const react = Boolean(declared.react && declared["react-dom"])
  const vite = Boolean(declared.vite || fs.existsSync(path.join(root, "vite.config.ts")) || fs.existsSync(path.join(root, "vite.config.js")))
  const tailwind = Boolean(declared.tailwindcss || fs.existsSync(path.join(root, "tailwind.config.ts")) || fs.existsSync(path.join(root, "tailwind.config.js")) || fs.existsSync(path.join(root, "tailwind.config.cjs")))
  if (!react || !vite || !entry) return { supported: false, framework: "unknown", tailwind, reason: "Phase 2 supports React/Vite projects with a conventional src entry point.", dependencies }
  return { supported: true, framework: "react-vite", entry, sourceDirectory: source!.sourceDirectory, tailwind, dependencies }
}

export class ProjectRegistry {
  private readonly projects = new Map<string, ProjectRecord>()
  private readonly sessions = new Map<string, { projectId: string; tokenHash: string; expiresAt: number; root: string; operations: SessionOperation[]; binding?: SessionBinding }>()
  private readonly durableStores = new Map<string, ProjectPersistence>()
  private readonly queues = new Map<string, Promise<void>>()
  readonly importedRoot: string

  constructor(private readonly applicationRoot: string, private readonly now = Date.now, private readonly storeFactory?: ProjectStoreFactory) {
    this.importedRoot = path.join(applicationRoot, ".webcanbe", "projects")
    fs.mkdirSync(this.importedRoot, { recursive: true })
    const fixtureRoot = fs.realpathSync(path.join(applicationRoot, "fixtures", "compatible-react-vite"))
    const detection = detectProject(fixtureRoot, applicationRoot)
    this.projects.set("phase1-fixture", { id: "phase1-fixture", name: "Internal compatible fixture", root: fixtureRoot, sourceRoot: path.join(fixtureRoot, "src"), imported: false, detection, history: new MutationHistory() })
    for (const id of fs.readdirSync(this.importedRoot)) {
      if (!/^[a-f0-9-]{36}$/.test(id)) continue
      const directory = path.join(this.importedRoot, id)
      if (!fs.lstatSync(directory).isDirectory()) continue
      const root = fs.realpathSync(projectRootFromArchive(directory)), detection = detectProject(root, applicationRoot)
      const historyFile = path.join(applicationRoot, '.webcanbe', 'history', id, 'history.json')
      let canonicalDirectory = detection.sourceDirectory ?? 'src'
      if (fs.existsSync(historyFile)) {
        if (fs.statSync(historyFile).size > 64 * 1024 * 1024) throw Error('History bound exceeded.')
        canonicalDirectory = JSON.parse(fs.readFileSync(historyFile, 'utf8')).sourceDirectory ?? 'src'
        if (typeof canonicalDirectory !== 'string' || safeArchivePath(canonicalDirectory) !== canonicalDirectory) throw Error('Invalid persisted source canonicalDirectory.')
      }
      if (detection.supported || fs.existsSync(path.join(applicationRoot, ".webcanbe", "history", id, "pending.json"))) this.projects.set(id, { id, name: packageAt(root)?.name ?? "Imported project", root, sourceRoot: path.join(root, canonicalDirectory), imported: true, detection, history: new MutationHistory() })
    }
    // Recover interrupted source writes before sessions or compilation can start.
    for (const project of this.projects.values()) {
      if (fs.existsSync(path.join(applicationRoot, ".webcanbe", "history", project.id, "history.json"))) { this.durable(project.id); project.detection = detectProject(project.root, applicationRoot) }
    }
  }

  durable(projectId: string) {
    const project = this.projects.get(projectId)
    if (!project) throw new Error("Project is unavailable.")
    if (!this.durableStores.has(projectId)) this.durableStores.set(projectId, this.storeFactory ? this.storeFactory(project) : new DurableSource(project, path.join(this.applicationRoot, ".webcanbe", "history")))
    return this.durableStores.get(projectId)!
  }

  async lock(projectId: string) {
    const previous = this.queues.get(projectId) ?? Promise.resolve()
    let release!: () => void
    const current = new Promise<void>(resolve => { release = resolve })
    this.queues.set(projectId, current)
    await previous
    const done = () => { release(); if (this.queues.get(projectId) === current) this.queues.delete(projectId) }
    try {
      const unlock = this.durable(projectId).lease()
      return () => { try { unlock() } finally { done() } }
    } catch (error) { done(); throw error }
  }

  get(id: string) { return this.projects.get(id) }
  list() { return [...this.projects.values()].map(({ history: _history, root: _root, sourceRoot: _sourceRoot, ...project }) => project) }

  async importZip(name: string, archive: Buffer) {
    if (fs.readdirSync(this.importedRoot).length >= 20) throw new Error("Local import storage limit reached (20 projects).")
    const id = randomUUID()
    const destination = path.join(this.importedRoot, id)
    try {
      await extractSafeZip(archive, destination)
      const root = fs.realpathSync(projectRootFromArchive(destination))
      const detection = detectProject(root, this.applicationRoot)
      const sourceRoot = path.join(root, detection.sourceDirectory ?? "src")
      if (!detection.supported || !fs.existsSync(sourceRoot)) throw new Error(detection.reason ?? "Project is not supported.")
      const record: ProjectRecord = { id, name: name.replace(/\.zip$/i, "") || "Imported project", root, sourceRoot, imported: true, detection, history: new MutationHistory() }
      this.projects.set(id, record)
      return record
    } catch (error) {
      await fs.promises.rm(destination, { recursive: true, force: true })
      throw error
    }
  }

  createSession(projectId: string, scope = operations, binding?: SessionBinding): PreviewSession | undefined {
    const project = this.projects.get(projectId)
    if (!project || binding && !binding.check("inspect") || !isWithin(project.root, fs.realpathSync(project.sourceRoot))) return undefined
    this.durable(projectId)
    const previewId = randomUUID()
    const capability = randomBytes(32).toString("base64url")
    for (const [id, entry] of this.sessions) if (entry.expiresAt <= this.now()) this.sessions.delete(id)
    if (this.sessions.size >= 100) throw new Error("Too many preview sessions.")
    const expiresAt = Math.min(this.now() + 10 * 60_000, binding?.grant.expiresAt ?? Infinity)
    this.sessions.set(previewId, { projectId, tokenHash: sha(capability), expiresAt, root: fs.realpathSync(this.projects.get(projectId)!.sourceRoot), operations: [...scope], binding })
    return { projectId, previewId, capability, expiresAt: new Date(expiresAt).toISOString() }
  }

  authorize(projectId: string, previewId: string, capability: string, operation: SessionOperation = "inspect") {
    const session = this.sessions.get(previewId)
    if (!session || session.projectId !== projectId || session.expiresAt <= this.now() || !session.operations.includes(operation) || session.binding && !session.binding.check(operation)) return false
    const supplied = Buffer.from(sha(capability))
    const expected = Buffer.from(session.tokenHash)
    return supplied.length === expected.length && timingSafeEqual(supplied, expected)
  }

  sessionBinding(projectId: string, previewId: string) { const session = this.sessions.get(previewId); return session?.projectId === projectId ? session.binding : undefined }
  sessionOwner(projectId: string, previewId: string): RunnerOwner {
    const binding = this.sessionBinding(projectId, previewId)
    return { userId: binding?.grant.userId ?? "local-operator", workspaceId: binding?.grant.workspaceId ?? "local-workspace", projectId, sessionId: previewId }
  }
  runnerAuthorized(owner: RunnerOwner) {
    const current = this.sessionOwner(owner.projectId, owner.sessionId)
    return this.sessionActive(owner.projectId, owner.sessionId) && current.userId === owner.userId && current.workspaceId === owner.workspaceId
  }
  async discardImport(projectId: string) {
    const project = this.projects.get(projectId)
    if (!project?.imported) throw new Error("Only a newly imported project can be discarded.")
    this.projects.delete(projectId)
    await fs.promises.rm(path.join(this.importedRoot, projectId), { recursive: true, force: true })
  }
  sessionExpiry(projectId: string, previewId: string) { const session = this.sessions.get(previewId); return session?.projectId === projectId ? session.expiresAt : undefined }
  sessionActive(projectId: string, previewId: string) {
    const session = this.sessions.get(previewId), project = this.projects.get(projectId)
    try { return Boolean(project && session && session.projectId === projectId && session.expiresAt > this.now() && session.operations.includes("preview") && (!session.binding || session.binding.check("preview")) && session.root === fs.realpathSync(project.sourceRoot) && isWithin(project.root, session.root)) } catch { return false }
  }
  revokeSession(projectId: string, previewId: string) { if (this.sessions.get(previewId)?.projectId === projectId) this.sessions.delete(previewId) }

  store(projectId: string, authority?: SessionAuthority): SourceStore | undefined {
    const project = this.projects.get(projectId)
    if (!project) return undefined
    let directory: string
    try { directory = assertSourceDirectory(project) } catch { return undefined }
    const canonical = fs.realpathSync(project.sourceRoot)
    if (!isWithin(project.root, canonical) || canonical === project.root) return undefined
    const allowed = (file: string) => file.startsWith(directory + "/") && sourceExtension.test(file) && safeArchivePath(file) === file
    const absolute = (file: string) => path.resolve(project.root, file)
    const confined = (target: string) => {
      if (!fs.existsSync(target)) return false
      const actual = fs.realpathSync(target)
      return isWithin(canonical, actual) && actual !== canonical
    }
    return {
      tailwind: project.detection.tailwind,
      read(file) { if (!allowed(file)) return undefined; const target = absolute(file); return confined(target) ? fs.readFileSync(target, "utf8") : undefined },
      write: (file, content, expectedContent) => {
        const checkAuthority = () => {
          if (!authority || !["mutate", "undo", "redo"].includes(authority.operation) || !this.authorize(projectId, authority.previewId, authority.capability, authority.operation) || this.sessions.get(authority.previewId)?.root !== fs.realpathSync(project.sourceRoot)) throw new Error("Source write is not authorized.")
        }
        checkAuthority()
        if (!allowed(file) || Buffer.byteLength(content) > ZIP_LIMITS.fileBytes) throw new Error("Mutation target or size is not allowed.")
        const target = absolute(file)
        if (!confined(target) || fs.lstatSync(target).isSymbolicLink()) throw new Error("Mutation target is outside the project source root or is a link.")
        const original = fs.statSync(target)
        if (!original.isFile() || original.nlink !== 1) throw new Error("Source file identity changed.")
        if (expectedContent === undefined || fs.readFileSync(target, "utf8") !== expectedContent) throw new Error("Source changed before commit.")
        const temporary = path.join(path.dirname(target), `.wcb-transaction-${randomUUID()}.tmp`)
        try {
          fs.writeFileSync(temporary, content, { flag: "wx", mode: original.mode & 0o777 })
          checkAuthority()
          const current = fs.lstatSync(target)
          if (!confined(target) || !current.isFile() || current.nlink !== 1 || current.ino !== original.ino || current.dev !== original.dev || fs.readFileSync(target, "utf8") !== expectedContent) throw new Error("Source file identity changed before commit.")
          fs.renameSync(temporary, target)
        } finally { fs.rmSync(temporary, { force: true }) }
      },
    }
  }

  async withPreviewSource<T>(projectId: string, authority: SessionAuthority, action: (project: ProjectRecord, files: Map<string, string>) => Promise<T>) {
    if (!this.authorize(projectId, authority.previewId, authority.capability, "preview")) throw new Error("Preview source is unauthorized.")
    return action(this.get(projectId)!, this.durable(projectId).files())
  }

  sourceFiles(projectId: string) {
    const project = this.projects.get(projectId)
    if (!project || !fs.existsSync(project.sourceRoot)) return []
    return fs.readdirSync(project.sourceRoot, { recursive: true }).filter((entry): entry is string => typeof entry === "string" && /\.(tsx|jsx|ts|js)$/.test(entry)).map((entry) => `${sourceDirectory(project)}/${entry.split(path.sep).join("/")}`)
  }

  revision(projectId: string) {
    return this.projects.has(projectId) ? this.durable(projectId).revision() : ""
  }

  entryPath(projectId: string) {
    const project = this.projects.get(projectId)
    if (!project?.detection.entry) return undefined
    return path.join(project.root, project.detection.entry)
  }
}
