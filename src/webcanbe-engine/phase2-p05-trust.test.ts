import {expect,it} from 'vitest'
import {normalizeAlternateLock,parseYarnBerry} from './runtime/alternateLockfiles'

const integrity='sha512-'+Buffer.alloc(64,7).toString('base64')
const checksum='10c0/'+'a'.repeat(128)
const record=(descriptor:string,locator:string,extra='')=>`${JSON.stringify(descriptor)}:
  version: 1.0.0
  resolution: ${JSON.stringify(locator)}
${extra}  checksum: ${checksum}
  languageName: node
  linkType: hard
`
const source=(deps:Record<string,string>,records:string)=>`__metadata:
  version: 8
  cacheKey: 10c0

"app@workspace:.":
  version: 0.0.0-use.local
  resolution: "app@workspace:."
  dependencies:
${Object.entries(deps).map(([n,r])=>'    '+JSON.stringify(n)+': '+JSON.stringify('npm:'+r)+'\n').join('')}  languageName: unknown
  linkType: soft

${records}`
const basic=source({pkg:'^1'},record('pkg@npm:^1','pkg@npm:1.0.0'))
const profile=()=>({packages:{'node_modules/pkg':{name:'pkg',version:'1.0.0',integrity}}})
const normalize=(text=basic,p:any=profile())=>normalizeAlternateLock(parseYarnBerry(text),{dependencies:{pkg:'^1'}},p)

