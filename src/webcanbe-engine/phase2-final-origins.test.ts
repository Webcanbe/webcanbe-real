import {expect,it} from 'vitest'
import {analyzeProjectStyles} from './adapters/react/projectStyles'
import {patchText,patchProjectStyle,undoTransaction,type SourceStore} from './mutations/sourceMutations'
function fixture(files:Record<string,string>){const map=new Map(Object.entries(files)),store:SourceStore={tailwind:true,read:f=>map.get(f),write:(f,s,expected)=>{expect(map.get(f)).toBe(expected);map.set(f,s)}};return{map,store,targets:()=>analyzeProjectStyles(map,true).targets}}
it('traces named aliases through re-export chains and edits the immutable text origin only',()=>{
 const f=fixture({'src/App.tsx':"import {heading as title} from './barrel';export default()=> <h1>{title}</h1>",'src/barrel.ts':"export {message as heading} from './words.mts'",'src/words.mts':"export const message = 'Original'; // retained"}),target=f.targets()[0],before=new Map(f.map);expect(target.text).toBe('Original');expect(target.textFile).toBe('src/words.mts');expect(target.textShared).toBe(true);const result=patchText(f.store,target.identity,'Edited & <safe>');expect(result.success).toBe(true);expect(result.file).toBe('src/words.mts');expect(f.map.get('src/App.tsx')).toBe(before.get('src/App.tsx'));expect(f.map.get('src/words.mts')).toContain('"Edited & <safe>"');expect(undoTransaction(f.store,result)).toBe(true);expect(f.map).toEqual(before)
})
it('resolves default and namespace primitive origins but never object/getter or dynamic props',()=>{
 for(const[imports,jsx]of [["import message from './words'",'message'],["import * as words from './words'",'words.message']]){const f=fixture({'src/App.tsx':imports+';export default()=> <h1>{'+jsx+'}</h1>','src/words.ts':"const primitive='Hello';export {primitive as message};export default primitive"});expect(f.targets()[0].text).toBe('Hello')}
 for(const code of ["export const message=read()","export let message='mutable'","export const message={get title(){return 'dynamic'}}"]) {const f=fixture({'src/App.tsx':"import {message} from './words';export default()=> <h1>{message}</h1>",'src/words.ts':code});expect(f.targets()[0].capabilities.text).toBe(false)}
 const f=fixture({'src/App.tsx':"export function Card({title:label}){return <h1>{label}</h1>} export default()=> <><Card title='one'/><Card {...props}/></>"});expect(f.targets().find(t=>t.elementName==='h1')?.reasonCodes).toContain('runtime-generated-children');expect(f.targets().filter(t=>t.elementName==='Card').some(t=>t.reasonCodes?.includes('jsx-spread-props'))).toBe(true)
})
it('refuses import cycles, shadowed bindings, unresolved aliases and ambiguous paths or star exports',()=>{
 for(const extra of [{'src/words.ts':"export {message} from './loop'",'src/loop.ts':"export {message} from './words'"},{'src/words.ts':"export const message='ts'",'src/words.js':"export const message='js'"},{'src/words.ts':"export * from './a';export * from './b'",'src/a.ts':"export const message='same'",'src/b.ts':"export const message='same'"}] as Array<Record<string,string>>){const f=fixture({'src/App.tsx':"import {message} from './words';export default()=> <h1>{message}</h1>",...extra});expect(f.targets()[0].capabilities.text).toBe(false)}
 for(const app of ["import {message} from './words';export default function App(message){return <h1>{message}</h1>}","import {message} from '@/words';export default()=> <h1>{message}</h1>"]){const f=fixture({'src/App.tsx':app,'src/words.ts':"export const message='shared'"});expect(f.targets()[0].capabilities.text).toBe(false)}
})
it('invalidates cached source analysis when the imported literal changes and preserves class scope',()=>{
 const f=fixture({'src/App.tsx':"import {classes} from './words';export default()=> <main className={classes}>Hello</main>",'src/words.ts':"export const classes='p-4 md:p-8'"}),target=f.targets()[0],origin=target.styleOrigins.find(o=>o.property==='padding'&&!o.prefix)!;expect(origin.file).toBe('src/words.ts');expect(origin.shared).toBe(true);expect(patchProjectStyle(f.store,f.map,target.identity,'padding','24px',{scope:'instance'}).success).toBe(false);expect(patchProjectStyle(f.store,f.map,target.identity,'padding','24px',{scope:'source'}).success).toBe(true);expect(f.map.get('src/words.ts')).toBe("export const classes='p-6 md:p-8'");expect(f.targets()[0].styleOrigins.find(o=>!o.prefix)?.value).toBe('p-6')
})

