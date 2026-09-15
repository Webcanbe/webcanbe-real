import { request } from 'node:https'
import { lookup } from 'node:dns/promises'
import { createHash } from 'node:crypto'
import ts from 'typescript'
import postcss from 'postcss'
import { parse, serialize } from 'parse5'
import { publicSourceAddress } from './externalSource'
import type { HttpPreviewBuild } from './isolatedPreview'
import type { RuntimeValueScope } from './publicRuntimeValues'
export type StaticAssetScope=RuntimeValueScope & { signal:AbortSignal; assertCurrent:()=>Promise<void> }
type Response={status:number;headers:Record<string,string|undefined>;body:Buffer}
export type AssetNetwork={resolve:(hostname:string)=>Promise<string[]>;get:(url:URL,addresses:string[],signal:AbortSignal)=>Promise<Response>}
export const STATIC_ASSET_LIMITS=Object.freeze({bytes:2*1024*1024,totalBytes:8*1024*1024,files:48,redirects:3,deadlineMs:10000,concurrency:4})
const sha=(v:Buffer|string)=>createHash('sha256').update(v).digest('hex')
export function staticAssetUrl(input:string) {
  if(input.length>2048||/[\x00-\x20\x7f\\]/.test(input))throw Error('Invalid static asset URL.')
  const url=new URL(input)
  if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443'||url.hash||!url.hostname.includes('.')||url.hostname.endsWith('.')||url.hostname.includes(':')||/(?:^|\.)(?:localhost|local|internal|invalid|test|example)$/.test(url.hostname))throw Error('Static assets require public credential-free HTTPS.')
  if(/^[0-9.]+$/.test(url.hostname)&&!publicSourceAddress(url.hostname))throw Error('Static asset destination is reserved.')
  if([...url.searchParams.keys()].some(k=>/token|secret|password|key|auth|credential|signature/i.test(k)))throw Error('Authenticated static resources are unsupported.')
  return url
}
const network:AssetNetwork={
  resolve:async hostname=>(await lookup(hostname,{family:4,all:true})).map(v=>v.address),
  get:(url,addresses,signal)=>new Promise((resolve,reject)=>{
    let done=false
    const finish=(error?:Error,result?:Response)=>{if(done)return;done=true;clearTimeout(timer);signal.removeEventListener('abort',abort);error?reject(error):resolve(result!)}
    const req=request(url,{method:'GET',agent:false,maxHeaderSize:16384,headers:{'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 WebCanBe-static-assets/1.0','Accept':'image/png,image/jpeg,image/gif,image/webp,image/avif,font/woff2,font/woff,font/ttf,font/otf,text/css','Accept-Encoding':'identity'},lookup:(_host,options,callback)=>{if(options.all)callback(null,addresses.map(address=>({address,family:4})));else callback(null,addresses[0],4)}},res=>{
      const headers=Object.fromEntries(Object.entries(res.headers).map(([k,v])=>[k,Array.isArray(v)?v.join(','):v]))
      if(headers['content-encoding']&&headers['content-encoding']!=='identity'||Number(headers['content-length']??0)>STATIC_ASSET_LIMITS.bytes){res.destroy();req.destroy();finish(Error('Encoded/oversized static response rejected.'));return}
      const chunks:Buffer[]=[];let size=0
      res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>STATIC_ASSET_LIMITS.bytes){res.destroy();req.destroy();finish(Error('Static response byte limit exceeded.'))}else chunks.push(chunk)})
      res.on('error',()=>finish(Error('Static transfer failed.')));res.on('end',()=>finish(undefined,{status:res.statusCode??0,headers,body:Buffer.concat(chunks)}))
    })
    const abort=()=>{req.destroy();finish(Error('Static transfer cancelled.'))}
    const timer=setTimeout(()=>{req.destroy();finish(Error('Static transfer deadline exceeded.'))},STATIC_ASSET_LIMITS.deadlineMs)
    req.on('error',()=>finish(Error('Static transfer failed.')));signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();else req.end()
  })
}
function contentType(response:Response,expected:'css'|'binary') {
  const mime=response.headers['content-type']?.split(';')[0].trim().toLowerCase(),b=response.body,ascii=(n:number)=>b.subarray(0,n).toString('latin1')
  const types:Record<string,[string,()=>boolean]>={
    'image/png':['png',()=>b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))],
    'image/jpeg':['jpg',()=>b.length>3&&b[0]===255&&b[1]===216&&b[2]===255],
    'image/gif':['gif',()=>['GIF87a','GIF89a'].includes(ascii(6))],
    'image/webp':['webp',()=>ascii(4)==='RIFF'&&b.subarray(8,12).toString()==='WEBP'],
    'image/avif':['avif',()=>b.subarray(4,8).toString()==='ftyp'&&['avif','avis'].includes(b.subarray(8,12).toString())],
    'font/woff':['woff',()=>ascii(4)==='wOFF'],'font/woff2':['woff2',()=>ascii(4)==='wOF2'],
    'font/ttf':['ttf',()=>b.subarray(0,4).equals(Buffer.from([0,1,0,0]))],
    'font/otf':['otf',()=>ascii(4)==='OTTO'],
  }
  if(expected==='css'&&mime==='text/css'){new TextDecoder('utf-8',{fatal:true}).decode(b);return {mime,ext:'css'}}
  const record=mime?types[mime]:undefined
  if(expected!=='binary'||!record||!record[1]())throw Error('Static MIME/signature rejected; active content is forbidden.')
  return {mime:mime!,ext:record[0]}
}
/** No URL endpoint is exposed. The operator calls this only on an authorized compiled source snapshot. */
export class TrustedStaticAssets {
  private active=0
  private networkActive=0
  constructor(private readonly net:AssetNetwork=network){}
  async materialize(build:HttpPreviewBuild,scope:StaticAssetScope) {
    await scope.assertCurrent();if(scope.signal.aborted)throw Error('Static authority expired.')
    if(this.active>=STATIC_ASSET_LIMITS.concurrency)throw Error('Static fetch capacity reached.')
    this.active++
    const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,STATIC_ASSET_LIMITS.deadlineMs)
    scope.signal.addEventListener('abort',abort,{once:true})
    const check=async()=>{await scope.assertCurrent();if(scope.signal.aborted||controller.signal.aborted)throw Error('Static fetch authority/deadline expired.')}
    // Content-addressed cache is snapshot-scoped; no cross-tenant URL cache or stale authority grants.
    const files=new Map(build.files),cache=new Map<string,string>(),pending=new Set<string>(),audit:Array<{urlSha256:string;contentSha256:string;bytes:number;mime:string;redirects:number}>=[]
    let total=0,requests=0
    const bounded=<T>(promise:Promise<T>)=>new Promise<T>((resolve,reject)=>{const cancel=()=>reject(Error('Static fetch deadline/authority expired.'));controller.signal.addEventListener('abort',cancel,{once:true});promise.then(resolve,reject).finally(()=>controller.signal.removeEventListener('abort',cancel));if(controller.signal.aborted)cancel()})
    const fetchAsset=async(input:string,expected:'css'|'binary',depth=0):Promise<string>=>{
      await check();const url=staticAssetUrl(input),key=expected+':'+url.href
      if(cache.has(key))return cache.get(key)!
      if(depth>4||pending.has(key)||++requests>STATIC_ASSET_LIMITS.files)throw Error('Static import cycle/count limit exceeded.')
      pending.add(key)
      let current=url,response:Response|undefined,hops=0
      for(;;) {
        await check();const addresses=await bounded(this.net.resolve(current.hostname));await check()
        if(!addresses.length||addresses.length>32||addresses.some(a=>!publicSourceAddress(a)))throw Error('Static DNS destination rejected.')
        if(this.networkActive>=STATIC_ASSET_LIMITS.concurrency)throw Error('Static network capacity reached.')
        this.networkActive++
        try { response=await bounded(this.net.get(current,[...addresses],controller.signal)) } finally { this.networkActive-- }
        await check()
        if(response.body.length>STATIC_ASSET_LIMITS.bytes||response.headers['content-encoding']&&response.headers['content-encoding']!=='identity')throw Error('Static size/encoding rejected.')
        total+=response.body.length;if(total>STATIC_ASSET_LIMITS.totalBytes)throw Error('Static aggregate byte limit exceeded.')
        if([301,302,303,307,308].includes(response.status)) {
          if(++hops>STATIC_ASSET_LIMITS.redirects||!response.headers.location)throw Error('Static redirect limit exceeded.')
          current=staticAssetUrl(new URL(response.headers.location,current).href);continue
        }
        if(response.status!==200)throw Error('Static response status rejected.')
        break
      }
      const type=contentType(response,expected),rawHash=sha(response.body)
      const body=expected==='css'?Buffer.from(await rewriteCss(response.body.toString('utf8'),current.href,depth+1)):Buffer.from(response.body)
      const digest=sha(body),local='/_wcb/static/'+digest+'.'+type.ext
      if(body.length>STATIC_ASSET_LIMITS.bytes)throw Error('Static transformed byte limit exceeded.')
      files.set(local,{body,contentType:type.mime});cache.set(key,local);pending.delete(key)
      audit.push({urlSha256:sha(url.href),contentSha256:rawHash,bytes:response.body.length,mime:type.mime,redirects:hops})
      return local
    }
    const resource=async(value:string,base:string|undefined,kind:'css'|'binary',depth:number)=>{
      if(value.includes('\\'))throw Error('Escaped CSS resource URLs are unsupported.')
      // Source-origin SVG data images already belong to the isolated application.
      // This grants no remote fetch; remote stylesheets retain the stricter binary-only policy.
      if(!base&&/^data:image\/svg\+xml[,;]/i.test(value))return value
      if(value.startsWith('data:')) {if(!/^data:(?:image\/(?:png|jpeg|gif|webp|avif)|font\/(?:woff2?|ttf|otf));base64,[a-zA-Z0-9+/=]+$/.test(value))throw Error('Unsupported static data URL.');return value}
      if(base)return fetchAsset(new URL(value,base).href,kind,depth)
      return /^https?:\/\//i.test(value)?fetchAsset(value,kind,depth):value
    }
    const rewriteCss=async(code:string,base?:string,depth=0)=>{
      if(/[\x00-\x08\x0b\x0e-\x1f]/.test(code))throw Error('Escaped/control CSS resource syntax is unsupported.')
      const root=postcss.parse(code),imports:any[]=[],decls:any[]=[]
      root.walkAtRules('import',r=>{imports.push(r)});root.walkDecls(d=>{if(/url\(/i.test(d.value))decls.push(d)})
      for(const rule of imports) {
        const match=/^(?:url\(\s*)?["']([^"']+)["']\s*\)?\s*$/.exec(rule.params)
        if(!match)throw Error('Only finite unconditional CSS imports are supported.')
        rule.params=JSON.stringify(await resource(match[1],base,'css',depth))
      }
      const pattern=/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s()"']+))\s*\)/gi
      const values=[...new Set<string>(decls.flatMap(d=>[...d.value.matchAll(pattern)].map((m:any)=>m[1]??m[2]??m[3])))],replacements=new Map<string,string>()
      for(let i=0;i<values.length;i+=STATIC_ASSET_LIMITS.concurrency)await Promise.all(values.slice(i,i+STATIC_ASSET_LIMITS.concurrency).map(async value=>{replacements.set(value,await resource(value,base,'binary',depth))}))
      for(const d of decls) {
        let count=0;d.value=d.value.replace(pattern,(_all:string,a:string,b:string,c:string)=>{count++;return 'url('+JSON.stringify(replacements.get(a??b??c))+')'})
        if(!count)throw Error('Unsupported CSS URL expression.')
      }
      return root.toString()
    }
    try {
      for(const [name,file]of build.files) {
        if(file.contentType.startsWith('text/css'))files.set(name,{...file,body:Buffer.from(await rewriteCss(file.body.toString()))})
        if(file.contentType.startsWith('text/javascript')) {
          const code=file.body.toString(),source=ts.createSourceFile('artifact.js',code,ts.ScriptTarget.Latest,true),edits:Array<{start:number;end:number;url:string}>=[]
          const visit=(n:ts.Node)=>{if(ts.isStringLiteral(n)&&/^https:\/\//i.test(n.text)&&/\.(?:png|jpe?g|gif|webp|avif|woff2?|ttf|otf)(?:\?|$)/i.test(n.text))edits.push({start:n.getStart(source),end:n.end,url:n.text});ts.forEachChild(n,visit)};visit(source)
          const urls=[...new Set(edits.map(e=>e.url))],replacements=new Map<string,string>()
          for(let i=0;i<urls.length;i+=STATIC_ASSET_LIMITS.concurrency)await Promise.all(urls.slice(i,i+STATIC_ASSET_LIMITS.concurrency).map(async url=>{replacements.set(url,await fetchAsset(url,'binary'))}))
          let rewritten=code;for(const e of edits.reverse())rewritten=rewritten.slice(0,e.start)+JSON.stringify(replacements.get(e.url))+rewritten.slice(e.end)
          files.set(name,{...file,body:Buffer.from(rewritten)})
        }
      }
      const document=parse(build.html)
      const walk=async(node:any):Promise<void>=>{
        if(node.attrs)for(const attr of node.attrs) {
          const rel=node.attrs.find((a:any)=>a.name==='rel')?.value
          if(node.tagName==='link'&&attr.name==='href'&&rel==='stylesheet')attr.value=await resource(attr.value,undefined,'css',0)
          if((node.tagName==='img'||node.tagName==='link'&&['icon','apple-touch-icon'].includes(rel))&&['src','href'].includes(attr.name))attr.value=await resource(attr.value,undefined,'binary',0)
        }
        for(const child of node.childNodes??[])await walk(child)
      }
      await walk(document);await check()
      audit.sort((a,b)=>a.urlSha256.localeCompare(b.urlSha256))
      const auditBody=Buffer.from(JSON.stringify({schema:1,projectId:scope.projectId,revision:scope.revision,assets:audit}));if(audit.length)files.set('/_wcb/static/audit-'+sha(auditBody)+'.json',{body:auditBody,contentType:'application/json'})
      if(files.size>2000||[...files.values()].reduce((n,f)=>n+f.body.length,0)>32*1024*1024)throw Error('Static snapshot limit exceeded.')
      return {files,html:serialize(document),audit:Object.freeze(audit)}
    } catch(error) {
      const failure=Error((error as Error).message) as Error & {staticAssetAudit:unknown}
      failure.staticAssetAudit=audit.map(a=>({...a}));throw failure
    } finally {clearTimeout(timer);controller.abort();scope.signal.removeEventListener('abort',abort);this.active--}
  }
}
