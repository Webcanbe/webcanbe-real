import type { CompatibilityKind, CompatibilitySummary, ElementCapabilities, SourceTarget } from "./types"

export function deriveCompatibility(capabilities: ElementCapabilities): CompatibilityKind {
  if (capabilities.visualEdit && (capabilities.text || capabilities.spacing || capabilities.color || capabilities.typography || capabilities.size)) return "full"
  if (capabilities.visualEdit) return "partial"
  return "code-only"
}

export function summarizeCompatibility(targets: SourceTarget[]): CompatibilitySummary {
  const total = targets.length
  const full = targets.filter((target) => target.compatibility === "full").length
  const partial = targets.filter((target) => target.compatibility === "partial").length
  const codeOnly = total - full - partial
  return { total, full, partial, codeOnly, score: total ? Math.round(((full + partial * 0.5) / total) * 100) : 0 }
}