it('treats a changed well-formed cache hash only as unverified cache metadata, never npm SRI',()=>{
  const p=profile(),changed=basic.replace(checksum,'10c0/'+'b'.repeat(128))
  const result=normalize(changed,p).packages['node_modules/pkg']
  expect(result.berryChecksum).toBe('10c0/'+'b'.repeat(128))
  expect(result.integrity).toBe(integrity)
  expect(result.berryChecksum).not.toBe(result.integrity)
})
it.each(['berryChecksum','berryLocator'])('rejects mismatch with an operator-owned %s attestation',field=>{
  const p:any=profile();p.packages['node_modules/pkg'][field]=field==='berryChecksum'?'10c0/'+'b'.repeat(128):'pkg@npm:2.0.0'
  expect(()=>normalize(basic,p)).toThrow('Operator Berry checksum/locator mismatch')
})
it.each(['10c0/'+'a'.repeat(127),'9999/'+'a'.repeat(128),'sha512-forged','10c0/../../private','10c0/'+'g'.repeat(128),'&uploaded','true','10C0/'+'a'.repeat(128)])('refuses malicious or unsupported cache checksum %s',value=>{
  expect(()=>parseYarnBerry(basic.replace(checksum,value))).toThrow()
})
it.each([
  ['pkg@npm:1.0.0','other@npm:1.0.0'],
  ['pkg@npm:1.0.0','pkg@npm:2.0.0'],
  ['pkg@npm:1.0.0','pkg@virtual:abcdef12#npm:1.0.0'],
])('refuses locator identity substitution %s to %s',(before,after)=>expect(()=>parseYarnBerry(basic.replace(before,after))).toThrow())
it('requires npm aliases to retain the real package identity through descriptor, locator and trusted location',()=>{
  const text=source({alias:'npm:real@^1'},record('alias@npm:real@^1','real@npm:1.0.0'))
  // Root descriptors are represented as npm:real@^1, without a second npm prefix.
  const lock=parseYarnBerry(text.replace('npm:npm:real@^1','npm:real@^1'))
  const p={packages:{'node_modules/alias':{name:'real',version:'1.0.0',integrity}}}
  expect(normalizeAlternateLock(lock,{dependencies:{alias:'npm:real@^1'}},p).packages['node_modules/alias'].name).toBe('real')
  expect(()=>normalizeAlternateLock(lock,{dependencies:{alias:'npm:real@^1'}},{packages:{'node_modules/alias':{name:'alias',version:'1.0.0',integrity}}})).toThrow('identity')
  expect(()=>parseYarnBerry(text.replace('npm:npm:real@^1','npm:real@^1').replace('real@npm:1.0.0','alias@npm:1.0.0'))).toThrow('identity')
})
it('preserves a 128-digit virtual identity and refuses a different virtual locator',()=>{
  const hash='c'.repeat(128),d='pkg@virtual:'+hash+'#npm:^1',l='pkg@virtual:'+hash+'#npm:1.0.0'
  const text=source({pkg:'^1'},record(d,l))
  expect(parseYarnBerry(text).resolve('pkg','virtual:'+hash+'#npm:^1').berryLocator).toBe(l)
  expect(()=>parseYarnBerry(text.replace(l,l.replace(hash,'d'.repeat(128))))).toThrow('identity')
  expect(()=>parseYarnBerry(text.replace(l,l.replace(hash,hash.toUpperCase())))).toThrow('virtual')
})
it('refuses two virtual peer instances mapped onto one trusted package location',()=>{
  const text=source({left:'^1',right:'^1'},
    record('left@npm:^1','left@npm:1.0.0','  dependencies:\n    pkg: "virtual:abcdef12#npm:^1"\n')+
    record('right@npm:^1','right@npm:1.0.0','  dependencies:\n    pkg: "virtual:deadbeef#npm:^1"\n')+
    record('pkg@virtual:abcdef12#npm:^1','pkg@virtual:abcdef12#npm:1.0.0')+
    record('pkg@virtual:deadbeef#npm:^1','pkg@virtual:deadbeef#npm:1.0.0'))
  const packages:any={};for(const name of ['left','right','pkg'])packages['node_modules/'+name]={name,version:'1.0.0',integrity,...(name==='pkg'?{}:{dependencies:{pkg:'^1'}})}
  expect(()=>normalizeAlternateLock(parseYarnBerry(text),{dependencies:{left:'^1',right:'^1'}},{packages})).toThrow('Conflicting Berry virtual/locator')
})
it('checks peer constraints against the selected graph provider without inventing a peer descriptor',()=>{
  const text=source({peerful:'^1',pkg:'^1'},record('peerful@npm:^1','peerful@npm:1.0.0','  peerDependencies:\n    pkg: ">=1 <2"\n')+record('pkg@npm:^1','pkg@npm:1.0.0'))
  const p={packages:{...profile().packages,'node_modules/peerful':{name:'peerful',version:'1.0.0',integrity,peerDependencies:{pkg:'>=1 <2'}}}}
  expect(normalizeAlternateLock(parseYarnBerry(text),{dependencies:{peerful:'^1',pkg:'^1'}},p).packages['node_modules/pkg'].version).toBe('1.0.0')
  const missing=source({peerful:'^1'},record('peerful@npm:^1','peerful@npm:1.0.0','  peerDependencies:\n    pkg: ">=1 <2"\n'))
  expect(()=>normalizeAlternateLock(parseYarnBerry(missing),{dependencies:{peerful:'^1'}},p)).toThrow('peer provider missing')
})
it('requires explicit trusted patched identity before normalizing builtin patch bytes',()=>{
  const d='typescript@patch:typescript@npm%3A^1#optional!builtin<compat/typescript>',l='typescript@patch:typescript@npm%3A1.0.0#optional!builtin<compat/typescript>::version=1.0.0&hash=abcdef'
  const lock=parseYarnBerry(source({typescript:'^1'},record(d,l))),p={packages:{'node_modules/typescript':{name:'typescript',version:'1.0.0',integrity}}}
  expect(lock.resolve('typescript','^1').berryLocator).toBe(l)
  expect(()=>normalizeAlternateLock(lock,{dependencies:{typescript:'^1'}},p)).toThrow('operator-owned patched identity')
})
it.each(['file:../secret','link:./local','portal:./local','git:https://example.com/repo','workspace:*','patch:pkg@npm%3A1.0.0#./uploaded.patch'])('refuses unsupported dependency protocol %s',protocol=>{
  expect(()=>parseYarnBerry(basic.replace('pkg@npm:^1','pkg@'+protocol))).toThrow()
})
it('refuses conflicting cache hashes for a repeated locator and duplicate metadata',()=>{
  expect(()=>parseYarnBerry(basic+record('pkg@npm:1','pkg@npm:1.0.0').replace(checksum,'10c0/'+'b'.repeat(128)))).toThrow('Conflicting Yarn locator')
  expect(()=>parseYarnBerry('__metadata:\n'+basic)).toThrow('Duplicate Yarn metadata')
})
it('omits only an optional package absent from the trusted graph, preserving its inert condition record',()=>{
  const text=source({pkg:'^1'},record('pkg@npm:^1','pkg@npm:1.0.0','  dependencies:\n    native: "npm:^1"\n  dependenciesMeta:\n    native:\n      optional: true\n')+record('native@npm:^1','native@npm:1.0.0','  conditions: os=darwin\n').replace('  checksum: '+checksum+'\n',''))
  const p:any=profile();p.packages['node_modules/pkg'].optionalDependencies={native:'^1'}
  expect(normalize(text,p).packages['node_modules/native']).toBeUndefined()
  p.packages['node_modules/pkg'].dependencies={native:'^1'};delete p.packages['node_modules/pkg'].optionalDependencies
  expect(()=>normalize(text.replace('optional: true','optional: false'),p)).toThrow()
})

it('does not drop a required peer when the same name is an omitted optional dependency',()=>{
  const text=source({pkg:'^1'},record('pkg@npm:^1','pkg@npm:1.0.0','  dependencies:\n    native: "npm:^1"\n  dependenciesMeta:\n    native:\n      optional: true\n  peerDependencies:\n    native: "^1"\n'))
  const p:any=profile();p.packages['node_modules/pkg'].optionalDependencies={native:'^1'};p.packages['node_modules/pkg'].peerDependencies={native:'^1'}
  expect(()=>normalize(text,p)).toThrow('peer provider missing')
})
