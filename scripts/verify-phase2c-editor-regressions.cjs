// Trusted local QA only: unchanged editor plugins with a fresh bounded registry.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{build}=require('esbuild');
const root=path.resolve(__dirname,'..'),output=process.argv[2]&&path.resolve(process.argv[2]);
if(!output)throw Error('Usage: node scripts/verify-phase2c-editor-regressions.cjs OUTPUT_DIRECTORY');
(async()=>{
 fs.mkdirSync(output,{recursive:true});const job=fs.mkdtempSync(path.join(os.tmpdir(),'wcb-2c-qa-'));
 const runtime=path.join(root,'.webcanbe/qa-owned/editor-'+crypto.randomUUID()+'.cjs');fs.mkdirSync(path.dirname(runtime),{recursive:true});
 let server;
 try{
  await build({stdin:{contents:'export {webCanBeFixturePlugin} from "./src/webcanbe-engine/runtime/viteFixturePlugin"; export {ProjectRegistry} from "./src/webcanbe-engine/runtime/projectRegistry";',resolveDir:root},bundle:true,platform:'node',format:'cjs',packages:'external',outfile:runtime,logLevel:'silent'});
  const {webCanBeFixturePlugin,ProjectRegistry}=require(runtime);
  fs.cpSync(path.join(root,'fixtures/compatible-react-vite'),path.join(job,'fixtures/compatible-react-vite'),{recursive:true});
  const registry=new ProjectRegistry(job),key=crypto.randomBytes(32).toString('base64url'),log=path.join(job,'private-editor.log');
  fs.writeFileSync(log,'WebCanBe local editor access key (this server run only): '+key+'\n',{mode:0o600});
  const {createServer}=await import('vite'),{default:react}=await import('@vitejs/plugin-react'),{default:tailwind}=await import('@tailwindcss/vite');
  server=await createServer({configFile:false,root,cacheDir:path.join(job,'vite-cache'),plugins:[webCanBeFixturePlugin(root,{registry,editorKey:key}),react(),tailwind()],server:{host:'127.0.0.1',port:0,allowedHosts:['localhost','127.0.0.1'],watch:{ignored:['**/.webcanbe/**']}},logLevel:'error'});
  await server.listen();const origin='http://127.0.0.1:'+server.httpServer.address().port;
  for(const [script,args] of [
   ['verify-phase2b-browser.cjs',[path.join(output,'phase2b'),log,origin]],
   ['verify-field-notes-browser.cjs',[path.join(output,'field-notes'),log,origin]],
   ['verify-phase2c-editor-boundary.cjs',[log,origin]],
  ])await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.join(root,'scripts',script),...args],{cwd:root,env:{...process.env,WCB_QA_REGISTRY_ROOT:job},stdio:'inherit',timeout:180000});child.on('error',reject);child.on('exit',(code,signal)=>code===0?resolve():reject(Error(script+' failed: '+(signal||code))))});
  fs.writeFileSync(path.join(output,'editor-results.json'),JSON.stringify({freshRegistry:true,existingImportsUntouched:true,nativeChromiumSandbox:true,hashRouterRegressions:true,fieldNotesEditing:true,staleHashOverlayCleared:true,lateInspectionRejected:true,reselection:true,duplicateRouteStable:true,persistentQualifiedSecurityNotice:true,forgedBridgeDenied:true,stopRestart:true,httpEnabled:false},null,2)+'\n');
  console.log('PASS editor regressions with a fresh registry and unchanged production limits.');
 }finally{if(server)await server.close();fs.rmSync(runtime,{force:true});fs.rmSync(job,{recursive:true,force:true})}
})().catch(error=>{console.error(error);process.exitCode=1});
