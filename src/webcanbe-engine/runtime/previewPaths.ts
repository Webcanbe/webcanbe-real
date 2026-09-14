export function previewResourcePath(raw: string) {
  if (raw.length > 4096 || !raw.startsWith("/") || raw.startsWith("//") || /[\\\x00-\x20\x7f#]/.test(raw)) return undefined
  try {
    const pathname = decodeURIComponent(raw.split("?")[0])
    if (/[\\%\x00-\x20\x7f]/.test(pathname) || pathname.includes("//") || pathname.split("/").some(part => part.startsWith("."))) return undefined
    if (/^\/(?:api|__webcanbe|src|node_modules)(?:\/|$)/i.test(pathname)) return undefined
    if (/(?:^|\/)(?:package(?:-lock)?\.json|.*\.map|.*\.[cm]?[jt]sx?|vite\.config[^/]*|tsconfig[^/]*)$/i.test(pathname) && !/^\/_wcb\/(?:app|bridge)\.js$/.test(pathname)) return undefined
    return pathname
  } catch { return undefined }
}