it('resolves aliased component definitions and prop aliases without mixing same-name files',()=>{
 const f=fixture({
  'src/App.tsx':"import {Alias} from './barrel';import Other from './other';export default()=> <><Alias title='one'/><Alias title='two'/><Other title='three'/></>",
  'src/barrel.ts':"export {Card as Alias} from './Card'",
  'src/Card.tsx':"export function Card({title:label}){return <h1 style={{color:'red'}}>{label}</h1>}",
  'src/other.tsx':"export default function Card(props){return <h2>{props.title}</h2>}"
 }),targets=f.targets(),heading=targets.find(t=>t.elementName==='h1')!,other=targets.find(t=>t.elementName==='h2')!
 expect(targets.filter(t=>t.elementName==='Alias').map(t=>t.component)).toEqual(Array(2).fill(expect.objectContaining({file:'src/Card.tsx',definitionName:'Card',resolved:true})))
 expect(heading.propOrigin).toMatchObject({name:'title',localName:'label',file:'src/Card.tsx'})
 expect(heading.invocationOrigins).toHaveLength(2);expect(heading.styleOrigins[0].usageCount).toBe(2);expect(heading.styleOrigins[0].shared).toBe(true)
 expect(other.invocationOrigins).toHaveLength(1);expect(other.propOrigin).toMatchObject({name:'title',localName:'props.title'})
 expect(heading.capabilities.text).toBe(false);expect(heading.unavailableReasons.text).toContain('no per-instance override')
 expect(heading.invocationOrigins!.every(i=>i.file==='src/App.tsx'&&f.map.get(i.file)!.slice(i.range.start,i.range.end).startsWith('<Alias'))).toBe(true)
})
it('resolves default arrow and namespace components while opaque wrappers remain Code-only',()=>{
 const f=fixture({'src/App.tsx':"import View from './View';import * as views from './View';const Wrapped=memo(View);export default()=> <><View/><views.default/><Wrapped/></>",'src/View.tsx':"const Inner=()=> <div>shared</div>;export default Inner"}),targets=f.targets()
 expect(targets.find(t=>t.elementName==='View')!.component).toMatchObject({file:'src/View.tsx',definitionName:'Inner',resolved:true})
 expect(targets.find(t=>t.elementName==='div')!.invocationOrigins).toHaveLength(2)
 expect(targets.find(t=>t.elementName==='Wrapped')!.reasonCodes).toContain('component-origin-unresolved')
})

it.each(['#root h1 {color:blue}', '[data-active] {color:blue}', '.unknown\\:state {color:blue}', '#root h1 {color:blue!important}', '@media (min-width:1px){@supports(display:grid){.card {color:blue}}}'])('does not claim effective values or safe mutation across an unproven cascade: %s',override=>{
 const f=fixture({'src/App.tsx':"import './app.css';export default()=> <h1 className='card'>Text</h1>",'src/app.css':'.card {color:red} '+override}),target=f.targets()[0]
 expect(target.styleOrigins.find(o=>o.property==='color')?.editable).toBe(false)
 expect(target.styleOrigins.some(o=>o.property==='color'&&o.effective)).toBe(false)
 expect(patchProjectStyle(f.store,f.map,target.identity,'color','green',{scope:'source'}).success).toBe(false)
})
it('proves simple lower-specificity and nonmatching rules without blanket CSS refusal',()=>{
 const f=fixture({'src/App.tsx':"import './app.css';export default()=> <h1 className='card'>Text</h1>",'src/app.css':'.card {color:red} h1 {color:blue} .other {color:green} #root h2 {color:purple}'}),origin=f.targets()[0].styleOrigins.find(o=>o.property==='color')!
 expect(origin.editable).toBe(true);expect(origin.effective).toBe(true)
})
