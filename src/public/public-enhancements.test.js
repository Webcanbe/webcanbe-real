import fs from 'node:fs'
import {JSDOM} from 'jsdom'
import {it,expect} from 'vitest'
const source=fs.readFileSync('public/public-enhancements.js','utf8')
it('creates a persisted categorized case with bounded safe context and no secrets or query strings',async()=>{
 const dom=new JSDOM(fs.readFileSync('.public-site/__public/contact/issues.html','utf8'),{url:'https://webcanbe.com/contact/issues?token=DO_NOT_SHARE',runScripts:'outside-only'}),w=dom.window
 const calls=[];w.fetch=async(url,options={})=>{calls.push({url,options});return {ok:true,json:async()=>url.endsWith('/session')?{csrf:'csrf-value'}:{request:{requestNumber:'WCB-REQ-ABC234'}}}}
 w.eval(source);await new Promise(r=>setTimeout(r,0))
 const d=w.document,form=d.querySelector('form');form.querySelector('[name=subject]').value='Preview issue';form.querySelector('[name=message]').value='The preview failed after opening my project.';form.querySelector('[name=steps]').value='Open the project and connect preview.'
 form.dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}))
 await new Promise(r=>setTimeout(r,0));const request=calls.find(call=>call.url.endsWith('/requests/create')),body=JSON.parse(request.options.body)
 expect(request.options.headers['X-WCB-CSRF']).toBe('csrf-value');expect(body.category).toBe('bug_report');expect(body.description).toContain('Open the project and connect preview.');expect(body.safeContext.currentUrl).toBe('https://webcanbe.com/contact/issues');expect(JSON.stringify(body)).not.toMatch(/DO_NOT_SHARE|private@example.com|password|token/i);expect(d.querySelector('[data-support-status]').textContent).toContain('WCB-REQ-ABC234');expect(d.querySelector('a[href^="mailto:"]')).toBeNull();dom.window.close()
})
it('search enhancement returns real topic links without injecting query HTML',async()=>{
 const dom=new JSDOM(fs.readFileSync('.public-site/__public/docs/visual-editor.html','utf8'),{url:'https://webcanbe.com/docs/visual-editor',runScripts:'outside-only'}),w=dom.window
 w.fetch=async()=>({ok:true,json:async()=>[{url:'/docs/ai-editing/stale-revisions',title:'Resolve stale AI proposals',category:'AI editing',text:'Protect current source'}]})
 w.eval(source);const input=w.document.querySelector('input[type=search]');input.value='stale';input.dispatchEvent(new w.Event('input'));await new Promise(r=>setTimeout(r,0));expect(w.document.querySelector('.wcb-docs-search-results a').getAttribute('href')).toBe('/docs/ai-editing/stale-revisions');input.value='<img src=x>';input.dispatchEvent(new w.Event('input'));await new Promise(r=>setTimeout(r,0));expect(w.document.querySelector('.wcb-docs-search-results img')).toBeNull();dom.window.close()
})
