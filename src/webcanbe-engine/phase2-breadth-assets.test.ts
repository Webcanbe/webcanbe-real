import {expect,it,vi} from 'vitest'
import {TrustedStaticAssets,staticAssetUrl,STATIC_ASSET_LIMITS,type AssetNetwork} from './runtime/staticAssets'
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')
const response=()=>({status:200,headers:{'content-type':'image/png'},body:png})
const scope=(check=async()=>{})=>({userId:'u',workspaceId:'w',projectId:'p',sessionId:'s',revision:'r',signal:new AbortController().signal,assertCurrent:check})
const build=(url='https://assets.publicdomain.com/picture.png')=>({html:'<div id="root"></div>',files:new Map([['/_wcb/app.js',{body:Buffer.from('const image='+JSON.stringify(url)+';'),contentType:'text/javascript'}]])})
const net=(patch:Partial<AssetNetwork>={}):AssetNetwork=>({resolve:async()=>['93.184.216.34'],get:async()=>response(),...patch})
it.each(['https://127.0.0.1/a.png','https://[::1]/a.png','https://10.1.2.3/a.png','https://172.16.1.1/a.png','https://192.168.1.1/a.png','https://169.254.169.254/latest/meta-data','https://100.100.100.200/a.png','https://0x7f000001/a.png','https://2130706433/a.png','https://user:password@assets.publicdomain.com/a.png','http://assets.publicdomain.com/a.png','https://assets.publicdomain.com:8443/a.png','https://service.internal/a.png','https://assets.publicdomain.com/a.png?token=abc'])('rejects unsafe URL %s before any request',url=>expect(()=>staticAssetUrl(url)).toThrow())
it.each(['127.0.0.1','::1','10.0.0.1','172.31.1.2','192.168.4.5','169.254.169.254','100.100.100.200','198.18.0.1','224.0.0.1','192.0.0.9','203.0.113.10'])('rejects DNS to %s',async address=>{const get=vi.fn();await expect(new TrustedStaticAssets(net({resolve:async()=>[address],get})).materialize(build(),scope())).rejects.toThrow('DNS');expect(get).not.toHaveBeenCalled()})
it('pins all validated DNS answers and hashes immutable bytes without forwarding headers',async()=>{
 const get=vi.fn(async(_url:URL,addresses:string[])=>{expect(addresses).toEqual(['93.184.216.34']);return response()});const input=build(),original=input.files.get('/_wcb/app.js')!.body.toString(),output=await new TrustedStaticAssets(net({get})).materialize(input,scope())
 expect(get).toHaveBeenCalledTimes(1);expect(output.files.get('/_wcb/app.js')!.body.toString()).toMatch(/\/_wcb\/static\/[a-f0-9]{64}\.png/);expect(input.files.get('/_wcb/app.js')!.body.toString()).toBe(original);expect(output.audit).toHaveLength(1);expect([...output.files.keys()].some(k=>k.endsWith('.json'))).toBe(true)
})
it('revalidates redirect DNS and blocks rebinding before the second request',async()=>{
 let dns=0;const get=vi.fn(async()=>({status:302,headers:{location:'https://rebound.publicdomain.com/a.png'},body:Buffer.alloc(0)}))
 await expect(new TrustedStaticAssets(net({resolve:async()=>++dns===1?['93.184.216.34']:['127.0.0.1'],get})).materialize(build(),scope())).rejects.toThrow('DNS');expect(get).toHaveBeenCalledTimes(1)
})
it.each(['oversized','redirect-loop','redirect-metadata','invalid-mime','invalid-signature','compressed','javascript','svg'])('rejects %s responses',async kind=>{
 const r:any=response();if(kind==='oversized')r.body=Buffer.alloc(STATIC_ASSET_LIMITS.bytes+1);if(kind.startsWith('redirect')){r.status=302;r.headers.location=kind==='redirect-loop'?'https://assets.publicdomain.com/a.png':'https://169.254.169.254/a.png'};if(kind==='invalid-mime')r.headers['content-type']='text/html';if(kind==='invalid-signature')r.body=Buffer.from('<html>');if(kind==='compressed')r.headers['content-encoding']='gzip';if(kind==='javascript')r.headers['content-type']='application/javascript';if(kind==='svg'){r.headers['content-type']='image/svg+xml';r.body=Buffer.from('<svg onload="alert(1)"/>')}
 await expect(new TrustedStaticAssets(net({get:async()=>r})).materialize(build(),scope())).rejects.toThrow()
})
it('cancels DNS timeout and late completion cannot authorize an HTTP request',async()=>{
 vi.useFakeTimers();try{const get=vi.fn(),pending=new TrustedStaticAssets(net({resolve:()=>new Promise(()=>{}),get})).materialize(build(),scope());const assertion=expect(pending).rejects.toThrow('deadline');await vi.advanceTimersByTimeAsync(STATIC_ASSET_LIMITS.deadlineMs+1);await assertion;expect(get).not.toHaveBeenCalled()}finally{vi.useRealTimers()}
})
it('rejects authorization loss during async fetch and before cache reuse',async()=>{
 let authorized=true;const check=async()=>{if(!authorized)throw Error('revoked')},service=new TrustedStaticAssets(net({get:async()=>{authorized=false;return response()}}));await expect(service.materialize(build(),scope(check))).rejects.toThrow('revoked');await expect(service.materialize(build(),scope(check))).rejects.toThrow('revoked')
})
it('materializes CSS imports and relative fonts, and rejects import cycles',async()=>{
 const input={html:'<link rel="stylesheet" href="https://styles.publicdomain.com/font.css">',files:new Map()},get=vi.fn(async(url:URL)=>url.pathname.endsWith('.css')?{status:200,headers:{'content-type':'text/css'},body:Buffer.from('@font-face{font-family:Test;src:url("font.woff2")}')}:{status:200,headers:{'content-type':'font/woff2'},body:Buffer.from('wOF2font')});const out=await new TrustedStaticAssets(net({get})).materialize(input,scope());expect(out.audit).toHaveLength(2);expect(out.html).toContain('/_wcb/static/');expect([...out.files.values()].filter(f=>f.contentType==='text/css')[0].body.toString()).toContain('/_wcb/static/');await expect(new TrustedStaticAssets(net({get:async()=>({status:200,headers:{'content-type':'text/css'},body:Buffer.from('@import "font.css";')})})).materialize(input,scope())).rejects.toThrow('cycle')
})
it('enforces service concurrency and refuses an already aborted scope',async()=>{
 const service=new TrustedStaticAssets(net({resolve:()=>new Promise(()=>{})})),controller=new AbortController(),s={...scope(),signal:controller.signal};const requests=Array.from({length:4},()=>service.materialize(build(),s).catch(e=>e));await new Promise(r=>setTimeout(r,5));await expect(service.materialize(build(),scope())).rejects.toThrow('capacity');controller.abort();await Promise.all(requests);await expect(service.materialize(build(),s)).rejects.toThrow('expired')
})
it('preserves already admitted source data images but refuses SVG supplied by remote CSS',async()=>{
 const css='body{background:url("data:image/svg+xml,%3Csvg%3E%3C/svg%3E")}',local={html:'<div/>',files:new Map([['/app.css',{body:Buffer.from(css),contentType:'text/css'}]])};expect((await new TrustedStaticAssets(net()).materialize(local,scope())).files.get('/app.css')!.body.toString()).toContain('data:image/svg+xml')
 await expect(new TrustedStaticAssets(net({get:async()=>({status:200,headers:{'content-type':'text/css'},body:Buffer.from(css)})})).materialize({html:'<link rel="stylesheet" href="https://assets.publicdomain.com/style.css">',files:new Map()},scope())).rejects.toThrow('data URL')
})

