import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { transform } from "esbuild"
import postcss from "postcss"
import type { SourceValidation } from "../core/types"
import type { ProjectRecord } from "../runtime/projectRegistry"
import { buildIsolatedHttpPreview } from "../runtime/isolatedPreview"
import { editableSource } from "./durableSource"

/** Parsing and the existing confined compiler only. Uploaded configs, scripts,
 * plugins, lifecycle hooks and TypeScript plugins are never executed. */
export async function validateSource(files: Map<string, string>, level: SourceValidation["level"] = "parse"): Promise<SourceValidation> {
  const diagnostics: SourceValidation["diagnostics"] = []
  for (const [file, source] of files) {
    try {
      if (!editableSource.test(file) || typeof source !== "string" || Buffer.byteLength(source) > 2 * 1024 * 1024 || source.includes("\0")) throw new Error("Unsupported source path or size.")
      if (file.endsWith(".json")) JSON.parse(source)
      else if (file.endsWith(".css")) postcss.parse(source, { from: file })
      else await transform(source, { loader: file.endsWith(".tsx") ? "tsx" : file.endsWith(".ts") ? "ts" : "jsx", sourcefile: file, logLevel: "silent" })
    } catch (error) {
      const detail = error as { errors?: Array<{ text: string; location?: { line: number; column: number } }>; reason?: string; message?: string; line?: number; column?: number }
      if (detail.errors?.length) diagnostics.push(...detail.errors.map(item => ({ file, message: item.text, line: item.location?.line, column: item.location?.column })))
      else diagnostics.push({ file, message: detail.reason ?? detail.message?.slice(0, 1000) ?? "Source could not be parsed.", line: detail.line, column: detail.column })
    }
  }
  return { level, passed: diagnostics.length === 0, diagnostics }
}

export async function validateStagedProject(project: ProjectRecord, applicationRoot: string, files: Map<string, string>, level: "compile" | "checkpoint"): Promise<SourceValidation> {
  const validation = await validateSource(files, level)
  if (!validation.passed) return validation
  const stage = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "wcb-source-validation-")))
  try {
    fs.cpSync(project.root, stage, { recursive: true, filter: source => {
      const stat = fs.lstatSync(source)
      if (stat.isSymbolicLink() || (stat.isFile() && stat.nlink !== 1)) throw new Error("Validation source contains a link.")
      return !["node_modules", ".git", ".webcanbe"].includes(path.basename(source))
    } })
    for (const entry of fs.readdirSync(path.join(stage, "src"), { recursive: true })) {
      const file = `src/${String(entry).split(path.sep).join("/")}`
      if (editableSource.test(file) && !files.has(file)) fs.unlinkSync(path.join(stage, file))
    }
    for (const [file, content] of files) { fs.mkdirSync(path.dirname(path.join(stage, file)), { recursive: true }); fs.writeFileSync(path.join(stage, file), content) }
    // The same compiler handles HashRouter and BrowserRouter artifacts. It does
    // not launch project JavaScript; only RunnerProvider can do that in strict mode.
    await buildIsolatedHttpPreview({ ...project, root: stage, sourceRoot: path.join(stage, "src") }, applicationRoot)
  } catch (error) {
    validation.passed = false
    const errors = (error as { errors?: Array<{ text: string }> }).errors
    const message = errors?.length ? errors.map(item => item.text).join("\n") : error instanceof Error ? error.message : "Controlled compilation failed."
    validation.diagnostics.push({ file: "project", message: message.split(stage).join("<staged-project>").split(project.root).join("<project>").split(applicationRoot).join("<platform>").slice(0, 2000) })
  } finally { fs.rmSync(stage, { recursive: true, force: true }) }
  return validation
}
