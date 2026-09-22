import fs from 'node:fs'
// @ts-expect-error jsdom is used only in tests; the repository has no jsdom type package.
import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import { DocsShell } from './DocsShell'
import { EmbeddedVideo } from './EmbeddedVideo'
import { SharedFooter } from './SharedFooter'
import { docPages, docsNav } from './docs-content'
import groups from './footer-data.json'
import { isKnownAppPath } from '../../worker/security-headers.js'
const html=fs.readFileSync('public/wcb-landing/index.html','utf8')
const interactions=fs.readFileSync('public/landing-interactions.js','utf8')

describe('Public shell routes and interactions',()=>{
 it('every shared footer link resolves to a known route, with static/React parity',()=>{
  const staticDoc=new JSDOM(html).window.document
  const reactDoc=new JSDOM(renderToStaticMarkup(<SharedFooter/>)).window.document
  const links=(d:Document)=>[...d.querySelectorAll('.wcb-public-footer a')].map(a=>[a.textContent,a.getAttribute('href')])
  expect(links(staticDoc)).toEqual(links(reactDoc))
  for(const group of groups){expect(group.links.length).toBeGreaterThanOrEqual(6);for(const [,href] of group.links)expect(isKnownAppPath(new URL(href,'https://webcanbe.com').pathname)).toBe(true)}
 })
 it('docs categories contain only routable pages and each TOC links to a real heading',()=>{
  for(const [,items] of docsNav)for(const [,href] of items)expect(docPages[href]||href==='/changelog').toBeTruthy()
  for(const path of Object.keys(docPages)){
   const d=new JSDOM(renderToStaticMarkup(<DocsShell path={path}/>)).window.document
   for(const a of d.querySelectorAll('.docs-toc a'))expect(d.getElementById(a.getAttribute('href')!.slice(1))).not.toBeNull()
   expect(d.querySelectorAll('h1')).toHaveLength(1)
  }
 })
 it('offers a working guide when media is absent and rejects unapproved embed URLs',()=>{
  expect(renderToStaticMarkup(<EmbeddedVideo/>)).toContain('href="/docs/getting-started"')
  expect(renderToStaticMarkup(<EmbeddedVideo src="javascript:alert(1)"/>)).not.toContain('<iframe')
  expect(renderToStaticMarkup(<EmbeddedVideo src="https://www.youtube-nocookie.com/embed/abc"/>)).toContain('<iframe')
 })
 it('keeps hero actions truthful and FAQ answers present without JavaScript',()=>{
  const d=new JSDOM(html).window.document
  expect(d.querySelector('.wcb-hero a[href="/login"]')?.textContent).toBe('Sign in')
  expect(d.querySelector('.wcb-hero a[data-slot="button"][href="/browse"]')?.textContent).toBe('Browse templates')
  expect(d.querySelectorAll('.wcb-faq')).toHaveLength(6)
  expect(d.querySelector('.wcb-faq p')?.textContent?.length).toBeGreaterThan(30)
  expect(d.body.textContent).not.toMatch(/\b(dummy|placeholder|demo)\b/i)
 })
 it('carousel supports both directions, boundaries, keyboard, and cleanup',()=>{
  const dom=new JSDOM(html,{url:'https://webcanbe.com',runScripts:'outside-only'}),w=dom.window
  w.fetch=async()=>({ok:false}) as never
  w.matchMedia=(()=>({matches:true})) as never
  w.ResizeObserver=class{observe(){}disconnect(){}} as never
  const track=w.document.querySelector('.wcb-marketplace-track') as HTMLElement
  Object.defineProperties(track,{clientWidth:{value:900},scrollWidth:{value:1900},scrollLeft:{value:0,writable:true}})
  Object.defineProperty(track,'scrollBy',{value:({left}:ScrollToOptions)=>{track.scrollLeft=Math.max(0,Math.min(1000,track.scrollLeft+(left||0)));track.dispatchEvent(new w.Event('scroll'))}})
  w.eval(interactions)
  const init=(w as unknown as {webcanbeInitializeLanding:(root:Document)=>()=>void}).webcanbeInitializeLanding
  // The static script already initialized once; use a fresh root for explicit teardown.
  const root=w.document.createElement('div');root.innerHTML=w.document.querySelector('.wcb-marketplace')!.outerHTML;w.document.body.append(root)
  const t=root.querySelector('.wcb-marketplace-track') as HTMLElement
  Object.defineProperties(t,{clientWidth:{value:900},scrollWidth:{value:1900},scrollLeft:{value:0,writable:true}})
  Object.defineProperty(t,'scrollBy',{value:({left}:ScrollToOptions)=>{t.scrollLeft=Math.max(0,Math.min(1000,t.scrollLeft+(left||0)));t.dispatchEvent(new w.Event('scroll'))}})
  const stop=init(root as unknown as Document),prev=root.querySelector('[data-market-prev]') as HTMLButtonElement,next=root.querySelector('[data-market-next]') as HTMLButtonElement
  expect(prev.disabled).toBe(true);next.click();expect(t.scrollLeft).toBeGreaterThan(0);prev.click();expect(t.scrollLeft).toBe(0)
  t.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));expect(t.scrollLeft).toBeGreaterThan(0)
  stop();const left=t.scrollLeft;next.click();expect(t.scrollLeft).toBe(left)
  w.close()
 })
 it('published cards link to their exact release listing without inserting untrusted HTML',async()=>{
  const dom=new JSDOM(html,{url:'https://webcanbe.com',runScripts:'outside-only'}),w=dom.window
  w.fetch=async()=>({ok:true,json:async()=>({listings:[{slug:'studio-one',title:'<img src=x onerror=alert(1)>',summary:'A published project'}]})}) as never
  w.matchMedia=(()=>({matches:true})) as never
  w.ResizeObserver=class{observe(){}disconnect(){}} as never
  w.eval(interactions)
  await new Promise(resolve=>setTimeout(resolve,0))
  const card=w.document.querySelector('.wcb-marketplace-card')!
  expect(card.getAttribute('href')).toBe('/project/studio-one')
  expect(card.querySelector('h3')?.textContent).toBe('<img src=x onerror=alert(1)>')
  expect(card.querySelector('img')).toBeNull()
  w.close()
 })
})
