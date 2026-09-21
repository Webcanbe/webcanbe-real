export function shouldUseHostedEditor(origin: string, editorMode?: string | null, productReadMode?: string | null) {
  return editorMode === "hosted" || (origin === "https://webcanbe.com" && productReadMode === "hosted")
}

export function hostedEditorMode() {
  if (typeof document === "undefined" || typeof window === "undefined") return false
  return shouldUseHostedEditor(
    window.location.origin,
    document.querySelector('meta[name="wcb-editor-mode"]')?.getAttribute("content"),
    document.querySelector('meta[name="wcb-product-read-mode"]')?.getAttribute("content"),
  )
}
