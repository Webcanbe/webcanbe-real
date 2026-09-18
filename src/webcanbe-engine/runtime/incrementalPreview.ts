import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { refreshChanges } from "./refreshPolicy"
import { context, type BuildContext, type BuildOptions, type BuildResult, type OnLoadResult } from "esbuild"
import { performance } from "node:perf_hooks"
import type { PreviewSnapshot } from "./controlledPreview"

/** Owned by one preview session. esbuild retains its dependency/parse graph;
 * our onLoad cache avoids re-instrumenting byte-identical JSX. Config identity
 * changes replace contexts. Nothing resolves through host node_modules. */
export class IncrementalPreviewCompiler {
  constructor(readonly fastRefresh = false) {}
  private checkoutDirectory?: string
  /** Ephemeral, per-generation compiler input cache; not durable source. */
  hostedCheckout() {
    if (this.closed) throw new Error("Preview compiler is closed.")
    return this.checkoutDirectory ??= fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "wcb-compiler-checkout-")))
  }
  refreshFallback?: string
  private readonly contexts = new Map<string, { fingerprint: string; context: BuildContext }>()
  readonly transforms = new Map<string, { source: string; result: OnLoadResult }>()
  configurationChanged = false
  lastBuildMs = 0
  builds = 0
  private closed = false
  async build(key: string, fingerprint: string, options: BuildOptions): Promise<BuildResult> {
    if (this.closed) throw new Error("Preview compiler is closed.")
    let entry = this.contexts.get(key)
    if (key === "app") this.configurationChanged = Boolean(entry && entry.fingerprint !== fingerprint)
    if (entry?.fingerprint !== fingerprint) { await entry?.context.dispose(); this.contexts.delete(key); entry = undefined; if (key === "app") this.transforms.clear() }
    if (!entry) { entry = { fingerprint, context: await context(options) }; this.contexts.set(key, entry) }
    const started = performance.now(), timeout = setTimeout(() => { void entry!.context.cancel() }, 15_000)
    try { const result = await entry.context.rebuild(); this.builds++; return result }
    finally { clearTimeout(timeout); this.lastBuildMs = performance.now() - started }
  }
  async close() { this.closed = true; await Promise.all([...this.contexts.values()].map(entry => entry.context.dispose())); this.contexts.clear(); this.transforms.clear(); if (this.checkoutDirectory) fs.rmSync(this.checkoutDirectory, { recursive: true, force: true }) }
}
export type PreviewUpdateKind = "css-hot-update" | "react-fast-refresh" | "incremental-rebuild-reload" | "generation-restart"
export type PreviewUpdate = Readonly<{ expectedRevision: string; expectedDigest: string; revision: string; snapshot: PreviewSnapshot; kind: Exclude<PreviewUpdateKind, "generation-restart"> }>
export function classifyPreviewUpdate(before: PreviewSnapshot, after: PreviewSnapshot): Exclude<PreviewUpdateKind, "generation-restart"> {
  const old = new Map(before.files.map(file => [file.path, file]))
  if (before.html === after.html && before.files.length === after.files.length && after.files.every(file => {
    const previous = old.get(file.path)
    return previous && previous.contentType === file.contentType && (file.path.endsWith(".css") || file.base64 === previous.base64)
  })) return "css-hot-update"
  if (refreshChanges(before, after)) return "react-fast-refresh"
  return "incremental-rebuild-reload"
}
