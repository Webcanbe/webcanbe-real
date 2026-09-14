import type { PreviewSnapshot } from "./controlledPreview"
export type RefreshModule = { code: string; imports: Record<string, string>; boundary: boolean; propagate?: boolean }
export type RefreshManifest = { version: 1; entry: string; modules: Record<string, RefreshModule> }
export function refreshManifest(snapshot: PreviewSnapshot): RefreshManifest | undefined {
  const file = snapshot.files.find(file => file.path === "/_wcb/refresh.json")
  if (!file || file.base64.length > 32 * 1024 * 1024) return undefined
  try { const data = JSON.parse(Buffer.from(file.base64, "base64").toString("utf8")); return data.version === 1 && typeof data.entry === "string" && data.modules && typeof data.modules === "object" ? data : undefined } catch { return undefined }
}
/** A changed pure module may propagate through an unchanged acyclic import
 * graph to existing React boundaries. Entry, effects, cycles and graph changes
 * conservatively require document reload. Used by controller and worker. */
export function refreshChanges(before: PreviewSnapshot, after: PreviewSnapshot): string[] | undefined {
  const a=refreshManifest(before),b=refreshManifest(after)
  if(!a||!b||a.entry!==b.entry||before.html!==after.html||before.files.length!==after.files.length)return
  if(after.files.some(file=>!['/_wcb/app.js','/_wcb/refresh.json'].includes(file.path)&&!before.files.some(old=>old.path===file.path&&old.base64===file.base64&&old.contentType===file.contentType)))return
  const keys=Object.keys(a.modules).sort()
  if(keys.length>2000||JSON.stringify(keys)!==JSON.stringify(Object.keys(b.modules).sort()))return
  const reverse=new Map<string,string[]>(),changed:string[]=[]
  for(const id of keys){
    const old=a.modules[id],next=b.modules[id]
    if(!old||!next||JSON.stringify(old.imports)!==JSON.stringify(next.imports))return
    for(const dependency of Object.values(old.imports)){if(!a.modules[dependency])return;reverse.set(dependency,[...(reverse.get(dependency)??[]),id])}
    if(old.code!==next.code)changed.push(id)
  }
  if(!changed.length)return
  // Peel all acyclic leaves in linear time. Remaining nodes are cycles or
  // paths between cycles; conservatively refuse refresh through either.
  const cyclic=new Set(keys),incoming=new Map(keys.map(id=>[id,reverse.get(id)?.length??0])),outgoing=new Map(keys.map(id=>[id,Object.values(a.modules[id].imports).length]))
  const queue=keys.filter(id=>!incoming.get(id)||!outgoing.get(id))
  for(let index=0;index<queue.length;index++){
    const id=queue[index];if(!cyclic.delete(id))continue
    for(const child of Object.values(a.modules[id].imports)){incoming.set(child,incoming.get(child)!-1);if(!incoming.get(child))queue.push(child)}
    for(const parent of reverse.get(id)??[]){outgoing.set(parent,outgoing.get(parent)!-1);if(!outgoing.get(parent))queue.push(parent)}
  }
  const affected=new Set<string>(),visiting=new Set<string>()
  const visit=(id:string):boolean=>{
    if(visiting.has(id)||cyclic.has(id)||id===a.entry)return false
    if(affected.has(id))return true
    const old=a.modules[id],next=b.modules[id]
    if(old.boundary&&next.boundary){affected.add(id);return true}
    if(!old.propagate||!next.propagate||!reverse.get(id)?.length)return false
    visiting.add(id)
    if(!reverse.get(id)!.every(visit))return false
    visiting.delete(id);affected.add(id);return true
  }
  return changed.every(visit)?[...affected]:undefined
}
