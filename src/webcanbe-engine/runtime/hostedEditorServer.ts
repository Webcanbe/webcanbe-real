import fs from "node:fs"
import path from "node:path"
import { createServer, type ServerOptions } from "node:https"
import { HostedEditor } from "./hostedEditor"
import { safeArchivePath, isWithin } from "./projectRegistry"
import { hostedRasterViewerDocument, hostedRasterViewerHeaders } from "./rasterViewer"

/** TLS-serving application entry point. Only platform dist files are served;
 * imported sources/config/artifacts never enter this static namespace. */
export function hostedEditorServer(editor: HostedEditor, tls: ServerOptions, distribution: string) {
  if (!tls.key || !tls.cert) throw new Error("The hosted editor requires a TLS listener.")
  const root = fs.realpathSync(distribution), editorHost = new URL(editor.options.origins.editorOrigin).host, viewerHost = new URL(editor.options.origins.viewerOrigin).host
  let analyticsOrigin = ""
  if (process.env.VITE_POSTHOG_PROJECT_TOKEN && process.env.VITE_POSTHOG_HOST) {
    try {
      const endpoint = new URL(process.env.VITE_POSTHOG_HOST)
      if (endpoint.protocol === "https:" && !endpoint.username && !endpoint.password) analyticsOrigin = ` ${endpoint.origin}`
    } catch { /* Invalid analytics configuration stays disabled by CSP. */ }
  }
  const types: Record<string,string> = { ".js":"text/javascript", ".css":"text/css", ".svg":"image/svg+xml", ".png":"image/png", ".ico":"image/x-icon", ".woff2":"font/woff2" }
  const server = createServer({ ...tls, minVersion: "TLSv1.2" }, (request, response) => {
    void (async () => {
      if (request.headers.host === viewerHost) {
        if (request.method !== "GET" || request.url !== "/") { response.writeHead(404); response.end(); return }
        response.writeHead(200,hostedRasterViewerHeaders(editor.options.origins.editorOrigin)); response.end(hostedRasterViewerDocument(editor.options.origins.editorOrigin)); return
      }
      if (request.headers.host !== editorHost) { response.writeHead(403); response.end(); return }
      if (await editor.handle(request,response)) return
      if (request.method !== "GET") { response.writeHead(405); response.end(); return }
      const url = new URL(request.url ?? "/",editor.options.origins.editorOrigin)
      let file = decodeURIComponent(url.pathname).slice(1)
      const spaDocument = /^(?:browse|plans|login|signup|auth\/complete|dashboard|projects|purchases|settings|seller(?:\/projects(?:\/new)?)?|control|project\/[a-z0-9-]+|checkout\/[A-Za-z0-9_.:-]+|workspace\/(?:northstar|[a-f0-9-]{36}))$/
      const document = file === "" || file === "index.html" || spaDocument.test(file)
      if (document) file = "index.html"
      if (safeArchivePath(file) !== file || !document && !/^assets\/[a-zA-Z0-9_.-]+$/.test(file)) { response.writeHead(404); response.end(); return }
      const full = path.resolve(root,file)
      if (!fs.existsSync(full) || !isWithin(root,fs.realpathSync(full)) || !fs.statSync(full).isFile()) { response.writeHead(404); response.end(); return }
      if (document) {
        response.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","Content-Security-Policy":`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'${analyticsOrigin}; frame-src ${editor.options.origins.viewerOrigin}; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`})
        response.end(fs.readFileSync(full,"utf8").replace("</head>",'<meta name="wcb-editor-mode" content="hosted"></head>'))
      } else {
        const type = types[path.extname(file)]
        if (!type) { response.writeHead(404); response.end(); return }
        response.writeHead(200,{"Content-Type":type,"X-Content-Type-Options":"nosniff","Cache-Control":"public, max-age=3600"}); fs.createReadStream(full).pipe(response)
      }
    })().catch(() => { if (response.headersSent) response.destroy(); else { response.writeHead(400); response.end() } })
  })
  server.headersTimeout=5000;server.requestTimeout=20000;server.keepAliveTimeout=1000;server.maxConnections=64
  server.on("upgrade",(_req,socket)=>socket.destroy())
  return server
}
