import {describe,it,expect} from 'vitest'
import {declaredPages,layerDepth,layerName} from './editorNavigation'
import type {SourceTarget} from '../core/types'
describe('source-backed editor navigation',()=>{
 it('uses declared absolute paths, with no invented example pages or dynamic URLs',()=>{expect(declaredPages(['<Routes><Route path="/"/><Route path="/contact"/><Route path={"/privacy-policy"}/><Route path="/users/:id"/><Route path="*"/></Routes>'])).toEqual([{path:'/',name:'Home'},{path:'/contact',name:'Contact'},{path:'/privacy-policy',name:'Privacy policy'}])})
 it('labels layers by element and real source text, never by file path',()=>{expect(layerName({elementName:'h1',text:'Real title',identity:{file:'src/Hero.tsx'}} as SourceTarget)).toBe('Heading · Real title')})
 it('derives nesting from contained source ranges within the same file',()=>{const parent={identity:{file:'src/App.tsx'},sourceRange:{start:1,end:100}} as SourceTarget;const child={identity:{file:'src/App.tsx'},sourceRange:{start:20,end:30}} as SourceTarget;expect(layerDepth(child,[parent,child])).toBe(1);expect(layerDepth({...child,identity:{...child.identity,file:'src/Other.tsx'}},[parent,child])).toBe(0)})
})
