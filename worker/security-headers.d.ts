export const CONTENT_SECURITY_POLICY: string
export const SECURITY_HEADERS: Readonly<Record<string, string>>
export const PREVIEW_RUNTIME_SECURITY_HEADERS: Readonly<Record<string, string>>
export function isKnownAppPath(path: string): boolean
export function shouldNoIndexPath(path: string): boolean
export function applySecurityHeaders(response: Response, options?: { noIndex?: boolean }): Response
export function applyPreviewRuntimeHeaders(response: Response): Response
