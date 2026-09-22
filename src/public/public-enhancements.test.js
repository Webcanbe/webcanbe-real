import fs from 'node:fs'
import {JSDOM} from 'jsdom'
import {it,expect} from 'vitest'
const source=fs.readFileSync('public/public-enhancements.js','utf8')
it('prepares categorized mail with allowlisted account context and no secrets or query strings',async()=>{
 const dom=new JSDOM(fs.readFileSync('.public-site/__public/contact/issues.html','utf8'),{url:'https://webcanbe.com/contact/issues?token=DO_NOT_SHARE',runScripts:'outside-only'}),w=dom.window
 w.fetch=async url=>({ok:true,json:async()=>url.endsWith('/session')?{csrf:'SECRET_CSRF'}:{account:{userId:'account-safe-id',providers:['google'],email:'private@example.com',password:'SECRET_PASSWORD',token:'SECRET_TOKEN'}}})
 w.eval(source);await new Promise(r=>setTimeout(r,0))
 const d=w.document,form=d.querySelector('form');form.querySelector('[name=subject]').value='Preview issue';form.querySelector('[name=message]').value='The preview failed after opening my project.';form.querySelector('[name=steps]').value='Open the project and connect preview.'
 // A canceled navigation in jsdom is intentional: no email is sent by this test.
 form.dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}))
 const href=d.querySelector('[data-support-status] a').href,mail=new URL(href),body=mail.searchParams.get('body')
 expect(mail.pathname).toBe('hello@webcanbe.com');expect(mail.searchParams.get('subject')).toContain('[bug-report]');expect(body).toContain('account-safe-id');expect(body).toContain('google');expect(body).toContain('Open the project and connect preview.');expect(body).not.toMatch(/SECRET_|DO_NOT_SHARE|private@example.com/);expect(body).not.toContain('?token=')
 form.querySelector('[name=context]').checked=false;form.dispatchEvent(new w.Event('submit',{cancelable:true,bubbles:true}));expect(new URL(d.querySelector('[data-support-status] a').href).searchParams.get('body')).not.toContain('account-safe-id');dom.window.close()
})
it('search enhancement returns real topic links without injecting query HTML',async()=>{
 const dom=new JSDOM(fs.readFileSync('.public-site/__public/docs/visual-editor.html','utf8'),{url:'https://webcanbe.com/docs/visual-editor',runScripts:'outside-only'}),w=dom.window
 w.fetch=async()=>({ok:true,json:async()=>[{url:'/docs/ai-editing/stale-revisions',title:'Resolve stale AI proposals',category:'AI editing',text:'Protect current source'}]})
 w.eval(source);const input=w.document.querySelector('input[type=search]');input.value='stale';input.dispatchEvent(new w.Event('input'));await new Promise(r=>setTimeout(r,0));expect(w.document.querySelector('.wcb-docs-search-results a').getAttribute('href')).toBe('/docs/ai-editing/stale-revisions');input.value='<img src=x>';input.dispatchEvent(new w.Event('input'));await new Promise(r=>setTimeout(r,0));expect(w.document.querySelector('.wcb-docs-search-results img')).toBeNull();dom.window.close()
})
