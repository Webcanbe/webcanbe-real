import {it,expect,vi} from 'vitest'
import {buildSync} from 'esbuild'
import {JSDOM} from 'jsdom'
import {encodeSourceIdentity} from '../core/sourceIdentity'
it('tracks the selected element across nested scroll and interaction mode, clearing removed elements',()=>{
 const code=buildSync({entryPoints:['src/webcanbe-engine/runtime/previewBridge.ts'],bundle:true,write:false,format:'iife',define:{__WCB_HTTP_PREVIEW__:'false'}}).outputFiles[0].text
 const dom=new JSDOM('<main><div><h1>Selected</h1></div></main>',{url:'http://127.0.0.1:5173/',runScripts:'outside-only'})
 const win=dom.window, heading=win.document.querySelector('h1'), scroller=heading.parentElement
 Object.assign(win,{ResizeObserver:class{observe(){}disconnect(){}}})
 heading.setAttribute('data-wcb-id',encodeSourceIdentity({file:'src/Hero.tsx',elementStart:12}))
 let top=180
 heading.getBoundingClientRect=()=>({top,left:20,width:200,height:40,bottom:top+40,right:220,x:20,y:top,toJSON(){}})
 const post=vi.spyOn(win,'postMessage').mockImplementation(()=>{})
 try {
  win.eval(code)
  const configure=(active)=>win.dispatchEvent(new win.MessageEvent('message',{source:win,origin:'http://127.0.0.1:5173',data:{channel:'webcanbe-compatible-v1',type:'configure',session:'session',generation:'generation',active}}))
  configure(true);heading.dispatchEvent(new win.MouseEvent('click',{bubbles:true}))
  expect(post.mock.calls.at(-1)?.[0]).toMatchObject({type:'select',element:{rect:{top:180}}})
  configure(false);top=-80;scroller.dispatchEvent(new win.Event('scroll'))
  expect(post.mock.calls.at(-1)?.[0]).toMatchObject({type:'select',element:{rect:{top:-80}}})
  top=95;configure(true);scroller.dispatchEvent(new win.Event('scroll'))
  expect(post.mock.calls.at(-1)?.[0]).toMatchObject({type:'select',element:{rect:{top:95}}})
  configure(false);win.dispatchEvent(new win.MessageEvent('message',{source:win,origin:'http://127.0.0.1:5173',data:{channel:'webcanbe-compatible-v1',type:'configure',session:'session',generation:'generation',active:false,selection:{file:'src/Hero.tsx',elementStart:12}}}));top=45;scroller.dispatchEvent(new win.Event('scroll'));expect(post.mock.calls.at(-1)?.[0]).toMatchObject({type:'select',element:{rect:{top:45}}})
  heading.remove();win.dispatchEvent(new win.Event('scroll'))
  expect(post.mock.calls.at(-1)?.[0]).toMatchObject({type:'clear'})
 } finally {win.close()}
})
