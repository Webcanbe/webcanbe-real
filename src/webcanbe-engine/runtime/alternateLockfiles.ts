import {parse as parseJsonc,parseTree,type ParseError,type Node} from 'jsonc-parser'
import semver from 'semver'
const packageName=/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i
const object=(v:any):v is Record<string,any>=>Boolean(v&&typeof v==='object'&&!Array.isArray(v))
const sri=(v:unknown)=>typeof v==='string'&&/^(?:sha512-[A-Za-z0-9+/]{86}==|sha384-[A-Za-z0-9+/]{64}|sha256-[A-Za-z0-9+/]{43}=|sha1-[A-Za-z0-9+/]{27}=)$/.test(v)
function bounded(source:string){if(Buffer.byteLength(source)>2*1024*1024||source.includes('\0'))throw Error('Lock data exceeds the supported text bound.')}
function range(value:any){if(typeof value!=='string'||value.length>256||!semver.validRange(value))throw Error('Only npm semver dependency descriptors are supported.');return value}
/** Keep the requested dependency name separate from the registry package identity.
 * file/link/git/workspace protocols need a distinct graph adapter and never become npm ranges. */
export function npmDescriptor(name:string,value:unknown){
  if(!packageName.test(name)||typeof value!=='string'||value.length>256)throw Error('Invalid npm dependency descriptor.')
  if(!value.startsWith('npm:'))return {name,range:range(value)}
  const target=value.slice(4),at=target.indexOf('@',target.startsWith('@')?1:0)
  if(at<0)return {name,range:range(target)}
  const identity=target.slice(0,at)
  if(!packageName.test(identity))throw Error('Invalid npm alias identity.')
  return {name:identity,range:range(target.slice(at+1))}
}
function dependencies(value:any){if(value===undefined)return {};if(!object(value))throw Error('Invalid dependency data.');for(const [name,r]of Object.entries(value)){if(!packageName.test(name))throw Error('Invalid dependency name.');range(r)}return value}
export type AlternateLock={format:'yarn-classic-v1'|'bun-text-v1';packages:Record<string,any>;resolve:(name:string,range:string,location?:string)=>any;root?:Record<string,any>}
export function parseYarnClassic(source:string):AlternateLock {
  bounded(source)
  if(!/^# yarn lockfile v1\r?$/m.test(source)||/^__metadata:/m.test(source))throw Error('Only Yarn classic v1 with registry SRI is supported; Berry checksums/virtual packages need a separately verified adapter.')
  const descriptors=new Map<string,any>(),byName=new Map<string,any[]>();let current:any,section:string|undefined,records=0
  const atom=(s:string)=>s.startsWith('"')?JSON.parse(s):s
  for(const line of source.split(/\r?\n/)) {
    if(!line.trim()||line.startsWith('#'))continue
    if(!line.startsWith(' ')) {
      if(!line.endsWith(':')||++records>12000)throw Error('Invalid Yarn record.')
      const keys=line.slice(0,-1).match(/"(?:[^"\\]|\\.)*"|[^,]+/g)
      if(!keys?.length)throw Error('Missing Yarn descriptor.')
      current={dependencies:{},optionalDependencies:{}};section=undefined
      for(const raw of keys){const key=atom(raw.trim()),at=key.indexOf('@',key.startsWith('@')?1:0),name=key.slice(0,at),requested=key.slice(at+1);if(at<1||!packageName.test(name)||descriptors.has(key))throw Error('Duplicate/invalid Yarn descriptor.');const descriptor=npmDescriptor(name,requested);descriptors.set(key,current);if(current.name&&current.name!==descriptor.name)throw Error('Cross-package Yarn descriptor alias.');current.name=descriptor.name;const list=byName.get(name)??[];if(!list.includes(current))list.push(current);byName.set(name,list)}
      continue
    }
    if(!current)throw Error('Yarn field without a record.')
    const field=/^  (version|resolved|integrity) (.+)$/.exec(line)
    if(field){if(current[field[1]]!==undefined)throw Error('Duplicate Yarn field.');current[field[1]]=atom(field[2]);section=undefined;continue}
    const group=/^  (dependencies|optionalDependencies):$/.exec(line)
    if(group){if(current['_'+group[1]])throw Error('Duplicate Yarn dependency group.');current['_'+group[1]]=true;section=group[1];continue}
    const dep=/^    ("(?:[^"\\]|\\.)*"|[^ ]+) (.+)$/.exec(line)
    if(!dep||!section)throw Error('Unsupported Yarn lock syntax.')
    const name=atom(dep[1]);if(!packageName.test(name)||Object.prototype.hasOwnProperty.call(current[section],name))throw Error('Duplicate/invalid Yarn dependency.');const requested=atom(dep[2]);npmDescriptor(name,requested);current[section][name]=requested
  }
  if(!records)throw Error('Empty Yarn lock.')
  for(const list of byName.values())for(const record of list){
    if(!semver.valid(record.version)||!sri(record.integrity)||typeof record.resolved!=='string')throw Error('Yarn records require exact versions and registry SRI.')
    const url=new URL(record.resolved);if(url.protocol!=='https:'||url.username||url.password||url.port||url.search||!['registry.npmjs.org','registry.yarnpkg.com'].includes(url.hostname)||url.hash&&!/^#[a-f0-9]{40}$/i.test(url.hash))throw Error('Only immutable public registry Yarn tarballs are supported.')
  }
  return {format:'yarn-classic-v1',packages:Object.create(null),resolve:(name,requested)=>{
    const exact=descriptors.get(name+'@'+requested)
    if(exact)return exact
    // Alternate identities require their exact descriptor, never a range heuristic.
    if(requested.startsWith('npm:'))throw Error('Exact Yarn npm alias/protocol descriptor is missing: '+name)
    const matches=(byName.get(name)??[]).filter(x=>semver.satisfies(x.version,requested));if(matches.length===1)return matches[0]
    throw Error('Yarn resolution is missing or ambiguous: '+name)
  }}
}
/** Only npm tuples in the versioned text format. Binary locks remain opaque and unsupported. */
export function parseBunText(source:string):AlternateLock {
  bounded(source);const errors:ParseError[]=[],tree=parseTree(source,errors,{allowTrailingComma:true})
  if(errors.length||!tree)throw Error('Invalid Bun JSONC lock.')
  const verify=(node:Node,depth=0)=>{if(depth>64)throw Error('Bun lock nesting bound.');if(node.type==='object'){const seen=new Set<string>();for(const p of node.children??[]){const k=p.children?.[0].value;if(seen.has(k)||['__proto__','constructor','prototype'].includes(k))throw Error('Duplicate/reserved Bun lock key.');seen.add(k)}}for(const c of node.children??[])verify(c,depth+1)};verify(tree)
  const data=parseJsonc(source,[],{allowTrailingComma:true})
  if(!object(data)||data.lockfileVersion!==1||Object.keys(data).some(k=>!['lockfileVersion','configVersion','workspaces','packages'].includes(k))||data.configVersion!==undefined&&data.configVersion!==1||!object(data.workspaces)||Object.keys(data.workspaces).length!==1||!object(data.workspaces[''])||!object(data.packages)||Object.keys(data.packages).length>12000)throw Error('Only one-root Bun text lock v1 is supported.')
  const root=data.workspaces[''];if(Object.keys(root).some(k=>!['name','version','dependencies','devDependencies','optionalDependencies','peerDependencies'].includes(k)))throw Error('Unsupported Bun workspace metadata.')
  for(const k of ['dependencies','devDependencies','optionalDependencies','peerDependencies'])dependencies(root[k])
  const packages:Record<string,any>=Object.create(null)
  const location=(key:string)=>{
    const parts=key.split('/'),names:string[]=[]
    for(let i=0;i<parts.length;i++){const name=parts[i].startsWith('@')?parts[i]+'/'+parts[++i]:parts[i];if(!packageName.test(name))throw Error('Unsupported Bun package path.');names.push(name)}
    if(names.length>20)throw Error('Bun package nesting bound.');return names.map(n=>'node_modules/'+n).join('/')
  }
  for(const [key,tuple]of Object.entries(data.packages)){
    if(!Array.isArray(tuple)||tuple.length!==4||typeof tuple[0]!=='string'||!['','https://registry.npmjs.org'].includes(tuple[1])||!object(tuple[2])||!sri(tuple[3]))throw Error('Only exact npm Bun tuples with registry integrity are supported.')
    const at=tuple[0].lastIndexOf('@'),name=tuple[0].slice(0,at),version=tuple[0].slice(at+1),info=tuple[2],loc=location(key)
    if(!packageName.test(name)||!semver.valid(version)||!loc.endsWith('node_modules/'+name)||Object.keys(info).some(k=>!['dependencies','optionalDependencies','peerDependencies','optionalPeers','os','cpu','bin','binDir'].includes(k)))throw Error('Unsupported Bun package record.')
    for(const k of ['dependencies','optionalDependencies','peerDependencies'])dependencies(info[k])
    if(info.optionalPeers!==undefined&&(!Array.isArray(info.optionalPeers)||info.optionalPeers.some((n:any)=>typeof n!=='string'||!packageName.test(n))))throw Error('Invalid optional Bun peers.')
    packages[loc]={name,version,integrity:tuple[3],dependencies:info.dependencies,optionalDependencies:info.optionalDependencies,peerDependencies:info.peerDependencies,peerDependenciesMeta:Object.fromEntries((info.optionalPeers??[]).map((n:string)=>[n,{optional:true}]))}
  }
  return {format:'bun-text-v1',packages,root,resolve:(name,_range,from='')=>{
    let parent=from
    while(parent){const found=packages[parent+'/node_modules/'+name];if(found)return found;const at=parent.lastIndexOf('/node_modules/');parent=at<0?'':parent.slice(0,at)}
    return packages['node_modules/'+name]
  }}
}
/** Normalize only after proving every reachable declared dependency and required peer
 * against the operator-owned npm graph. No resolver or package installation runs. */
