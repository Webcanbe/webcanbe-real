import {expect,it} from 'vitest'
import {isDefaultTailwindConfig} from './adapters/react/defaultTailwindConfig'
import {breakpointRegistry} from './adapters/react/projectStyles'
const defaults=`/** retained comment */ export default {content:["./index.html","./src/**/*.{js,ts,jsx,tsx}"],theme:{extend:{}},plugins:[]}`
it('recognizes finite equivalent defaults without executing configuration and retains breakpoint authoring',()=>{
 expect(isDefaultTailwindConfig(defaults)).toBe(true)
 expect(breakpointRegistry(new Map([['tailwind.config.js',defaults]]),true).breakpoints.some(b=>b.id==='tw:md')).toBe(true)
})
it.each([`export default (()=>({}))()`,`import plugin from 'evil'; export default {}`,`export default {plugins:[evil()]}`,`export default {theme:{extend:{colors:{brand:'red'}}}}`,`export default {get plugins(){throw Error('ran')}}`,`export default {...defaults}`,`export default {theme:{},theme:{}}`,`export default {__proto__:{}}`,`export default {content:['../**/*']}`,`export default {}; throw Error('ran')`])('rejects non-default or executable configuration: %s',source=>{
 expect(isDefaultTailwindConfig(source)).toBe(false)
 expect(breakpointRegistry(new Map([['tailwind.config.js',source]]),true).breakpoints.some(b=>b.id==='tw:md')).toBe(false)
})

import {validateIntakeMetadata} from './runtime/intakeMetadata'
it('preserves finite Git text/eol metadata and refuses executable or export-changing attributes',()=>{
 expect(()=>validateIntakeMetadata('.gitattributes',Buffer.from('# normalize text\n* text=auto\n*.png -text\n*.js text eol=lf'))).not.toThrow()
 for(const value of ['* filter=lfs','* diff=custom','[attr]binary -diff','* export-ignore','* export-subst','* working-tree-encoding=UTF-16','# token=private','* text=auto\n* filter=exec'])expect(()=>validateIntakeMetadata('.gitattributes',Buffer.from(value))).toThrow()
})
