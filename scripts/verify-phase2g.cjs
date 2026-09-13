// Phase 2G.1 local hosted-style acceptance. Actual SQLite/HTTP/Lima execution;
// neither this harness nor loopback TLS-policy QA claims production hosting.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),http=require('node:http');
const {build}=require('esbuild'),{ZipFile}=require('yazl');
const root=path.resolve(__dirname,'..'),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function zipDirectory(directory, telemetry='') {
 const zip=new ZipFile(),chunks=[];
 for(const file of fs.readdirSync(directory,{recursive:true})){const full=path.join(directory,file);if(!fs.statSync(full).isFile())continue;let bytes=fs.readFileSync(full);if(file==='src/main.tsx'&&telemetry)bytes=Buffer.from(bytes.toString()+telemetry);zip.addBuffer(bytes,file)}
 zip.outputStream.on('data',chunk=>chunks.push(chunk));const done=new Promise(resolve=>zip.outputStream.on('end',resolve));zip.end();await done;return Buffer.concat(chunks);
}
(async()=>{
 const output=path.resolve(process.argv[2]||'.webcanbe/runner/qa-2g-acceptance');fs.mkdirSync(output,{recursive:true});
 const temporary=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'wcb-2g-acceptance-'))),runtime=path.join(root,'.webcanbe/qa-owned/phase2g-'+crypto.randomUUID()+'.cjs');fs.mkdirSync(path.dirname(runtime),{recursive:true});
 let server,accounts,artifacts,registry,origin,browser;const results={environment:'LOCAL HOSTED-STYLE QA; NOT PRODUCTION',publicHostedImportReady:false,performance:{},independent:[]};
 try{
  await build({stdin:{contents:['projectRegistry','viteFixturePlugin','localLimaRunner','hostedAuthority','storageContracts','runnerScheduler','controlledPreview','isolatedPreview'].map(name=>'export * from "./src/webcanbe-engine/runtime/'+name+'";').join(''),resolveDir:root},bundle:true,platform:'node',format:'cjs',packages:'external',outfile:runtime,logLevel:'silent'});
  const api=require(runtime),{createServer}=await import('vite');
  fs.cpSync(path.join(root,'fixtures/compatible-react-vite'),path.join(temporary,'fixtures/compatible-react-vite'),{recursive:true});registry=new api.ProjectRegistry(temporary);
  accounts=new api.SqliteAuthorityStore(path.join(temporary,'accounts.sqlite'));artifacts=new api.SqliteArtifactStore(path.join(temporary,'artifacts.sqlite'),accounts);
  const userA=crypto.randomUUID(),userB=crypto.randomUUID(),workspaceA=crypto.randomUUID(),workspaceB=crypto.randomUUID();accounts.setWorkspaceMember(workspaceA,userA,'owner');accounts.setWorkspaceMember(workspaceA,userB,'editor');accounts.setWorkspaceMember(workspaceB,userB,'owner');
  const a=accounts.issueVerifiedSession(userA),b=accounts.issueVerifiedSession(userB),policy={editorOrigin:'https://app.webcanbe.example',editorSite:'webcanbe.example',viewerOrigin:'https://viewer.webcanbe-view.example',viewerSite:'webcanbe-view.example'};
  const telemetry=`\nsetInterval(()=>{const m=document.querySelector('main'),b=document.querySelector('button'),r=b?.getBoundingClientRect();if(m&&b)console.log('GQA:'+JSON.stringify({count:b.textContent,p:getComputedStyle(m).padding,title:document.querySelector('h1')?.textContent,x:r.x+r.width/2,y:r.y+r.height/2}))},150);`;
  const started=performance.now();
  const project=await registry.importZip('AUTHORED Profile kitchen',await zipDirectory(path.join(root,'fixtures/profile-kitchen'),telemetry));accounts.registerProject(a.session,workspaceA,project.id);accounts.setProjectMember(project.id,userB,'viewer');
  const other=await registry.importZip('Other tenant',await zipDirectory(path.join(root,'fixtures/coast-paths')));accounts.registerProject(b.session,workspaceB,other.id);
  const hosted=new api.HostedSessionBoundary(accounts,accounts,policy,true),provider=new api.LocalLimaRunnerProvider(root);
  const leases=new api.SqliteLeaseStore(path.join(temporary,'leases.sqlite'));
  server=await createServer({configFile:false,root,cacheDir:path.join(temporary,'cache'),plugins:[api.webCanBeFixturePlugin(root,{registry,runner:provider,hosted,leases,artifacts})],server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();origin='http://127.0.0.1:'+server.httpServer.address().port;
  const call=(actor,projectId,action,body={})=>new Promise((resolve,reject)=>{
   const request=http.request(origin+'/__webcanbe/api/projects/'+projectId+'/'+action,{method:'POST',headers:{Host:'app.webcanbe.example',Origin:policy.editorOrigin,'Content-Type':'application/json',Cookie:'__Host-wcb-session='+actor.token,'X-WCB-CSRF':actor.csrf}},response=>{let text='';response.setEncoding('utf8');response.on('data',chunk=>text+=chunk);response.on('end',()=>{try{resolve({status:response.statusCode,...JSON.parse(text)})}catch(error){reject(error)}})});request.on('error',reject);request.end(JSON.stringify(body));
  });
  const connected=await call(a,project.id,'session');assert.equal(connected.status,201);const session=connected.session;
  assert(!JSON.stringify(connected).includes(project.root));assert.equal(connected.role,'owner');assert.equal(connected.compatibilityDimensions.hostedReadiness.publicImportReady,false);
  let frame=await call(a,project.id,'preview',{...session,command:'start',route:'/recipes/42?tab=notes#details'});assert.equal(frame.status,200,JSON.stringify(frame));let generation=frame.generation,revision=frame.revision;
  results.performance.coldImportStartMs=Math.round(performance.now()-started);
  const capture=async()=>{const value=await call(a,project.id,'preview',{...session,expectedRevision:revision,command:'capture',generation});assert.equal(value.status,200,JSON.stringify(value));return value};
  const telemetryOf=f=>{const lines=f.observation.logs.filter(line=>line.startsWith('log: GQA:'));return lines.length?JSON.parse(lines.at(-1).slice(9)):undefined};
  const until=async predicate=>{for(let i=0;i<30;i++){frame=await capture();if(predicate(frame,telemetryOf(frame)))return frame;await sleep(80)}throw Error('Expected controlled render was not observed')};
  await until((f,t)=>t?.count.trim()==='Count is 0');
  const t=telemetryOf(frame);await call(a,project.id,'preview',{...session,command:'input',generation,sequence:frame.sequence,expectedRevision:revision,input:{type:'pointer',action:'click',x:t.x,y:t.y}});await until((f,t)=>t?.count.trim()==='Count is 1');
  fs.writeFileSync(path.join(output,'authored-before.png'),Buffer.from(frame.png,'base64'));
  const oldRevision=revision,oldSequence=frame.sequence;
  const edit=async(file,change,kind='update')=>{
   const current=await call(a,project.id,'files',{...session,file});assert.equal(current.status,200);const begin=performance.now();
   const saved=await call(a,project.id,'code',{...session,expectedRevision:current.revision,idempotencyKey:crypto.randomUUID(),operations:[{kind,file,expectedHash:crypto.createHash('sha256').update(current.source).digest('hex'),content:change(current.source)}]});assert.equal(saved.status,200,JSON.stringify(saved));revision=saved.revision;
   const applied=await call(a,project.id,'preview',{...session,command:'update',generation,expectedRevision:revision});assert.equal(applied.status,200,JSON.stringify(applied));return {...applied,elapsed:Math.round(performance.now()-begin)};
  };
  const css=await edit('src/Card.module.css',value=>value.replace('min-height: 900px','padding: 48px; min-height: 900px'));assert.equal(css.updateKind,'css-hot-update');assert.equal(css.generation,generation);results.performance.cssEditMs=css.elapsed;
  await until((f,t)=>t?.count.trim()==='Count is 1'&&t.p==='48px');assert.equal(frame.observation.route,'/recipes/42?tab=notes#details');fs.writeFileSync(path.join(output,'authored-css-state.png'),Buffer.from(frame.png,'base64'));
  const stale=await call(a,project.id,'preview',{...session,command:'input',generation,expectedRevision:oldRevision,sequence:oldSequence,input:{type:'scroll',dx:0,dy:10}});assert.equal(stale.status,409);
  const module=await edit('src/App.tsx',value=>value.replace('Profile kitchen','Updated kitchen'));assert.equal(module.updateKind,'incremental-rebuild-reload');assert.equal(module.generation,generation);results.performance.reactModuleEditMs=module.elapsed;
  await until((f,t)=>t?.title==='Updated kitchen'&&t.count.trim()==='Count is 0');assert.equal(frame.observation.route,'/recipes/42?tab=notes#details');fs.writeFileSync(path.join(output,'authored-module-reload.png'),Buffer.from(frame.png,'base64'));
  const viewer=(await call(b,project.id,'session')).session;
  assert.equal((await call(b,project.id,'code',{...viewer,expectedRevision:revision,operations:[]})).status,403);
  assert.equal((await call(b,project.id,'preview',{...viewer,command:'capture',generation})).status,422);
  for(const action of ['files','history','preview','export','code'])assert.equal((await call(a,other.id,action,{...session,generation,command:'capture'})).status,403);
  results.crossUserAndWorkspaceIsolation=true;results.viewerCannotWriteOrReuseGeneration=true;results.staleRevisionAndFrameDenied=true;results.cssStatePreserved=true;results.reactUpdateIsReloadNotHmr=true;
  // Structural file creation deliberately requires a fresh generation.
  const startRestart=performance.now(),created=await call(a,project.id,'code',{...session,expectedRevision:revision,idempotencyKey:crypto.randomUUID(),operations:[{kind:'create',file:'src/extra.ts',expectedHash:null,content:'export const extra = 1'}]});assert.equal(created.status,200);revision=created.revision;
  const restarted=await call(a,project.id,'preview',{...session,command:'update',generation});assert.equal(restarted.status,200,JSON.stringify(restarted));assert.equal(restarted.updateKind,'generation-restart');assert.notEqual(restarted.generation,generation);generation=restarted.generation;results.performance.generationRestartMs=Math.round(performance.now()-startRestart);
  await until((f,t)=>t?.title==='Updated kitchen');
  const beginFrame=performance.now();frame=await capture();results.performance.viewerFrameMs=Math.round(performance.now()-beginFrame);
  // Remove the private QA telemetry through real Code acceptance before export.
  await edit('src/main.tsx',source=>source.slice(0,-telemetry.length));
  const exported=await call(a,project.id,'export',{...session,expectedRevision:revision});assert.equal(exported.status,200);fs.writeFileSync(path.join(output,'authored-edited.zip'),Buffer.from(exported.archive,'base64'));
  accounts.setProjectMember(project.id,userA,null);await sleep(350);
  assert.equal((await call(a,project.id,'preview',{...session,command:'capture',generation})).status,403);assert.equal(registry.sessionActive(project.id,session.previewId),false);results.activeMembershipRevocation=true;
  // Independent sources are loaded unchanged. Raster samples and source mapping
  // provide real render evidence without adding telemetry to those projects.
  const {chromium}=require(process.env.WCB_PLAYWRIGHT_MODULE||'playwright');browser=await chromium.launch({headless:true,chromiumSandbox:true});const display=await browser.newPage({viewport:{width:1280,height:900}});
  for(const name of ['vite-react18-ts','vite-react19-ts']){
   const source=path.join(root,'fixtures/independent',name),p=await registry.importZip('INDEPENDENT '+name,await zipDirectory(source));accounts.registerProject(b.session,workspaceB,p.id);
   const conn=await call(b,p.id,'session');assert.equal(conn.status,201);const s=conn.session,view=await call(b,p.id,'preview',{...s,command:'start',route:'/'});assert.equal(view.status,200,JSON.stringify(view));
   await sleep(250);const raster=await call(b,p.id,'preview',{...s,command:'capture',generation:view.generation});assert.equal(raster.status,200,JSON.stringify(raster));assert.equal(raster.observation.route,'/');assert.equal(raster.observation.logs.filter(line=>line.startsWith('error:')).length,0);
   fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(raster.png,'base64'));await display.goto('about:blank');await display.setContent('<title>Independent controlled raster</title><img alt="Independent preview" src="data:image/png;base64,'+raster.png+'">');await display.screenshot({path:path.join(output,name+'-display.png')});
   const original=JSON.parse(fs.readFileSync(path.join(root,'docs/corpus',name+'.json')));for(const[file,record]of Object.entries(original.files))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(p.root,file))).digest('hex'),record.sha256);
   const exportStart=performance.now(),exp=await call(b,p.id,'export',{...s,expectedRevision:view.revision});assert.equal(exp.status,200,JSON.stringify(exp));fs.writeFileSync(path.join(output,name+'.zip'),Buffer.from(exp.archive,'base64'));
   results.independent.push({name,profile:conn.runtime.profile,unchanged:true,controlledRender:true,exportMs:Math.round(performance.now()-exportStart),sourceCommit:original.commit});
   await call(b,p.id,'preview',{...s,command:'stop'});
  }
  results.status='PASS';fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 }finally{if(browser)await browser.close();if(server)await server.close();await sleep(1200);artifacts?.close();accounts?.close();fs.rmSync(runtime,{force:true});fs.rmSync(temporary,{recursive:true,force:true})}
})().catch(error=>{console.error(error);process.exitCode=1});
