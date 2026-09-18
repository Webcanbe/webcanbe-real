import vm from "node:vm"
import { describe, expect, it } from "vitest"
import { hostedRasterViewerDocument, hostedRasterViewerHeaders } from "./runtime/rasterViewer"
import { accessibilityDescription } from "./runtime/controlledPreview"

// Event-state unit model ONLY. These trusted flags are test data, never OS evidence.
function viewer() {
  const handlers = new Map<string, Function[]>(), sent: any[] = [], timers = new Map<number, Function>(); let timer = 0
  const document: any = { activeElement: null }
  function element() { const h = new Map<string, Function[]>(); return { value: "", style: {}, dataset: {}, textContent: "", width: 1280, height: 900, addEventListener(t: string, f: Function) { h.set(t,[...(h.get(t)||[]),f]) }, emit(t: string,e: any = {}) { for(const f of h.get(t)||[])f({isTrusted:true,preventDefault(){},...e}) }, focus() {document.activeElement=this}, blur() {if(document.activeElement===this){document.activeElement=null;this.emit("blur")}}, setAttribute(){},replaceChildren(){},append(){},getBoundingClientRect(){return {left:0,top:0,width:1280,height:900}} } }
  const img=element(),sink=element(),status=element(),ax=element(),parent={postMessage:(m:any)=>sent.push(m)}
  document.querySelector=(s:string)=>s==='img'?img:s==='textarea'?sink:s==='#status'?status:ax;document.createElement=element
  const c=vm.createContext({document,parent,setTimeout:(f:Function)=>{timers.set(++timer,f);return timer},clearTimeout:(id:number)=>timers.delete(id),addEventListener:(t:string,f:Function)=>handlers.set(t,[...(handlers.get(t)||[]),f])})
  vm.runInContext(hostedRasterViewerDocument('https://editor.test').split('<script>')[1].split('</script>')[0],c)
  const emit=(t:string,e:any)=>{for(const f of handlers.get(t)||[])f(e)}
  const message=(data:any,extra:any={})=>emit('message',{source:parent,origin:'https://editor.test',data:{channel:'wcb-raster',generation:'g1',...data},...extra})
  const frame=(data:any={})=>message({type:'frame',revision:'r1',sequence:1,width:1280,height:900,png:'AAAA',select:false,...data})
  frame();sink.focus()
  const flush=()=>{for(const [id,f] of timers){timers.delete(id);f()}}
  const texts=()=>sent.filter(x=>x.type==='input').map(x=>x.input.text)
  return {sink,img,frame,message,emit,flush,texts,sent}
}
describe('P39 composition state seam (synthetic unit evidence only)',()=>{
  it.each(['한글','日本語','é 👨‍👩‍👧‍👦'])('commits %s once across compositionend and trailing input',text=>{
    const v=viewer();v.sink.emit('compositionstart');v.sink.value='intermediate';v.sink.emit('compositionupdate');v.sink.emit('input',{isComposing:true,inputType:'insertCompositionText'});expect(v.texts()).toEqual([])
    v.sink.value=text;v.sink.emit('compositionend',{data:text});v.sink.emit('input',{inputType:'insertText'});v.flush();expect(v.texts()).toEqual([text]);expect(v.sink.value).toBe('')
    v.sink.value='x';v.sink.emit('input',{inputType:'insertText'});expect(v.texts()).toEqual([text,'x'])
  })
  it('accepts final noncomposing browser input after composing input before compositionend',()=>{const v=viewer();v.sink.emit('compositionstart');v.sink.value='日本語';v.sink.emit('input',{isComposing:false,inputType:'insertFromComposition'});v.sink.emit('compositionend',{data:'日本語'});v.flush();expect(v.texts()).toEqual(['日本語'])})
  it.each(['generation','revision','mode','invalidate','blur','pointer','exit'])('cancels a pending composition on %s',kind=>{
    const v=viewer();v.sink.emit('compositionstart');v.sink.value='한글';v.sink.emit('compositionend',{data:'한글'})
    if(kind==='generation')v.frame({generation:'g2'});if(kind==='revision')v.frame({revision:'r2'});if(kind==='mode')v.message({type:'mode',select:true});if(kind==='invalidate')v.message({type:'invalidate'});if(kind==='blur')v.sink.blur();if(kind==='pointer')v.img.emit('click',{clientX:20,clientY:30});if(kind==='exit')v.emit('keydown',{isTrusted:true,key:'F6',preventDefault(){}})
    v.flush();expect(v.texts().filter(x=>x!==undefined)).toEqual([])
  })
  it('does not cancel composition on a newer frame within the same revision',()=>{const v=viewer();v.sink.emit('compositionstart');v.frame({sequence:2});v.sink.emit('compositionend',{data:'한글'});v.flush();expect(v.texts()).toEqual(['한글'])})
  it('rejects constructed composition, text, paste, pointer and key events',()=>{const v=viewer();v.sink.emit('compositionstart',{isTrusted:false});v.sink.emit('compositionend',{data:'bad',isTrusted:false});v.sink.value='bad';v.sink.emit('input',{isTrusted:false});v.sink.emit('paste',{isTrusted:false});v.img.emit('click',{isTrusted:false});v.emit('keydown',{isTrusted:false,key:'x'});v.flush();expect(v.texts()).toEqual([])})
  it('rejects an untrusted commit inside an active trusted composition',()=>{const v=viewer();v.sink.emit('compositionstart');v.sink.emit('compositionend',{data:'forged',isTrusted:false});v.flush();expect(v.texts()).toEqual([]);v.sink.value='한글';v.sink.emit('input',{inputType:'insertText'});v.flush();expect(v.texts()).toEqual(['한글'])})
  it('refuses late composition input after invalidation and reconnection',()=>{const v=viewer();v.sink.emit('compositionstart');v.message({type:'invalidate'});v.frame({generation:'g2'});v.sink.focus();v.sink.value='stale';v.sink.emit('input',{inputType:'insertFromComposition'});v.sink.emit('compositionend',{data:'stale'});v.flush();expect(v.texts()).toEqual([])})
  it('does not trust messages from another window or editor origin',()=>{const v=viewer();v.message({type:'frame',generation:'evil'},{origin:'https://evil.test'});v.message({type:'invalidate'},{source:{}});v.sink.value='ok';v.sink.emit('input');expect(v.sent[0].generation).toBe('g1')})
  it('preserves the separate-origin sandbox and denied network policy',()=>{const h=hostedRasterViewerHeaders('https://editor.test');expect(h['Content-Security-Policy']).toContain("sandbox allow-scripts");expect(h['Content-Security-Policy']).not.toContain('allow-same-origin');expect(h['Content-Security-Policy']).toContain("connect-src 'none'")})
})
describe('P39 bounded Chromium accessibility descriptions',()=>{
  it('preserves browser computed descriptions and selected/disabled/expanded states',()=>{expect(accessibilityDescription({role:'tab',name:'Code',description:'Edit source',states:{selected:'true',disabled:'false',expanded:'true'}})).toEqual({role:'tab',name:'Code',description:'Edit source',states:{selected:'true',disabled:'false',expanded:'true'}})})
  it.each([{role:'script',name:'bad'},{role:'button',name:'x'.repeat(201)},{role:'button',name:'x',description:'x'.repeat(201)},{role:'button',name:'x',states:{onclick:'evil'}},{role:'button',name:'x',states:[]},{role:'button',name:'x',states:{disabled:{}}}])('rejects invalid or oversized AX data %#',value=>{expect(()=>accessibilityDescription(value)).toThrow()})
})

