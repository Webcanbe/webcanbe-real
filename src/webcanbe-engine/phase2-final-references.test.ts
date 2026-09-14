import { describe, expect, it } from "vitest"
import { resolveSourceReference, rewriteRenameImports } from "./mutations/sourceReferences"
import { contentHash } from "./mutations/durableSource"
import { validateSource } from "./mutations/sourceValidation"
import type { FileOperation } from "./core/types"
const move=(file:string,to:string,before:Map<string,string>):FileOperation=>({kind:'rename',file,to,expectedHash:contentHash(before.get(file)!)})
describe('source-aware reference transactions',()=>{
  it.each(['./Card','./Card.tsx','@/Card'])('rewrites %s and re-exports with exact ranges, leaving package and inert text untouched',reference=>{
    const main=`import Card from '${reference}';export {default} from '${reference}';const text="${reference}";import React from 'react';// ${reference}\n`,files=new Map([['src/App.tsx',main],['src/Card.tsx','export default()=> <h1>Card</h1>']])
    const ops=rewriteRenameImports(files,[move('src/Card.tsx','src/components/Panel.tsx',files)],{'@':'src'})
    expect(ops).toHaveLength(2);const update=ops.find(op=>op.kind==='update')!
    expect(update.kind==='update'&&update.content).toBe(main.replace(`from '${reference}'`,`from './components/Panel.tsx'`).replace(`from '${reference}'`,`from './components/Panel.tsx'`))
  })
  it('rebases moved-module CSS, lazy imports and URL assets while preserving query/hash',()=>{
    const source=`import './style.module.css';export const load=()=>import('./child');export const icon=new URL('./icon.svg?raw#view',import.meta.url);`
    const files=new Map([['src/Page.ts',source],['src/child.ts','export {}'],['src/style.module.css','.a{color:red}']]),paths=new Set([...files.keys(),'src/icon.svg'])
    const result=rewriteRenameImports(files,[move('src/Page.ts','src/screens/Page.ts',files)],{},paths)[0]
    expect(result.kind==='rename'&&result.content).toBe(`import '../style.module.css';export const load=()=>import('../child.ts');export const icon=new URL('../icon.svg?raw#view',import.meta.url);`)
  })
  it('resolves index modules and leaves unrelated source byte-exact',()=>{
    const files=new Map([['src/App.ts',"export {Card} from './cards'"],['src/cards/index.ts','export const Card=1'],['src/unused.ts','// retained']])
    const result=rewriteRenameImports(files,[move('src/cards/index.ts','src/cards/entry.mts',files)],{})
    expect(result.find(op=>op.file==='src/App.ts')).toMatchObject({kind:'update',content:"export {Card} from './cards/entry.mts'"});expect(result.some(op=>op.file==='src/unused.ts')).toBe(false)
  })
  it('uses parsed CSS declaration/import spans, retaining comments, whitespace and unrelated strings',()=>{
    const css=`/* ./base.css */\n@import "./base.css" screen;\n.card { background: url( './icon.svg#icon' ); content: "url(./icon.svg)"; }`,files=new Map([['src/style.css',css],['src/base.css','body{}']]),paths=new Set([...files.keys(),'src/icon.svg'])
    const result=rewriteRenameImports(files,[move('src/style.css','src/styles/style.css',files)],{},paths)[0]
    expect(result.kind==='rename'&&result.content).toBe(css.replace('@import "./base.css"','@import "../base.css"').replace("url( './icon.svg#icon' )","url( '../icon.svg#icon' )"))
  })
  it.each(["export const load=(name:string)=>import(name)","export const icon=new URL(name,import.meta.url)","import './missing'","import './C\\u0061rd'"])("rejects ambiguous moved source without guesses: %s",source=>{
    const files=new Map([['src/A.ts',source],['src/Card.ts','export {}']])
    expect(()=>rewriteRenameImports(files,[move('src/A.ts','src/sub/A.ts',files)],{})).toThrow()
  })
  it('refuses ambiguous extension/index choices and project escape',()=>{
    expect(()=>resolveSourceReference('src/A.ts','./Card',new Set(['src/Card.ts','src/Card.tsx']))).toThrow('Ambiguous')
    expect(()=>resolveSourceReference('src/A.ts','../../outside',new Set())).toThrow('escapes')
    expect(resolveSourceReference('src/A.ts','react',new Set(['node_modules/react/index.js']))).toBeUndefined()
  })
  it('does not rewrite shadowed URL or require functions as module operations',()=>{
    const source=`function X(URL:any,require:any){return [new URL('./Card',import.meta.url),require('./Card')]}`,files=new Map([['src/A.ts',source],['src/Card.ts','export {}']])
    expect(rewriteRenameImports(files,[move('src/Card.ts','src/New.ts',files)],{})).toHaveLength(1)
  })
  it.each(['mts','cts','mjs','cjs'])('accepts the broader %s source grammar with syntax checking',async ext=>{
    expect((await validateSource(new Map([['src/value.'+ext,ext.endsWith('ts')?'export const value: number = 1':'export const value = 1']]))).passed).toBe(true)
    expect((await validateSource(new Map([['src/value.'+ext,'export const broken = (']]))).passed).toBe(false)
  })
})
