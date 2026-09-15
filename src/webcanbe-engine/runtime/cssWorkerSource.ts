/** Fixed operator code. Uploaded configuration is structured-cloned data, never executable source. */
export const CSS_WORKER_SOURCE = String.raw`
const {parentPort,workerData:data}=require('node:worker_threads');
const fs=require('node:fs'),path=require('node:path'),{createRequire,registerHooks}=require('node:module'),{pathToFileURL,fileURLToPath}=require('node:url');
(async()=>{
 const requireTool=createRequire(path.join(data.profileRoot,'package.json')),vendor=fs.realpathSync(path.join(data.profileRoot,'node_modules'));
 if(typeof registerHooks!=='function')throw Error('Node synchronous module isolation hooks required');
 registerHooks({resolve(specifier,context,nextResolve){const result=nextResolve(specifier,context);if(result.url.startsWith('node:'))return result;if(!result.url.startsWith('file:'))throw Error('CSS module protocol rejected');const relative=path.relative(vendor,fs.realpathSync(fileURLToPath(result.url)));if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('CSS transitive host fallback forbidden');return result}});
 const trusted=name=>{const file=fs.realpathSync(requireTool.resolve(name)),relative=path.relative(vendor,file);if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('CSS host fallback forbidden');return file};
 let css;
 if(data.kind==='tailwind3'){
  const tw=requireTool(trusted('tailwindcss')),pc=requireTool(trusted('postcss'));
  const config={...data.config,content:data.sources,plugins:(data.config.plugins||[]).map(name=>{if(!['@tailwindcss/typography','tailwindcss-animate'].includes(name))throw Error('Unknown trusted plugin');return requireTool(trusted(name))})};
  const plugins=[tw(config)];
  if(data.autoprefixer)plugins.push(requireTool(trusted('autoprefixer'))({...data.autoprefixer,overrideBrowserslist:data.autoprefixer.overrideBrowserslist||['> 0.5%','last 2 versions','Firefox ESR','not dead'],env:'production',stats:{}}));
  css=(await pc(plugins).process(data.code,{from:undefined,map:false})).css;
 }else{
  const uno=await import(pathToFileURL(trusted('unocss')).href),config={...data.config,presets:(data.config.presets||[{adapter:'presetUno',options:{}}]).map(p=>{if(!['presetUno','presetAttributify'].includes(p.adapter))throw Error('Unknown trusted Uno preset');return uno[p.adapter](p.options)})};
  const generator=await uno.createGenerator(config);css=(await generator.generate(data.sources.map(s=>s.raw).join('\n'))).css;
 }
 if(Buffer.byteLength(css)>2*1024*1024)throw Error('Compiled CSS limit exceeded');parentPort.postMessage({css});
})().catch(()=>parentPort.postMessage({error:'Bounded CSS compilation failed'}));
`