it('P39 broker consumes a numbered input frame once and retires replay before delivery',async()=>{
  const fs=await import('node:fs'),os=await import('node:os'),path=await import('node:path')
  const {ProjectRegistry}=await import('./runtime/projectRegistry'),{ControlledPreviewTransport}=await import('./runtime/controlledPreview'),{exportProjectZip}=await import('./runtime/projectExport')
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'wcb-p39-'));fs.cpSync(path.join(process.cwd(),'fixtures/compatible-react-vite'),path.join(root,'fixtures/compatible-react-vite'),{recursive:true});const registry=new ProjectRegistry(root),delivered:unknown[]=[]
  const runner={open:async()=>({capture:async()=>Buffer.alloc(0),input:async(input:unknown)=>{delivered.push(input)},close:async()=>{}})}
  const transport=new ControlledPreviewTransport(registry,process.cwd(),runner)
  try { const project=await registry.importZip('P39 replay',await exportProjectZip({...registry.get('phase1-fixture')!,root:path.join(process.cwd(),'fixtures/coast-paths')})),session=registry.createSession(project.id)!,authority={...session,operation:'preview' as const}
    const view=await transport.start(project.id,authority,{revision:registry.revision(project.id),route:'/'})
    await transport.input(project.id,authority,view.generation,{type:'text',text:'한글'},0)
    await expect(transport.input(project.id,authority,view.generation,{type:'text',text:'한글'},0)).rejects.toThrow('already consumed')
    expect(delivered).toEqual([{type:'text',text:'한글'}])
  }finally{await transport.close();fs.rmSync(root,{recursive:true,force:true})}
})