export function normalizeAlternateLock(lock:AlternateLock,manifest:any,profile:any){
  const declared={...manifest.devDependencies,...manifest.dependencies},packages:Record<string,any>={'':{dependencies:manifest.dependencies,devDependencies:manifest.devDependencies}},visited=new Set<string>()
  if(lock.root){for(const group of ['dependencies','devDependencies','optionalDependencies','peerDependencies'])if(JSON.stringify(Object.entries(lock.root[group]??{}).sort())!==JSON.stringify(Object.entries(manifest[group]??{}).sort()))throw Error('Bun root declaration differs from manifest.')}
  const located=(parent:string,name:string)=>{let from=parent;while(from){const p=from+'/node_modules/'+name;if(profile.packages[p])return p;const i=from.lastIndexOf('/node_modules/');from=i<0?'':from.slice(0,i)}return 'node_modules/'+name}
  const excludedPlatform=(record:any)=>[ ['os',process.platform],['cpu',process.arch] ].some(([key,current])=>{
    const values=record?.[key];if(!Array.isArray(values))return false
    return values.includes('!'+current)||values.filter((x:any)=>typeof x==='string'&&!x.startsWith('!')).length>0&&!values.includes(current)
  })
  const visit=(name:string,requested:string,location:string,from:string)=>{
    const trusted=profile.packages[location],actual=lock.resolve(name,requested,from)
    const descriptor=npmDescriptor(name,requested)
    if(!trusted||trusted.link||!actual||actual.name!==descriptor.name||(trusted.name??name)!==descriptor.name||actual.version!==trusted.version||actual.integrity!==trusted.integrity||!sri(trusted.integrity)||!semver.satisfies(trusted.version,descriptor.range))throw Error('Locked graph does not match pinned identity/version/integrity: '+location)
    packages[location]={...actual};if(visited.has(location))return;visited.add(location);if(visited.size>12000)throw Error('Dependency graph bound.')
    for(const group of ['dependencies','optionalDependencies']){
      const expected=trusted[group]??{},received=actual[group]??{}
      if(JSON.stringify(Object.entries(expected).sort())!==JSON.stringify(Object.entries(received).sort()))throw Error('Lock dependency edges differ from pinned metadata: '+location)
    }
    // Yarn classic does not encode peer metadata: the SRI-verified operator
    // package metadata supplies it. Bun's explicit peer data must also agree.
    if(lock.format==='bun-text-v1'&&JSON.stringify(Object.entries(trusted.peerDependencies??{}).sort())!==JSON.stringify(Object.entries(actual.peerDependencies??{}).sort()))throw Error('Bun peer metadata differs from pinned graph.')
    if(lock.format==='bun-text-v1'&&JSON.stringify(Object.keys(trusted.peerDependenciesMeta??{}).filter(n=>trusted.peerDependenciesMeta[n]?.optional===true).sort())!==JSON.stringify(Object.keys(actual.peerDependenciesMeta??{}).filter(n=>actual.peerDependenciesMeta[n]?.optional===true).sort()))throw Error('Bun optional-peer metadata differs from pinned graph.')
    for(const [dep,r]of Object.entries({...trusted.dependencies,...trusted.optionalDependencies,...trusted.peerDependencies})){
      const next=located(location,dep),isPeer=Object.prototype.hasOwnProperty.call(trusted.peerDependencies??{},dep),optional=Object.prototype.hasOwnProperty.call(trusted.optionalDependencies??{},dep)||isPeer&&trusted.peerDependenciesMeta?.[dep]?.optional
      if(optional&&(!profile.packages[next]||excludedPlatform(profile.packages[next])))continue
      visit(dep,String(r),next,location)
    }
  }
  for(const [name,r]of Object.entries(declared))visit(name,String(r),'node_modules/'+name,'')
  return {lockfileVersion:3,packages}
}
