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
export type AlternateLock={format:'yarn-classic-v1'|'yarn-berry-v8'|'bun-text-v1';packages:Record<string,any>;resolve:(name:string,range:string,location?:string)=>any;root?:Record<string,any>;cacheKey?:string}

type BerryRequest={name:string;range:string;selector:string;protocol:'npm'|'patch'|'workspace';virtual?:string;raw:string}
const splitNameRequest=(value:string)=>{const at=value.indexOf('@',value.startsWith('@')?1:0);if(at<1)throw Error('Invalid Yarn descriptor identity.');const name=value.slice(0,at),requested=value.slice(at+1);if(!packageName.test(name)||!requested)throw Error('Invalid Yarn descriptor identity.');return{name,requested}}
function berryNpmDescriptor(name:string,value:string){
  if(!value.startsWith('npm:'))throw Error('Invalid Yarn npm descriptor.')
  const target=value.slice(4),at=target.indexOf('@',target.startsWith('@')?1:0),identity=at<0?name:target.slice(0,at),selector=at<0?target:target.slice(at+1)
  if(!packageName.test(identity)||!selector||selector.length>256)throw Error('Invalid Yarn npm descriptor.')
  const valid=semver.validRange(selector)
  if(valid)return{name:identity,range:selector,selector}
  if(!/^[a-z][a-z0-9._-]{0,31}$/i.test(selector))throw Error('Unsupported Yarn npm selector.')
  return{name:identity,range:'*',selector:'tag:'+selector}
}
function berryPatch(name:string,value:string):BerryRequest|undefined{
  if(!value.startsWith('patch:'))return
  const body=value.slice(6),marker=body.indexOf('@npm%3A',body.startsWith('@')?1:0)
  if(marker<1)return
  const identity=body.slice(0,marker),after=body.slice(marker+7),builtin='#optional!builtin<compat/'
  const hashAt=after.indexOf(builtin)
  if(hashAt<1||!packageName.test(identity)||identity!==name)return
  const encodedRange=after.slice(0,hashAt),tail=after.slice(hashAt+builtin.length),close=tail.indexOf('>')
  if(close<1||tail.slice(0,close)!==identity)return
  const suffix=tail.slice(close+1)
  if(suffix&&!/^::version=[0-9A-Za-z.+-]{1,80}&hash=[a-f0-9]{6,64}$/.test(suffix))return
  let decoded:string
  try{decoded=decodeURIComponent(encodedRange)}catch{return}
  const requested=berryNpmDescriptor(name,'npm:'+decoded)
  if(requested.selector.startsWith('tag:'))return
  if(suffix){const exact=/^::version=([^&]+)&hash=/.exec(suffix)![1];if(!semver.valid(exact)||!semver.satisfies(exact,requested.range))return}
  return{name:requested.name,range:requested.range,selector:requested.selector,protocol:'patch',raw:value}
}
function berryRequest(name:string,value:unknown,allowWorkspace=false):BerryRequest{
  if(!packageName.test(name)||typeof value!=='string'||!value||value.length>512)throw Error('Invalid Yarn Berry dependency descriptor.')
  let raw=value,virtual:string|undefined
  if(raw.startsWith('virtual:')){
    const match=/^virtual:([a-f0-9]{6,64})#(.+)$/i.exec(raw)
    if(!match)throw Error('Invalid Yarn virtual descriptor.')
    virtual=match[1].toLowerCase();raw=match[2]
  }
  if(raw==='workspace:.'){
    if(!allowWorkspace||virtual)throw Error('Only the root Yarn workspace is supported; confined workspace graphs require a separate adapter.')
    return{name,range:'*',selector:raw,protocol:'workspace',raw:value}
  }
  const patch=berryPatch(name,raw)
  if(patch){if(virtual)throw Error('Virtual patched Yarn descriptors are unsupported.');return{...patch,raw:value}}
  if(!raw.startsWith('npm:'))throw Error('Unsupported Yarn Berry protocol; npm and builtin compatibility patches are the only package records admitted.')
  const requested=berryNpmDescriptor(name,raw)
  return{name:requested.name,range:requested.range,selector:requested.selector,protocol:'npm',virtual,raw:value}
}
function canonicalBerryRequest(name:string,value:string){
  if(value.startsWith('npm:')||value.startsWith('virtual:')||value.startsWith('patch:')||value.startsWith('workspace:'))return value
  // Project/package metadata expresses ordinary npm selectors without the protocol.
  berryNpmDescriptor(name,'npm:'+value)
  return'npm:'+value
}
function berryComparable(name:string,value:unknown){
  let raw=String(value)
  if(raw.startsWith('virtual:'))raw=raw.replace(/^virtual:[a-f0-9]{6,64}#/i,'')
  if(!/^(?:npm:|patch:|workspace:)/.test(raw))raw='npm:'+raw
  const parsed=berryRequest(name,raw,true)
  return parsed.name+'@'+parsed.protocol+':'+parsed.selector
}
function equivalentDependencyMap(expected:any,received:any,berry=false){
  const a=expected??{},b=received??{}
  if(!object(a)||!object(b)||Object.keys(a).length!==Object.keys(b).length)return false
  try{return Object.keys(a).sort().every(name=>Object.prototype.hasOwnProperty.call(b,name)&&(berry?berryComparable(name,a[name])===berryComparable(name,b[name]):String(a[name])===String(b[name])))}catch{return false}
}
function yamlPair(text:string){
  let key:string,rest:string
  if(text.startsWith('"')){
    let end=1,escaped=false
    for(;end<text.length;end++){const c=text[end];if(!escaped&&c==='"')break;if(c==='\\'&&!escaped)escaped=true;else escaped=false}
    if(end>=text.length)throw Error('Invalid quoted Yarn key.')
    key=JSON.parse(text.slice(0,end+1));rest=text.slice(end+1)
  }else{const colon=text.indexOf(':');if(colon<1)throw Error('Invalid Yarn field.');key=text.slice(0,colon).trim();rest=text.slice(colon)}
  if(typeof key!=='string'||!key||key.length>1024||!rest.startsWith(':'))throw Error('Invalid Yarn field.')
  const raw=rest.slice(1).trim()
  if(!raw)return{key,value:undefined as any}
  let value:any=raw
  if(raw.startsWith('"')){value=JSON.parse(raw);if(typeof value!=='string')throw Error('Invalid Yarn scalar.')}
  else if(raw==='true'||raw==='false')value=raw==='true'
  else if(/^\d+$/.test(raw))value=Number(raw)
  else if(/[\r\n]/.test(raw))throw Error('Invalid Yarn scalar.')
  if(typeof value==='string'&&value.length>2048)throw Error('Yarn scalar exceeds bound.')
  return{key,value}
}
/** Yarn Berry v8 is treated only as a finite data graph. No Yarn runtime, plugin,
 * PnP loader, cache archive or uploaded release bundle is ever executed. Berry
 * cache checksums are a distinct identity and are never substituted for npm SRI. */
export function parseYarnBerry(source:string):AlternateLock{
  bounded(source)
  const descriptors=new Map<string,any>(),patchAliases=new Map<string,any>(),records:any[]=[],metadata:Record<string,any>=Object.create(null)
  let current:any,group:string|undefined,subgroup:string|undefined,count=0
  for(const rawLine of source.split(/\r?\n/)){
    if(!rawLine.trim()||rawLine.startsWith('#'))continue
    if(/^\s*\t/.test(rawLine))throw Error('Tabs are unsupported in Yarn Berry data.')
    const indent=/^ */.exec(rawLine)![0].length,line=rawLine.slice(indent)
    if(indent===0){
      group=subgroup=undefined
      if(line==='__metadata:'){current=metadata;continue}
      if(!line.endsWith(':')||++count>12000)throw Error('Invalid Yarn Berry record.')
      const top=yamlPair(line)
      if(top.value!==undefined)throw Error('Invalid Yarn Berry record key.')
      const keys=top.key.split(', ')
      if(!keys.length||keys.length>64)throw Error('Invalid Yarn Berry descriptor set.')
      current={descriptorTexts:keys,dependencies:Object.create(null),peerDependencies:Object.create(null),dependenciesMeta:Object.create(null),peerDependenciesMeta:Object.create(null),bin:Object.create(null)}
      records.push(current)
      continue
    }
    if(!current)throw Error('Yarn Berry field without a record.')
    if(current===metadata){
      if(indent!==2)throw Error('Invalid Yarn Berry metadata indentation.')
      const {key,value}=yamlPair(line);if(!['version','cacheKey'].includes(key)||value===undefined||Object.prototype.hasOwnProperty.call(metadata,key))throw Error('Unsupported Yarn Berry metadata.')
      metadata[key]=value;continue
    }
    if(indent===2){
      const {key,value}=yamlPair(line)
      if(['dependencies','peerDependencies','dependenciesMeta','peerDependenciesMeta','bin'].includes(key)){
        if(value!==undefined||current['_'+key])throw Error('Invalid Yarn Berry map field.');current['_'+key]=true;group=key;subgroup=undefined;continue
      }
      if(!['version','resolution','checksum','languageName','linkType','conditions'].includes(key)||value===undefined||current[key]!==undefined)throw Error('Unsupported Yarn Berry record field.')
      current[key]=value;group=subgroup=undefined;continue
    }
    if(indent===4&&group){
      const {key,value}=yamlPair(line)
      if(group!=='bin'&&!packageName.test(key))throw Error('Invalid Yarn Berry package key.')
      if(group==='bin'){
        const binPath=typeof value==='string'?value.replace(/^\.\//,''):''
        if(key.length>128||typeof value!=='string'||value.length>512||!binPath||binPath.startsWith('/')||binPath.includes('\\')||binPath.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('Invalid inert Yarn bin metadata.')
      }
      if(['dependenciesMeta','peerDependenciesMeta'].includes(group)){
        if(value!==undefined||Object.prototype.hasOwnProperty.call(current[group],key))throw Error('Invalid Yarn Berry dependency metadata.');current[group][key]=Object.create(null);subgroup=key;continue
      }
      if(value===undefined||Object.prototype.hasOwnProperty.call(current[group],key))throw Error('Invalid Yarn Berry map value.')
      current[group][key]=value;subgroup=undefined;continue
    }
    if(indent===6&&group&&subgroup&&['dependenciesMeta','peerDependenciesMeta'].includes(group)){
      const {key,value}=yamlPair(line)
      if(!['optional','built'].includes(key)||typeof value!=='boolean'||Object.prototype.hasOwnProperty.call(current[group][subgroup],key))throw Error('Unsupported Yarn Berry dependency metadata.')
      current[group][subgroup][key]=value;continue
    }
    throw Error('Unsupported Yarn Berry indentation or structure.')
  }
  if(metadata.version!==8||typeof metadata.cacheKey!=='string'||!/^[a-z0-9]{4,16}$/i.test(metadata.cacheKey)||!records.length)throw Error('Only Yarn Berry lockfile version 8 with a bounded cache key is supported.')
  const checksumPattern=new RegExp('^'+metadata.cacheKey.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'/[a-f0-9]{128}$','i')
  let root:any
  for(const record of records){
    if(typeof record.version!=='string'||typeof record.resolution!=='string'||typeof record.languageName!=='string'||!['hard','soft'].includes(record.linkType))throw Error('Incomplete Yarn Berry record.')
    if(record.conditions!==undefined&&(typeof record.conditions!=='string'||!/^(?:(?:os|cpu|libc)=[a-z0-9_-]+)(?: & (?:os|cpu|libc)=[a-z0-9_-]+)*$/i.test(record.conditions)))throw Error('Unsupported Yarn Berry platform condition.')
    const locatorSplit=splitNameRequest(record.resolution),locator=berryRequest(locatorSplit.name,locatorSplit.requested,true)
    record.name=locator.name;record.berryLocator=record.resolution;record.berryChecksum=record.checksum
    if(locator.protocol==='workspace'){
      if(record.linkType!=='soft'||record.languageName!=='unknown'||record.checksum!==undefined||root)throw Error('Invalid or duplicate Yarn root workspace record.')
      root=record
    }else{
      if(record.linkType!=='hard'||record.languageName!=='node'||!semver.valid(record.version)||record.checksum!==undefined&&(!checksumPattern.test(record.checksum))||record.checksum===undefined&&record.conditions===undefined)throw Error('Yarn Berry package records require exact versions and matching cache checksums; only conditional unmaterialized records may omit a checksum.')
      if(!semver.valid(locator.range)||record.version!==locator.range)throw Error('Yarn Berry locator version mismatch.')
    }
    for(const [name,value]of Object.entries(record.dependencies)){berryRequest(name,value);if(typeof value!=='string')throw Error('Invalid Yarn Berry dependency.')}
    for(const [name,value]of Object.entries(record.peerDependencies)){if(!packageName.test(name))throw Error('Invalid Yarn Berry peer.');range(value)}
    for(const [name,meta]of Object.entries(record.dependenciesMeta)){if(!object(meta)||!Object.prototype.hasOwnProperty.call(record.dependencies,name))throw Error('Dangling Yarn Berry dependency metadata.')}
    for(const [name,meta]of Object.entries(record.peerDependenciesMeta)){if(!object(meta)||!Object.prototype.hasOwnProperty.call(record.peerDependencies,name))throw Error('Dangling Yarn Berry peer metadata.')}
    const allDependencies=record.dependencies,optional:Record<string,any>=Object.create(null),required:Record<string,any>=Object.create(null)
    for(const [name,value]of Object.entries(allDependencies))(record.dependenciesMeta[name]?.optional===true?optional:required)[name]=value
    record.dependencies=required;record.optionalDependencies=optional
    for(const text of record.descriptorTexts){
      const split=splitNameRequest(text),descriptor=berryRequest(split.name,split.requested,true)
      if(descriptor.name!==locator.name||descriptor.protocol==='workspace'&&locator.protocol!=='workspace'||descriptor.protocol==='patch'&&locator.protocol!=='patch'||descriptor.virtual!==locator.virtual&&descriptor.virtual!==undefined)throw Error('Yarn Berry descriptor/locator identity mismatch.')
      if(descriptor.protocol!=='workspace'&&!semver.satisfies(record.version,descriptor.range))throw Error('Yarn Berry descriptor does not admit its locator version.')
      const exact=split.name+'@'+split.requested
      if(descriptors.has(exact))throw Error('Duplicate Yarn Berry descriptor.');descriptors.set(exact,record)
      if(descriptor.protocol==='patch'){
        const underlying=split.name+'@npm:'+descriptor.selector,prior=patchAliases.get(underlying)
        if(prior&&prior!==record)throw Error('Ambiguous Yarn compatibility patch descriptor.')
        patchAliases.set(underlying,record)
      }
    }
  }
  if(!root)throw Error('Yarn Berry requires one root workspace record.')
  return{format:'yarn-berry-v8',packages:Object.create(null),cacheKey:metadata.cacheKey,root:{dependencies:{...root.dependencies,...root.optionalDependencies}},resolve:(name,requested)=>{
    if(!packageName.test(name)||typeof requested!=='string')throw Error('Invalid Yarn Berry lookup.')
    const key=name+'@'+canonicalBerryRequest(name,requested),exact=descriptors.get(key)??patchAliases.get(key)
    if(exact)return exact
    throw Error('Exact Yarn Berry descriptor is missing: '+key)
  }}
}

export function parseYarnClassic(source:string):AlternateLock {
  bounded(source)
  if(/^__metadata:/m.test(source))return parseYarnBerry(source)
  if(!/^# yarn lockfile v1\r?$/m.test(source))throw Error('Only Yarn classic v1 or finite Berry v8 lock data is supported.')
  const descriptors=new Map<string,any>(),byName=new Map<string,any[]>();let current:any,section:string|undefined,records=0,currentNames=new Set<string>()
  const atom=(s:string)=>s.startsWith('"')?JSON.parse(s):s
  for(const line of source.split(/\r?\n/)) {
    if(!line.trim()||line.startsWith('#'))continue
    if(!line.startsWith(' ')) {
      if(!line.endsWith(':')||++records>12000)throw Error('Invalid Yarn record.')
      const keys=line.slice(0,-1).match(/"(?:[^"\\]|\\.)*"|[^,]+/g)
      if(!keys?.length)throw Error('Missing Yarn descriptor.')
      current={dependencies:{},optionalDependencies:{}};currentNames=new Set();section=undefined
      for(const raw of keys){const key=atom(raw.trim()),at=key.indexOf('@',key.startsWith('@')?1:0),name=key.slice(0,at),requested=key.slice(at+1);if(at<1||!packageName.test(name)||descriptors.has(key))throw Error('Duplicate/invalid Yarn descriptor.');const descriptor=npmDescriptor(name,requested);descriptors.set(key,current);if(current.name&&current.name!==descriptor.name)throw Error('Cross-package Yarn descriptor alias.');current.name=descriptor.name;const list=byName.get(name)??[];if(!currentNames.has(name)){currentNames.add(name);list.push(current);byName.set(name,list)}}
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
  if(lock.root){
    if(lock.format==='yarn-berry-v8'){
      if(!equivalentDependencyMap(declared,lock.root.dependencies,true))throw Error('Yarn root declaration differs from manifest.')
    }else for(const group of ['dependencies','devDependencies','optionalDependencies','peerDependencies'])if(JSON.stringify(Object.entries(lock.root[group]??{}).sort())!==JSON.stringify(Object.entries(manifest[group]??{}).sort()))throw Error('Bun root declaration differs from manifest.')
  }
  const located=(parent:string,name:string)=>{let from=parent;while(from){const p=from+'/node_modules/'+name;if(profile.packages[p])return p;const i=from.lastIndexOf('/node_modules/');from=i<0?'':from.slice(0,i)}return 'node_modules/'+name}
  const excludedPlatform=(record:any)=>[ ['os',process.platform],['cpu',process.arch] ].some(([key,current])=>{
    const values=record?.[key];if(!Array.isArray(values))return false
    return values.includes('!'+current)||values.filter((x:any)=>typeof x==='string'&&!x.startsWith('!')).length>0&&!values.includes(current)
  })
  const visit=(name:string,requested:string,location:string,from:string)=>{
    const trusted=profile.packages[location],actual=lock.resolve(name,requested,from)
    const berry=lock.format==='yarn-berry-v8',descriptor=berry?berryRequest(name,canonicalBerryRequest(name,requested),true):npmDescriptor(name,requested)
    const identity=descriptor.name,versionRange=descriptor.range
    const lockIdentity=berry?typeof actual?.berryChecksum==='string'&&typeof actual?.berryLocator==='string'&&sri(trusted?.integrity):actual?.integrity===trusted?.integrity&&sri(trusted?.integrity)
    if(!trusted||trusted.link||!actual||actual.name!==identity||(trusted.name??name)!==identity||actual.version!==trusted.version||!lockIdentity||!semver.satisfies(trusted.version,versionRange))throw Error('Locked graph does not match pinned identity/version/checksum: '+location)
    packages[location]=berry?{...actual,integrity:trusted.integrity}:{...actual};if(visited.has(location))return;visited.add(location);if(visited.size>12000)throw Error('Dependency graph bound.')
    for(const group of ['dependencies','optionalDependencies']){
      const expected=trusted[group]??{},received=actual[group]??{}
      if(!(berry?equivalentDependencyMap(expected,received,true):JSON.stringify(Object.entries(expected).sort())===JSON.stringify(Object.entries(received).sort())))throw Error('Lock dependency edges differ from pinned metadata: '+location)
    }
    // Yarn classic does not encode peer metadata: the SRI-verified operator
    // package metadata supplies it. Berry and Bun explicit peer data must agree.
    if(lock.format!=='yarn-classic-v1'&&JSON.stringify(Object.entries(trusted.peerDependencies??{}).sort())!==JSON.stringify(Object.entries(actual.peerDependencies??{}).sort()))throw Error('Lock peer metadata differs from pinned graph.')
    if(lock.format!=='yarn-classic-v1'&&JSON.stringify(Object.keys(trusted.peerDependenciesMeta??{}).filter(n=>trusted.peerDependenciesMeta[n]?.optional===true).sort())!==JSON.stringify(Object.keys(actual.peerDependenciesMeta??{}).filter(n=>actual.peerDependenciesMeta[n]?.optional===true).sort()))throw Error('Lock optional-peer metadata differs from pinned graph.')
    for(const [dep,r]of Object.entries({...trusted.dependencies,...trusted.optionalDependencies,...trusted.peerDependencies})){
      const next=located(location,dep),isPeer=Object.prototype.hasOwnProperty.call(trusted.peerDependencies??{},dep),optional=Object.prototype.hasOwnProperty.call(trusted.optionalDependencies??{},dep)||isPeer&&trusted.peerDependenciesMeta?.[dep]?.optional
      if(optional&&(!profile.packages[next]||excludedPlatform(profile.packages[next])))continue
      const lockedRequested=berry&&!isPeer?(actual.dependencies?.[dep]??actual.optionalDependencies?.[dep]??String(r)):String(r)
      visit(dep,String(lockedRequested),next,location)
    }
  }
  for(const [name,r]of Object.entries(declared))visit(name,String(r),'node_modules/'+name,'')
  return {lockfileVersion:3,packages}
}
