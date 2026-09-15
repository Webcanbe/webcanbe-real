import type {AlternateLock} from './alternateLockfiles'
import {decodeBunBinaryLock,type BunBinaryDependency,type BunBinaryPackage} from './bunBinaryLock'

const objectMap=<T>()=>Object.create(null) as Record<string,T>
const descriptor=(name:string,requested:string)=>`${name}@${requested}`
const BUN_HEADER=Buffer.from('#!/usr/bin/env bun\nbun-lockfile-format-v0\n','utf8')

function u64(view:DataView,offset:number){
  if(offset<0||offset+8>view.byteLength)throw Error('Truncated Bun binary lock metadata.')
  const value=view.getUint32(offset,true)+view.getUint32(offset+4,true)*2**32
  if(!Number.isSafeInteger(value))throw Error('Unsafe Bun binary lock metadata integer.')
  return value
}

/**
 * The retained Todo lock has no workspace/trusted/override/patch serializer tail.
 * We validate that exact finite boundary before adapting the graph. Optional Bun
 * serializer extensions need their own bounded semantics; silently ignoring them
 * would let uninspected resolver metadata influence a future wider admission.
 */
function assertRetainedSerializerBoundary(bytes:Uint8Array){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength)
  const prefix=BUN_HEADER.length+4+32
  if(view.byteLength<prefix+8+5*8)throw Error('Truncated Bun binary lock metadata.')
  const serializedEnd=u64(view,prefix)
  if(serializedEnd>view.byteLength)throw Error('Bun binary lock serialized length escapes input.')
  const packageEnd=u64(view,prefix+8+4*8)
  if(packageEnd<0||packageEnd>serializedEnd)throw Error('Invalid Bun package table end.')
  let cursor=packageEnd
  for(let index=0;index<6;index++){
    if(cursor+16>serializedEnd)throw Error('Truncated Bun serialized buffer descriptor.')
    const start=u64(view,cursor),end=u64(view,cursor+8),descriptorEnd=cursor+16
    if(start<descriptorEnd||start>end||end>serializedEnd)throw Error('Invalid Bun serialized buffer range.')
    cursor=end
  }
  if(cursor+8>serializedEnd||u64(view,cursor)!==0)throw Error('Invalid Bun core serializer terminator.')
  cursor+=8
  if(cursor!==serializedEnd)throw Error('Unsupported Bun binary serializer tail metadata.')
}

/**
 * Adapt a decoded Bun binary graph to the same finite lock interface used by
 * operator-owned trusted profiles. Resolution is intentionally stricter than a
 * package-manager resolver: each exact descriptor observed in the binary graph
 * must point to exactly one package identity. If the same descriptor is wired to
 * different targets anywhere in the graph it is refused as ambiguous.
 *
 * No hoisting is guessed and no package-manager code is run. `from` is accepted
 * only for interface compatibility; the binary edge itself is the authority for
 * which package id a descriptor resolved to.
 */
export function parseBunBinary(bytes:Uint8Array):AlternateLock {
  assertRetainedSerializerBoundary(bytes)
  const graph=decodeBunBinaryLock(bytes)
  const records=new Map<number,any>(),targets=new Map<string,number>(),ambiguous=new Set<string>()
  const edgeMaps=(edges:readonly BunBinaryDependency[])=>{
    const dependencies=objectMap<string>(),optionalDependencies=objectMap<string>(),peerDependencies=objectMap<string>(),peerDependenciesMeta=objectMap<{optional:true}>()
    for(const edge of edges){
      const destination=edge.peer?peerDependencies:edge.optional?optionalDependencies:edge.normal?dependencies:undefined
      // Dev edges outside package zero are package-manager/build metadata rather
      // than executable package dependencies. Preserve refusal if they are the
      // sole behavior instead of silently treating them as runtime edges.
      if(!destination){if(edge.dev)continue;throw Error('Unsupported Bun dependency behavior.')}
      if(Object.prototype.hasOwnProperty.call(destination,edge.name))throw Error('Duplicate Bun dependency edge.')
      destination[edge.name]=edge.requested
      if(edge.peer&&edge.optional)peerDependenciesMeta[edge.name]={optional:true}
    }
    return{dependencies,optionalDependencies,peerDependencies,peerDependenciesMeta}
  }
  const packageRecord=(pkg:BunBinaryPackage)=>{
    let record=records.get(pkg.id)
    if(!record){record={name:pkg.name,version:pkg.version,integrity:pkg.integrity,resolved:pkg.resolved,...edgeMaps(pkg.dependencies),bunPackageId:pkg.id};records.set(pkg.id,record)}
    return record
  }
  for(const pkg of graph.packages)packageRecord(pkg)
  const observe=(edge:BunBinaryDependency)=>{
    if(edge.targetId===null)return
    const key=descriptor(edge.name,edge.requested),prior=targets.get(key)
    if(prior===undefined)targets.set(key,edge.targetId)
    else if(prior!==edge.targetId)ambiguous.add(key)
  }
  // Root groups are already represented by package-zero edges in the decoder's
  // graph traversal, while package records carry every transitive edge.
  for(const pkg of graph.packages)for(const edge of pkg.dependencies)observe(edge)
  // Some direct root descriptors may have no incoming request in a malformed
  // graph. The decoder's descriptor table is an independent bounded cross-check.
  for(const [key,pkg]of graph.descriptors){const prior=targets.get(key);if(prior===undefined)targets.set(key,pkg.id);else if(prior!==pkg.id)ambiguous.add(key)}
  const root={
    dependencies:{...graph.root.dependencies},
    devDependencies:{...graph.root.devDependencies},
    optionalDependencies:{...graph.root.optionalDependencies},
    peerDependencies:{...graph.root.peerDependencies},
  }
  return{
    format:'bun-binary-v0' as any,
    packages:Object.fromEntries([...records].map(([id,record])=>[String(id),record])),
    root,
    resolve:(name:string,requested:string)=>{
      const key=descriptor(name,requested)
      if(ambiguous.has(key))throw Error('Bun binary descriptor is ambiguous: '+name)
      const target=targets.get(key)
      if(target===undefined)throw Error('Bun binary resolution is missing: '+name)
      const record=records.get(target)
      if(!record||record.name!==name)throw Error('Bun binary resolution identity mismatch: '+name)
      return record
    },
  }
}
