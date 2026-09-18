import {Worker} from 'node:worker_threads'
import {safeArchivePath} from './projectRegistry'

export type FiniteBuildPlan={external:string[];output:{experimentalMinChunkSize?:number}}
export function finiteBuildPlan(value:any):FiniteBuildPlan {
  const object=(v:any)=>v&&typeof v==='object'&&!Array.isArray(v)
  if(!object(value)||Object.keys(value).some(k=>k!=='rollupOptions')||!object(value.rollupOptions))throw Error('Unsupported finite build configuration.')
  const r=value.rollupOptions,o=r.output??{},external=r.external??[]
  if(Object.keys(r).some(k=>!['external','output'].includes(k))||!object(o)||Object.keys(o).some(k=>k!=='experimentalMinChunkSize')||!Array.isArray(external)||external.length>1||external.some(n=>n!=='fs/promises')||o.experimentalMinChunkSize!==undefined&&(!Number.isSafeInteger(o.experimentalMinChunkSize)||o.experimentalMinChunkSize<0||o.experimentalMinChunkSize>1_000_000))throw Error('Unsupported finite Rollup configuration.')
  return {external:[...external],output:{...o}}
}

/** Independent export-build stage for an already resolved/transpiled immutable JS
 * module graph. Does not load project files/config/plugins or execute module code.
 * The caller must supply an operator-owned, pinned, prepared profile directory. */
export async function buildFiniteExportGraph(profileRoot:string,entry:string,modules:Record<string,string>,plan:FiniteBuildPlan):Promise<Array<{fileName:string;code:string}>> {
  plan=finiteBuildPlan({rollupOptions:plan})
  const entries=Object.entries(modules);let bytes=0
  if(!safeArchivePath(entry)||!Object.prototype.hasOwnProperty.call(modules,entry)||entries.length>2000)throw Error('Invalid export graph entry/count.')
  for(const [file,code]of entries){if(!safeArchivePath(file)||!/\.[cm]?js$/.test(file)||typeof code!=='string'||Buffer.byteLength(code)>2*1024*1024||(bytes+=Buffer.byteLength(code))>40*1024*1024)throw Error('Invalid export module graph.')}
  if(active>=2)throw Error('Export compiler capacity reached.')
  active++
  return new Promise((resolve,reject)=>{
    const worker=new Worker(source,{eval:true,workerData:{profileRoot,entry,modules,plan},execArgv:[],env:{},resourceLimits:{maxOldGenerationSizeMb:128,maxYoungGenerationSizeMb:16,stackSizeMb:4}})
    let done=false
    const finish=(error?:Error,output?:Array<{fileName:string;code:string}>)=>{if(done)return;done=true;clearTimeout(timer);void worker.terminate().finally(()=>{active--;error?reject(error):resolve(output!)})}
    const timer=setTimeout(()=>finish(Error('Export compiler deadline exceeded.')),8000)
    worker.on('message',result=>Array.isArray(result.output)?finish(undefined,result.output):finish(Error('Finite export build failed.')))
    worker.on('error',()=>finish(Error('Export compiler resource/error boundary.')))
    worker.on('exit',()=>{if(!done)finish(Error('Export compiler exited without output.'))})
  })
}
let active=0
const source=String.raw`
const {parentPort,workerData:d}=require('node:worker_threads'),fs=require('node:fs'),path=require('node:path'),{createRequire,registerHooks}=require('node:module'),{fileURLToPath}=require('node:url');
(async()=>{
 const tool=createRequire(path.join(d.profileRoot,'package.json')),vendor=fs.realpathSync(path.join(d.profileRoot,'node_modules'));
 if(typeof registerHooks!=='function')throw Error('Missing module boundary');
 registerHooks({resolve(specifier,context,next){const r=next(specifier,context);if(r.url.startsWith('node:'))return r;if(!r.url.startsWith('file:'))throw Error('Protocol');const rel=path.relative(vendor,fs.realpathSync(fileURLToPath(r.url)));if(rel.startsWith('..')||path.isAbsolute(rel))throw Error('Host fallback');return r}});
 const {rollup}=tool('rollup');
 const bundle=await rollup({input:d.entry,external:d.plan.external,onwarn(w){if(w.code==='UNRESOLVED_IMPORT')throw Error('Unresolved import')},plugins:[{name:'operator-immutable-graph',resolveId(specifier,importer){const id=importer&&specifier.startsWith('.')?path.posix.normalize(path.posix.join(path.posix.dirname(importer),specifier)):specifier;if(!Object.hasOwn(d.modules,id))throw Error('Import outside immutable graph');return id},load(id){if(!Object.hasOwn(d.modules,id))throw Error('Unknown module');return d.modules[id]}}]});
 try{const options={format:'es',entryFileNames:'app.js',chunkFileNames:'[name]-[hash].js',...d.plan.output};let result=await bundle.generate(options),minimum=d.plan.output.experimentalMinChunkSize??0;const secondary=result.output.filter(o=>o.type==='chunk'&&!o.isEntry);if(minimum>0&&secondary.length&&secondary.every(o=>Buffer.byteLength(o.code)<minimum))result=await bundle.generate({...options,inlineDynamicImports:true});let total=0;const output=result.output.map(o=>{if(o.type!=='chunk'||Buffer.byteLength(o.code)>2*1024*1024||(total+=Buffer.byteLength(o.code))>40*1024*1024)throw Error('Output bound');return {fileName:o.fileName,code:o.code}});parentPort.postMessage({output})}finally{await bundle.close()}
})().catch(()=>parentPort.postMessage({error:'Finite export build failed'}));
`
