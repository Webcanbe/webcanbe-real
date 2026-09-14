import { createServer, type Server } from "node:http"
/** Serves only this trusted viewer. No project scripts, artifacts, credentials or APIs. */
function viewerDocument(parentCheck: string) { return `<!doctype html><meta charset="utf-8"><title>Controlled preview viewer</title><style>html,body{margin:0;overflow:hidden;background:#fff}img{display:block;user-select:none;-webkit-user-drag:none}</style><img alt="Rendered project" draggable="false"><script>
let generation='',sequence=0,select=true;const img=document.querySelector('img');
addEventListener('message',event=>{
 if(event.source!==parent||${parentCheck})return;
 const d=event.data;if(d?.channel!=='wcb-raster'||typeof d.generation!=='string')return;
 if(d.type==='frame'&&typeof d.png==='string'&&d.png.length<12000000&&/^[A-Za-z0-9+/]+={0,2}$/.test(d.png)&&Number.isInteger(d.sequence)&&d.width>=320&&d.width<=1920&&d.height>=240&&d.height<=1080){generation=d.generation;sequence=d.sequence;select=d.select;img.width=d.width;img.height=d.height;img.src='data:image/png;base64,'+d.png;}
 if(d.type==='mode'&&d.generation===generation)select=d.select;
});
function send(input){if(generation)parent.postMessage({channel:'wcb-raster',type:'input',generation,sequence,input},'*');}
img.addEventListener('click',e=>{const r=img.getBoundingClientRect();send({type:'pointer',action:select?'select':'click',x:(e.clientX-r.left)*img.width/r.width,y:(e.clientY-r.top)*img.height/r.height});});
addEventListener('wheel',e=>{e.preventDefault();send({type:'scroll',dx:Math.max(-2000,Math.min(2000,e.deltaX)),dy:Math.max(-2000,Math.min(2000,e.deltaY))});},{passive:false});
</script>` }
const html = viewerDocument("!/^http:\\/\\/(localhost|127\\.0\\.0\\.1)(:\\d+)?$/.test(event.origin)")
/** Deployable static hosted viewer document. It has no account/session cookie,
 * artifact endpoint or project code; all frames arrive from the exact parent.
 * It must also be served with the same sandbox/CSP as the local viewer. */
export function hostedRasterViewerDocument(editorOrigin: string) {
  const origin = new URL(editorOrigin)
  if (origin.protocol !== "https:" || origin.origin !== editorOrigin) throw new Error("An exact HTTPS editor origin is required.")
  return viewerDocument("event.origin!==" + JSON.stringify(editorOrigin))
}
export class RasterViewerServer {
  private server?: Server
  private pending?: Promise<string>
  start(): Promise<string> {
    return this.pending ??= new Promise((resolve, reject) => {
      const server = this.server = createServer((req, res) => {
        if (req.method !== "GET" || req.url !== "/" || !/^wcb-view\.localhost:\d+$/.test(req.headers.host ?? "")) { res.writeHead(404); res.end(); return }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'; sandbox allow-scripts" })
        res.end(html)
      })
      server.on("error", reject)
      server.listen(0, "127.0.0.1", () => { const address = server.address(); if (!address || typeof address === "string") return reject(new Error("Viewer unavailable.")); resolve("http://wcb-view.localhost:" + address.port + "/") })
    })
  }
  async close() { await new Promise<void>(resolve => { if (!this.server) resolve(); else this.server.close(() => resolve()) }) }
}

/** Serve these headers on the separate viewer HTTPS origin. In particular the
 * response sandbox also protects direct navigation, outside an editor iframe. */
export function hostedRasterViewerHeaders(editorOrigin: string) {
  hostedRasterViewerDocument(editorOrigin) // validates the exact origin
  return { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Content-Security-Policy": `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors ${editorOrigin}; sandbox allow-scripts`, "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()" }
}
