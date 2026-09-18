import {expect,it} from 'vitest'
import {normalizeAlternateLock,parseYarnBerry,parseYarnClassic} from './runtime/alternateLockfiles'

const checksum=(digit:string)=>'10c0/'+digit.repeat(128)
const integrity='sha512-'+Buffer.alloc(64,9).toString('base64')
const berry=`# generated fixture\n__metadata:\n  version: 8\n  cacheKey: 10c0\n\n"app@workspace:.":\n  version: 0.0.0-use.local\n  resolution: "app@workspace:."\n  dependencies:\n    react: "npm:^18.0.0"\n    wrapper: "npm:^1.0.0"\n  languageName: unknown\n  linkType: soft\n\n"react@npm:^18.0.0":\n  version: 18.3.1\n  resolution: "react@npm:18.3.1"\n  checksum: ${checksum('1')}\n  languageName: node\n  linkType: hard\n\n"wrapper@npm:^1.0.0":\n  version: 1.0.0\n  resolution: "wrapper@npm:1.0.0"\n  dependencies:\n    peerful: "virtual:abcdef12#npm:^2.0.0"\n  checksum: ${checksum('2')}\n  languageName: node\n  linkType: hard\n\n"peerful@virtual:abcdef12#npm:^2.0.0":\n  version: 2.0.0\n  resolution: "peerful@virtual:abcdef12#npm:2.0.0"\n  peerDependencies:\n    react: ^18.0.0\n  checksum: ${checksum('3')}\n  languageName: node\n  linkType: hard\n`

it('parses Berry v8 as finite data and preserves exact virtual peer identity',()=>{
  const lock=parseYarnClassic(berry)
  expect(lock.format).toBe('yarn-berry-v8')
  expect(lock.cacheKey).toBe('10c0')
  expect(lock.resolve('peerful','virtual:abcdef12#npm:^2.0.0').berryLocator).toBe('peerful@virtual:abcdef12#npm:2.0.0')
  expect(()=>lock.resolve('peerful','virtual:deadbeef#npm:^2.0.0')).toThrow('Exact Yarn Berry descriptor')
})

it('keeps Berry cache identity distinct from operator-owned npm package integrity',()=>{
  const lock=parseYarnBerry(berry)
  const profile={packages:{
    'node_modules/react':{name:'react',version:'18.3.1',integrity},
    'node_modules/wrapper':{name:'wrapper',version:'1.0.0',integrity,dependencies:{peerful:'^2.0.0'}},
    'node_modules/wrapper/node_modules/peerful':{name:'peerful',version:'2.0.0',integrity,peerDependencies:{react:'^18.0.0'}},
  }}
  const normalized=normalizeAlternateLock(lock,{dependencies:{react:'^18.0.0',wrapper:'^1.0.0'}},profile)
  const peer=normalized.packages['node_modules/wrapper/node_modules/peerful']
  expect(peer.berryChecksum).toBe(checksum('3'))
  expect(peer.berryLocator).toBe('peerful@virtual:abcdef12#npm:2.0.0')
  expect(peer.integrity).toBe(integrity)
  const noSri={packages:{...profile.packages,'node_modules/react':{name:'react',version:'18.3.1'}}}
  expect(()=>normalizeAlternateLock(lock,{dependencies:{react:'^18.0.0',wrapper:'^1.0.0'}},noSri)).toThrow('identity/version/checksum')
})

const patched=`__metadata:\n  version: 8\n  cacheKey: 10c0\n\n"app@workspace:.":\n  version: 0.0.0-use.local\n  resolution: "app@workspace:."\n  dependencies:\n    typescript: "npm:^5.4"\n  languageName: unknown\n  linkType: soft\n\n"typescript@patch:typescript@npm%3A^5.4#optional!builtin<compat/typescript>":\n  version: 5.4.5\n  resolution: "typescript@patch:typescript@npm%3A5.4.5#optional!builtin<compat/typescript>::version=5.4.5&hash=5adc0c"\n  bin:\n    tsc: ./bin/tsc\n  checksum: ${checksum('4')}\n  languageName: node\n  linkType: hard\n`

it('maps only the exact Yarn builtin compatibility patch to its underlying npm descriptor',()=>{
  const lock=parseYarnBerry(patched),record=lock.resolve('typescript','^5.4')
  expect(record.version).toBe('5.4.5')
  expect(record.berryLocator).toContain('builtin<compat/typescript>')
  const profile={packages:{'node_modules/typescript':{name:'typescript',version:'5.4.5',integrity,berryLocator:record.berryLocator}}}
  const normalized=normalizeAlternateLock(lock,{devDependencies:{typescript:'^5.4'}},profile).packages['node_modules/typescript']
  expect(normalized.version).toBe('5.4.5')
  expect(normalized.integrity).toBe(integrity)
  expect(normalized.berryChecksum).toBe(checksum('4'))
})

const tagged=`__metadata:\n  version: 8\n  cacheKey: 10c0\n\n"app@workspace:.":\n  version: 0.0.0-use.local\n  resolution: "app@workspace:."\n  dependencies:\n    fsevents: "npm:~2.3.2"\n  languageName: unknown\n  linkType: soft\n\n"fsevents@npm:~2.3.2":\n  version: 2.3.3\n  resolution: "fsevents@npm:2.3.3"\n  dependencies:\n    node-gyp: "npm:latest"\n  checksum: ${checksum('5')}\n  conditions: os=darwin\n  languageName: node\n  linkType: hard\n\n"node-gyp@npm:latest":\n  version: 10.1.0\n  resolution: "node-gyp@npm:10.1.0"\n  checksum: ${checksum('6')}\n  languageName: node\n  linkType: hard\n\n"unused-os@npm:1.0.0":\n  version: 1.0.0\n  resolution: "unused-os@npm:1.0.0"\n  conditions: os=darwin\n  languageName: node\n  linkType: hard\n`

it('keeps npm tags exact and permits checksum omission only for unvisited conditional records',()=>{
  const lock=parseYarnBerry(tagged)
  expect(lock.resolve('node-gyp','npm:latest').version).toBe('10.1.0')
  expect(lock.resolve('unused-os','1.0.0').berryChecksum).toBeUndefined()
  const profile={packages:{
    'node_modules/fsevents':{name:'fsevents',version:'2.3.3',integrity,dependencies:{'node-gyp':'latest'}},
    'node_modules/fsevents/node_modules/node-gyp':{name:'node-gyp',version:'10.1.0',integrity},
  }}
  expect(normalizeAlternateLock(lock,{dependencies:{fsevents:'~2.3.2'}},profile).packages['node_modules/fsevents/node_modules/node-gyp'].version).toBe('10.1.0')
})

it.each([
  berry.replace('10c0/'+ '1'.repeat(128),'9999/'+ '1'.repeat(128)),
  berry.replace('virtual:abcdef12#npm:^2.0.0','virtual:bad!#npm:^2.0.0'),
  patched.replace('#optional!builtin<compat/typescript>','#./uploaded.patch'),
  berry.replace('wrapper: "npm:^1.0.0"','wrapper: "workspace:*"'),
  berry.replace('  linkType: hard\n\n"wrapper@','  mystery: execute\n  linkType: hard\n\n"wrapper@'),
])('refuses malformed checksum, virtual, patch, workspace and unknown Berry forms',source=>expect(()=>parseYarnBerry(source)).toThrow())
