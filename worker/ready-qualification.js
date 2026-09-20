import { analyzeReactSource } from "../src/webcanbe-engine/adapters/react/reactSourceAdapter.ts"
import { summarizeCompatibility } from "../src/webcanbe-engine/core/compatibility.ts"
import { sourceMember, verifyReleaseSnapshot } from "./materialization.js"

function readiness(compatibility) {
  if (compatibility.total > 0 && compatibility.full === compatibility.total) {
    return { status: "ready", reasons: [`All ${compatibility.total} inspected source targets support full Visual editing.`] }
  }
  if (compatibility.full + compatibility.partial > 0) {
    return {
      status: "partial",
      reasons: [`${compatibility.full} full, ${compatibility.partial} partial, and ${compatibility.codeOnly} code-only source targets were inspected.`],
    }
  }
  return {
    status: "code_only",
    reasons: [compatibility.total ? `All ${compatibility.total} inspected source targets are code-only.` : "No statically inspectable React source targets were found."],
  }
}

/**
 * Derive Ready from the immutable release bytes using the exact same React
 * source analyzer and compatibility summarizer as the retained Phase 3 store.
 * Operator/client input never supplies compatibility or qualification status.
 */
export function deriveReleaseReadiness(row) {
  const snapshot = verifyReleaseSnapshot(row)
  const directory = snapshot.history.sourceDirectory ?? "src"
  const text = new Map()
  const decoder = new TextDecoder("utf-8", { fatal: true })

  for (const [file, bytes] of snapshot.files) {
    if (sourceMember(file, directory, snapshot.history.sourceScope) && /\.[cm]?[jt]sx?$/.test(file)) {
      text.set(file, decoder.decode(bytes))
    }
  }

  const targets = [...text]
    .filter(([file]) => /\.[jt]sx$/.test(file))
    .flatMap(([file, code]) => analyzeReactSource(file, code, candidate => text.get(candidate)))
  const compatibility = summarizeCompatibility(targets)
  return Object.freeze({ compatibility: Object.freeze(compatibility), ...readiness(compatibility) })
}
