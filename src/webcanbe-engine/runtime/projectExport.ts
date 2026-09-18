import fs from "node:fs"
import path from "node:path"
import { ZipFile } from "yazl"
import { isWithin, safeArchivePath, ZIP_LIMITS, type ProjectRecord } from "./projectRegistry"
import { archiveMemberLimit } from "./intakeMetadata"

export async function exportProjectZip(project: ProjectRecord): Promise<Buffer> {
  const root = fs.realpathSync(project.archiveRoot ?? project.root)
  if (!isWithin(root, fs.realpathSync(project.root))) throw new Error("Registered application root escaped its archive.")
  const files = new Map<string, Buffer>()
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name), relative = path.relative(root, file).split(path.sep).join("/")
      if (!safeArchivePath(relative) || entry.isSymbolicLink() || !isWithin(root, fs.realpathSync(file))) throw new Error("Unsafe export path.")
      if (entry.isDirectory()) walk(file)
      else if (entry.isFile()) files.set(relative, fs.readFileSync(file))
      else throw new Error("Unsupported export file.")
    }
  }
  walk(root)
  return exportProjectFiles(files)
}

/** Canonical in-memory counterpart used by the hosted product controller.
 * It shares the Phase-2 exporter and never materializes or executes source. */
export async function exportProjectFiles(files: ReadonlyMap<string, Buffer>): Promise<Buffer> {
  const zip = new ZipFile()
  let total = 0, entries = 0
  for (const [relative, input] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
    const bytes = Buffer.from(input); total += bytes.length
    if (safeArchivePath(relative) !== relative || ++entries > ZIP_LIMITS.entries || total > ZIP_LIMITS.totalBytes || bytes.length > archiveMemberLimit(relative)) throw new Error("Export exceeds project limits.")
    zip.addBuffer(bytes, relative)
  }
  const result = new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    zip.outputStream.on("data", chunk => chunks.push(chunk))
    zip.outputStream.on("end", () => resolve(Buffer.concat(chunks)))
    zip.outputStream.on("error", reject)
  })
  zip.end()
  return result
}