it('rewrites repeated literals in source order with one fetch and preserves all surrounding JavaScript',async()=>{
 const url='https://assets.publicdomain.com/picture.png',get=vi.fn(async()=>response()),input=build(),code='globalThis.images=['+Array.from({length:128},(_,i)=>'{index:'+i+',src:'+JSON.stringify(url)+'}').join(',')+'];'
 input.files.get('/_wcb/app.js')!.body=Buffer.from(code)
 const out=await new TrustedStaticAssets(net({get})).materialize(input,scope()),local=[...out.files.keys()].find(k=>k.endsWith('.png'))!
 expect(get).toHaveBeenCalledTimes(1);expect(out.audit).toHaveLength(1)
 expect(out.files.get('/_wcb/app.js')!.body.toString()).toBe(code.split(JSON.stringify(url)).join(JSON.stringify(local)))
 expect(input.files.get('/_wcb/app.js')!.body.toString()).toBe(code)
})

it('materializes compiler refresh module resources in both startup and update artifacts',async()=>{
 const url='https://assets.publicdomain.com/picture.png',manifest={version:1,entry:'a',modules:{a:{code:'module.exports='+JSON.stringify(url),imports:{},boundary:false}}},serialized=JSON.stringify(manifest),input=build()
 input.files.set('/_wcb/app.js',{body:Buffer.from('(()=>{let manifest='+serialized+';const cache={};globalThis.result=manifest;})();'),contentType:'text/javascript'})
 input.files.set('/_wcb/refresh.json',{body:Buffer.from(serialized),contentType:'application/json'})
 const get=vi.fn(async()=>response()),out=await new TrustedStaticAssets(net({get})).materialize(input,scope()),updated=out.files.get('/_wcb/refresh.json')!.body.toString()
 expect(get).toHaveBeenCalledTimes(1);expect(updated).toContain('/_wcb/static/');expect(out.files.get('/_wcb/app.js')!.body.toString()).toContain('let manifest='+updated+';const cache=');expect(input.files.get('/_wcb/refresh.json')!.body.toString()).toBe(serialized)
 input.files.get('/_wcb/app.js')!.body=Buffer.from('let manifest={};')
 await expect(new TrustedStaticAssets(net()).materialize(input,scope())).rejects.toThrow('bootstrap mismatch')
})
