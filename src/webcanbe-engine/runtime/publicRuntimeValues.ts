import type { RunnerOwner } from './runnerScheduler'
export type RuntimeValueScope = Readonly<RunnerOwner & { revision: string }>
/** Installed by the operator. Browser requests and source/example files cannot set this provider. */
export interface PublicRuntimeValueProvider { read(scope: RuntimeValueScope, signal: AbortSignal): Promise<Record<string,string>> }
export function publicRuntimeValues(value: unknown): Record<string,string> {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)throw Error('Public runtime values must be plain data.')
  const result:Record<string,string>=Object.create(null),entries=Object.entries(value)
  if(entries.length>32)throw Error('Too many public runtime values.')
  for(const [key,item]of entries) {
    if(!/^VITE_[A-Z][A-Z0-9_]{0,79}$/.test(key)||/TOKEN|SECRET|PASSWORD|PRIVATE|CREDENTIAL|API_?KEY|ACCESS_?KEY|AUTH/.test(key)||typeof item!=='string'||item.length>256||/[\x00-\x1f\x7f]/.test(item)||/-----BEGIN|(?:gh[pousr]_|github_pat_|sk_live_|AKIA)|(?:token|secret|password|credential|private|api[-_]?key|access[-_]?key)|^[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\./i.test(item))throw Error('Secret-like or unsupported public runtime value.')
    if(/^[A-Za-z0-9_=-]{24,}$/.test(item)&&(/[A-Z]/.test(item)&&/[a-z]/.test(item)&&/[0-9]/.test(item)||/^[a-f0-9]{32,}$/i.test(item)))throw Error('Opaque credential-like values are unsupported.')
    if(!/^(?:|true|false|[0-9]{1,8}|[A-Za-z][A-Za-z0-9 _.-]{0,63})$/.test(item)) {
      let url:URL;try{url=new URL(item)}catch{throw Error('Only finite public labels, booleans, numbers and HTTPS URLs are supported.')}
      if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.port||!/^\/[a-zA-Z0-9/_-]*$/.test(url.pathname))throw Error('Unsupported public runtime URL.')
    }
    result[key]=item
  }
  return Object.freeze(result)
}
export async function readPublicRuntimeValues(provider:PublicRuntimeValueProvider|undefined,scope:RuntimeValueScope,signal:AbortSignal,assertCurrent:()=>Promise<void>) {
  await assertCurrent();if(signal.aborted)throw Error('Runtime value authority expired.')
  const values=provider?publicRuntimeValues(await new Promise<Record<string,string>>((resolve,reject)=>{
    const abort=()=>reject(Error('Runtime value authority expired.')),timer=setTimeout(()=>reject(Error('Runtime value provider deadline exceeded.')),5000)
    signal.addEventListener('abort',abort,{once:true})
    Promise.resolve().then(()=>provider.read(Object.freeze({...scope}),signal)).then(resolve,reject).finally(()=>{clearTimeout(timer);signal.removeEventListener('abort',abort)})
    if(signal.aborted)abort()
  })):{}
  await assertCurrent();if(signal.aborted)throw Error('Runtime value authority expired.')
  return values
}
/** Static operator configuration; changing/revoking values requires a controlled server restart.
 * The surrounding PG capability check, never this map, grants project access. */
export class ConfiguredPublicRuntimeValues implements PublicRuntimeValueProvider {
  private readonly projects=new Map<string,Record<string,string>>()
  constructor(entries:unknown) {
    if(!Array.isArray(entries)||entries.length>64)throw Error('Invalid public runtime provider configuration.')
    for(const entry of entries) {
      if(!entry||typeof entry!=='object'||Object.keys(entry).some(k=>!['workspaceId','projectId','values'].includes(k))||!['workspaceId','projectId'].every(k=>typeof entry[k]==='string'&&/^[a-f0-9-]{36}$/.test(entry[k])))throw Error('Public runtime values require explicit workspace/project identifiers.')
      const key=entry.workspaceId+':'+entry.projectId;if(this.projects.has(key))throw Error('Duplicate public runtime value project.');this.projects.set(key,publicRuntimeValues(entry.values))
    }
  }
  async read(scope:RuntimeValueScope,signal:AbortSignal) {if(signal.aborted)throw Error('Public runtime values cancelled.');return this.projects.get(scope.workspaceId+':'+scope.projectId)??{}}
}
