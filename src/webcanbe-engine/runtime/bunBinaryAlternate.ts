import type {AlternateLock} from './alternateLockfiles'
import {decodeBunBinaryLock,type BunBinaryDependency,type BunBinaryPackage} from './bunBinaryLock'

const objectMap=<T>()=>Object.create(null) as Record<string,T>
const descriptor=(name:string,requested:string)=>`${name}@${requested}`

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
