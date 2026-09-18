import { UNO_FORMS_V1_ADAPTER_SOURCE } from './unoFormsV1Adapter'

/** Fixed operator code. Uploaded configuration is structured-cloned data, never executable source. */
export const CSS_WORKER_SOURCE = String.raw`
const {parentPort,workerData:data}=require('node:worker_threads');
const fs=require('node:fs'),path=require('node:path'),{createRequire,registerHooks}=require('node:module'),{pathToFileURL,fileURLToPath}=require('node:url');
${UNO_FORMS_V1_ADAPTER_SOURCE}
(async()=>{
 const requireTool=createRequire(path.join(data.profileRoot,'package.json')),vendor=fs.realpathSync(path.join(data.profileRoot,'node_modules'));
 if(typeof registerHooks!=='function')throw Error('Node synchronous module isolation hooks required');
 registerHooks({resolve(specifier,context,nextResolve){const result=nextResolve(specifier,context);if(result.url.startsWith('node:'))return result;if(!result.url.startsWith('file:'))throw Error('CSS module protocol rejected');const relative=path.relative(vendor,fs.realpathSync(fileURLToPath(result.url)));if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('CSS transitive host fallback forbidden');return result}});
 const trusted=name=>{const file=fs.realpathSync(requireTool.resolve(name)),relative=path.relative(vendor,file);if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('CSS host fallback forbidden');return file};
 let css,sources;
 if(data.kind==='tailwind3'){
  const tw=requireTool(trusted('tailwindcss')),pc=requireTool(trusted('postcss'));
  const config={...data.config,content:data.sources,plugins:(data.config.plugins||[]).map(name=>{if(!['@tailwindcss/typography','tailwindcss-animate'].includes(name))throw Error('Unknown trusted plugin');return requireTool(trusted(name))})};
  const plugins=[tw(config)];
  if(data.autoprefixer)plugins.push(requireTool(trusted('autoprefixer'))({...data.autoprefixer,overrideBrowserslist:data.autoprefixer.overrideBrowserslist||['> 0.5%','last 2 versions','Firefox ESR','not dead'],env:'production',stats:{}}));
  css=(await pc(plugins).process(data.code,{from:undefined,map:false})).css;
 }else{
  const core=await import(pathToFileURL(trusted('@unocss/core')).href),presetUno=(await import(pathToFileURL(trusted('@unocss/preset-uno')).href)).presetUno,presetAttributify=(await import(pathToFileURL(trusted('@unocss/preset-attributify')).href)).presetAttributify,transformerDirectives=(await import(pathToFileURL(trusted('@unocss/transformer-directives')).href)).default,transformerVariantGroup=(await import(pathToFileURL(trusted('@unocss/transformer-variant-group')).href)).default,MagicString=requireTool(trusted('magic-string'));
  const presets=[];
  for(const p of data.config.presets||[{adapter:'presetUno',options:{}}]){
   if(p.adapter==='presetForms'){
    if(Object.keys(p.options||{}).length)throw Error('Forms adapter options rejected');presets.push(fixedUnoFormsV1Preset());
   }else{if(!['presetUno','presetAttributify'].includes(p.adapter))throw Error('Unknown trusted Uno preset');presets.push((p.adapter==='presetUno'?presetUno:presetAttributify)(p.options))}
  }
  const transformers=(data.config.transformers||[]).map(p=>{if(!['transformerDirectives','transformerVariantGroup'].includes(p.adapter))throw Error('Unknown trusted Uno transformer');return (p.adapter==='transformerDirectives'?transformerDirectives:transformerVariantGroup)(p.options)}).sort((a,b)=>(a.enforce==='pre'?-1:a.enforce==='post'?1:0)-(b.enforce==='pre'?-1:b.enforce==='post'?1:0));
  const generator=await core.createGenerator({...data.config,presets,transformers:[]});sources=Object.create(null);let total=0;
  for(const source of data.sources){
   let transformed=source.raw;
   for(const transformer of transformers)if(!transformer.idFilter||transformer.idFilter(source.file)){const code=new MagicString(transformed);await transformer.transform(code,source.file,{uno:generator});transformed=code.toString();if(Buffer.byteLength(transformed)>2*1024*1024)throw Error('Transformation bound')}
   const bytes=Buffer.byteLength(transformed);total+=bytes;
   if(bytes>2*1024*1024||total>40*1024*1024)throw Error('Transformed source limit exceeded');sources[source.file]=transformed;
  }
  css=(await generator.generate(Object.values(sources).join('\n'))).css;
 }
 if(Buffer.byteLength(css)>2*1024*1024)throw Error('Compiled CSS limit exceeded');parentPort.postMessage({css,sources});
})().catch(()=>parentPort.postMessage({error:'Bounded CSS compilation failed'}));
`
