import { createServer, type Server } from "node:http"
/** Serves only this trusted viewer. No project scripts, artifacts, credentials or APIs. */
function viewerDocument(parentCheck: string) { return String.raw`<!doctype html><meta charset="utf-8"><title>Controlled preview viewer</title><style>html,body{margin:0;overflow:hidden;background:#fff}img{display:block;user-select:none;-webkit-user-drag:none}textarea{position:absolute;width:2px;height:20px;opacity:.01;resize:none;pointer-events:none;padding:0;border:0}#status{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}</style><img alt="Rendered project. Interact to use its keyboard controls. F6 returns to the editor." draggable="false" tabindex="0"><textarea aria-label="Type into the isolated project. F6 returns to the editor." autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="4096" tabindex="-1"></textarea><div id="status" role="status" aria-live="polite"></div><script>
let generation='',revision='',sequence=0,select=true,composing=false,compositionToken='',ignoreCompositionInput=false;const img=document.querySelector('img'),sink=document.querySelector('textarea'),status=document.querySelector('#status');
function cancelComposition(){compositionToken='';composing=false;ignoreCompositionInput=false;sink.value='';sink.blur();}
addEventListener('message',event=>{
 if(event.source!==parent||${parentCheck})return;
 const d=event.data;if(d?.channel!=='wcb-raster'||typeof d.generation!=='string')return;
 if(d.type==='frame'&&typeof d.png==='string'&&d.png.length<12000000&&/^[A-Za-z0-9+/]+={0,2}$/.test(d.png)&&Number.isInteger(d.sequence)&&d.width>=320&&d.width<=1920&&d.height>=240&&d.height<=1080){if(generation!==d.generation||revision!==d.revision)cancelComposition();generation=d.generation;revision=d.revision;sequence=d.sequence;select=d.select;img.width=d.width;img.height=d.height;img.src='data:image/png;base64,'+d.png;if(d.focused){const label='Project '+d.focused.role+': '+d.focused.name;status.textContent=label;sink.setAttribute('aria-label',label+'. Type here; F6 returns to the editor.');}}
 if(d.type==='mode'&&d.generation===generation){select=d.select;if(select)cancelComposition();}
});
function send(input){if(generation)parent.postMessage({channel:'wcb-raster',type:'input',generation,sequence,input},'*');}
function text(value){if(typeof value==='string'&&value.length&&value.length<=4096&&!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value))send({type:'text',text:value});}
img.addEventListener('focus',()=>{if(!select)sink.focus({preventScroll:true});});
img.addEventListener('click',e=>{const r=img.getBoundingClientRect();sink.style.left=Math.max(0,Math.min(img.width-2,e.clientX-r.left))+'px';sink.style.top=Math.max(0,Math.min(img.height-20,e.clientY-r.top))+'px';(select?img:sink).focus({preventScroll:true});send({type:'pointer',action:select?'select':'click',x:(e.clientX-r.left)*img.width/r.width,y:(e.clientY-r.top)*img.height/r.height});});
addEventListener('keydown',e=>{
 if(e.key==='F6'){e.preventDefault();cancelComposition();parent.postMessage({channel:'wcb-raster',type:'focus-exit',generation,sequence},'*');return;}
 if(select||e.isComposing||composing)return;
 ignoreCompositionInput=false;
 if((e.ctrlKey||e.metaKey)&&['a','c'].includes(e.key.toLowerCase())){e.preventDefault();send({type:'key',key:e.key.toLowerCase()==='a'?'SelectAll':'CopySelection',shift:false});return;}
 if(e.ctrlKey||e.metaKey||e.altKey)return;
 if(['Tab','Enter','Escape','Backspace','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key)){e.preventDefault();send({type:'key',key:e.key,shift:e.shiftKey});}
 else if(e.target!==sink&&[...e.key].length===1){e.preventDefault();text(e.key);}
});
sink.addEventListener('paste',e=>{if(select)return;e.preventDefault();const value=e.clipboardData?.getData('text/plain');if(value?.length>4096){status.textContent='Paste limit: 4096 characters.';return;}text(value);sink.value='';});
sink.addEventListener('compositionstart',()=>{composing=true;compositionToken=generation+':'+revision;});
sink.addEventListener('compositionend',e=>{const accepted=compositionToken===generation+':'+revision&&!select;composing=false;compositionToken='';ignoreCompositionInput=true;if(accepted)text(e.data);sink.value='';});
sink.addEventListener('input',e=>{if(composing||e.isComposing||select)return;if(ignoreCompositionInput&&['insertCompositionText','insertFromComposition'].includes(e.inputType)){ignoreCompositionInput=false;sink.value='';return;}ignoreCompositionInput=false;text(sink.value);sink.value='';});
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
