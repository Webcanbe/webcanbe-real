// Fixed, repository-authored fixtures only. This does NOT enable HTTP in the editor.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.WCB_PLAYWRIGHT_MODULE || 'playwright');
const {build}=require('esbuild');
const root=path.resolve(__dirname,'..'),output=path.resolve(process.argv[2]||'');
if(!process.argv[2])throw Error('Usage: node scripts/verify-phase2c-artifacts.cjs OUTPUT_DIRECTORY');
const check=(value,message)=>{if(!value)throw Error(message)};
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const runtimeFile=path.join(root,'.webcanbe','qa-owned','runtime-'+require('node:crypto').randomUUID()+'.cjs');fs.mkdirSync(path.dirname(runtimeFile),{recursive:true});
 await build({stdin:{contents:'export {HttpPreviewServer} from "./src/webcanbe-engine/runtime/httpPreviewServer"; export {ProjectRegistry} from "./src/webcanbe-engine/runtime/projectRegistry"; export {exportProjectZip} from "./src/webcanbe-engine/runtime/projectExport"; export {patchText,patchStyle,formatTransactionDiff} from "./src/webcanbe-engine/mutations/sourceMutations";',resolveDir:root},bundle:true,platform:'node',format:'cjs',packages:'external',outfile:runtimeFile,logLevel:'silent'});
 const {HttpPreviewServer,ProjectRegistry,exportProjectZip,patchText,patchStyle,formatTransactionDiff}=require(runtimeFile);
 const job=fs.mkdtempSync(path.join(os.tmpdir(),'wcb-2c-browser-'));
 fs.cpSync(path.join(root,'fixtures/compatible-react-vite'),path.join(job,'fixtures/compatible-react-vite'),{recursive:true});
 const registry=new ProjectRegistry(job),previews=new HttpPreviewServer(registry,root);
 const host=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});res.end('<!doctype html><title>Phase 2C fixed-fixture harness</title><style>body{margin:0}iframe{width:100vw;height:100vh;border:0;display:block}</style>')});
 await new Promise(resolve=>host.listen(0,'127.0.0.1',resolve));const editorOrigin='http://127.0.0.1:'+host.address().port;
 let browser;const results=[];
 try{
  browser=await chromium.launch({headless:true,chromiumSandbox:true});
  for(const fixture of [
   {name:'coast-paths',entry:'/',rootHeading:'A coast worth exploring.',route:'/places/42?mode=quiet#details',heading:'A closer look at the coast.',next:'Next place',nextText:'PLACE 7',unknown:'/not-on-the-map',unknownHeading:'This place is not on our map.'},
   {name:'harbor-desk',entry:'/desk/',rootHeading:'A place for careful work.',route:'/desk/projects/23?tab=notes#summary',heading:'Project notes from the harbor.',next:'Next project',nextText:'Project 24',unknown:'/desk/missing',unknownHeading:'That project is not in this desk.'}
  ]){
   const originalRoot=path.join(root,'fixtures',fixture.name),fixtureProject={...registry.get('phase1-fixture'),root:originalRoot};
   const project=await registry.importZip(fixture.name,await exportProjectZip(fixtureProject)),session=registry.createSession(project.id);
   const canonical=['src/App.jsx','package.json','package-lock.json','vite.config.js'].map(file=>[file,fs.readFileSync(path.join(project.root,file),'utf8')]);
   const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   // Containment for these known fixtures only; routing interception is NOT a WebRTC firewall.
   await page.route('**/*',route=>{const u=new URL(route.request().url());return u.hostname==='127.0.0.1'||/^wcb-[a-f0-9-]+\.localhost$/.test(u.hostname)?route.continue():route.abort()});
   await page.goto(editorOrigin);let result;
   const frame=()=>page.frames().find(f=>result&&f.url().startsWith(result.origin));
   async function mount(route){
    result=await previews.start(project,session.previewId,route,editorOrigin);
    check(!result.html.includes(session.capability),'Source capability leaked into envelope');
    await page.evaluate(({html,session,generation})=>{
      document.querySelector('iframe')?.remove();if(window.previousBlob)URL.revokeObjectURL(window.previousBlob);
      const outer=document.createElement('iframe');outer.sandbox='allow-scripts';outer.title='Prototype confinement envelope';
      window.observations=[];window.configure=active=>outer.contentWindow?.postMessage({channel:'webcanbe-compatible-v1',type:'configure',session,generation,active},'*');
      window.onmessage=event=>{if(event.source===outer.contentWindow&&event.origin==='null'&&event.data?.session===session&&event.data?.generation===generation)window.observations.push(event.data)};
      outer.onload=()=>window.configure(false);window.previousBlob=URL.createObjectURL(new Blob([html],{type:'text/html'}));outer.src=window.previousBlob;document.body.append(outer);
    },{html:result.html,session:session.previewId,generation:result.generation});
    await page.waitForFunction(()=>window.observations.some(message=>message.type==='ready'));
   }
   async function currentRoute(){return frame().evaluate(()=>location.pathname+location.search+location.hash)}
   async function select(locator){await page.evaluate(()=>window.configure(true));await locator.click();await page.waitForFunction(()=>window.observations.some(message=>message.type==='select'));const selected=await page.evaluate(()=>window.observations.filter(message=>message.type==='select').at(-1));return selected.element.identity}
   await mount(fixture.entry);await frame().getByRole('heading',{name:fixture.rootHeading}).waitFor();
   const link=fixture.name==='coast-paths'?'Explore place 42':'Open project 23';await frame().getByRole('link',{name:link}).click();await frame().getByRole('heading',{name:fixture.heading}).waitFor();check(await currentRoute()===fixture.route,'Link did not retain route/query/anchor');
   for(const image of await frame().locator('img').all())check(await image.evaluate(i=>i.complete&&i.naturalWidth>0),'Nested imported/public asset failed');
   await frame().getByRole('button',{name:fixture.next}).click();await frame().getByText(fixture.nextText,{exact:true}).waitFor();const nextRoute=await currentRoute();
   await frame().evaluate(()=>history.back());await frame().waitForFunction(route=>location.pathname+location.search+location.hash===route,fixture.route);
   await frame().evaluate(()=>history.forward());await frame().waitForFunction(route=>location.pathname+location.search+location.hash===route,nextRoute);
   await mount(fixture.route);await frame().getByRole('heading',{name:fixture.heading}).waitFor();await Promise.all([frame().waitForNavigation({waitUntil:'load'}),frame().evaluate(()=>location.reload())]);await frame().getByRole('heading',{name:fixture.heading}).waitFor();check(await currentRoute()===fixture.route,'Hard refresh lost route/query/anchor');
   check(await frame().evaluate(()=>{try{void parent.document;return false}catch{return true}}),'Parent DOM accessible');
   check(await frame().evaluate(()=>{try{void top.document;return false}catch{return true}}),'Top DOM accessible');
   check(await frame().evaluate(()=>{try{localStorage.setItem('probe','synthetic');return false}catch{return true}}),'Opaque storage boundary failed');
   check(await frame().evaluate(async()=>{try{await fetch('/_wcb/app.js');return false}catch{return true}}),'Fetch CSP failed');
   check(await frame().evaluate(async()=>{try{await navigator.serviceWorker.register('/_wcb/app.js');return false}catch{return true}}),'Persistent worker was permitted');
   for(const [file,content] of canonical)check(fs.readFileSync(path.join(project.root,file),'utf8')===content,'Preview changed canonical '+file);
   const identity=await select(frame().getByRole('heading',{name:fixture.heading}));
   const store=registry.store(project.id,{...session,operation:'mutate'}),before=registry.revision(project.id),changed='A source change on the nested route.';
   const transaction=patchText(store,identity,changed);check(transaction.success,'Text transaction rejected');project.history.record(transaction);check(registry.revision(project.id)!==before,'Source revision did not change');check(formatTransactionDiff(transaction).includes('+'+changed),'Diff does not contain real patch');
   await mount(fixture.route);await frame().getByRole('heading',{name:changed}).waitFor();check(await currentRoute()===fixture.route,'Source rebuild lost intended route');
   check(project.history.undo(registry.store(project.id,{...session,operation:'undo'})),'Undo rejected');await mount(fixture.route);await frame().getByRole('heading',{name:fixture.heading}).waitFor();
   check(project.history.redo(registry.store(project.id,{...session,operation:'redo'})),'Redo rejected');await mount(fixture.route);await frame().getByRole('heading',{name:changed}).waitFor();
   const mainIdentity=await select(frame().locator('main'));const style=patchStyle(store,mainIdentity,'padding','40px');check(style.success,'Style transaction rejected');project.history.record(style);
   await mount(fixture.route);check(await frame().locator('main').evaluate(e=>getComputedStyle(e).padding)==='40px','Style rebuild did not render actual source');
   // Observe selection geometry after scrolling and resize, without treating messages as writes.
   await select(frame().getByRole('heading',{name:changed}));await frame().evaluate(()=>scrollTo(0,80));await page.setViewportSize({width:1100,height:800});await page.waitForTimeout(150);
   const selected=await page.evaluate(()=>window.observations.filter(m=>m.type==='select').at(-1));const rect=await frame().getByRole('heading',{name:changed}).boundingBox();check(selected.element.rect.width>0&&rect.width>0,'Selection geometry lost');
   await page.screenshot({path:path.join(output,fixture.name+'-nested.png')});
   fs.writeFileSync(path.join(output,fixture.name+'-edited.zip'),await exportProjectZip(project));
   await mount(fixture.unknown);await frame().getByRole('heading',{name:fixture.unknownHeading}).waitFor();check(page.url()===editorOrigin+'/','Preview changed editor route');
   previews.stop(session.previewId);registry.revokeSession(project.id,session.previewId);await page.close();check(errors.length===0,'Uncaught application errors: '+errors.join(';'));
   results.push({fixture:fixture.name,classification:'authored fixture; dormant HTTP prototype QA, not editor acceptance',root:true,nested:true,parameters:true,queryAndAnchor:true,linkAndNavigate:true,backAndForward:true,directEntryAndRefresh:true,assets:true,unknownRoute:true,canonicalUnchangedOnOpen:true,sourceTextStyleDiffUndoRedo:true,routeAfterRebuild:true,geometry:true,export:true,parentStorageFetchWorkersDenied:true});
   console.log('PROTOTYPE QA PASS',fixture.name,'routes/assets/native History/source transactions/rebuild/export; production HTTP remains DISABLED');
  }
  fs.writeFileSync(path.join(output,'prototype-results.json'),JSON.stringify({browser:browser.version(),nativeChromiumSandbox:true,productionHttpEnabled:false,fullEditorNestedRouteAcceptance:false,results},null,2));
 }finally{if(browser)await browser.close();await previews.close();host.closeAllConnections();await new Promise(resolve=>host.close(resolve));fs.rmSync(runtimeFile,{force:true});fs.rmSync(job,{recursive:true,force:true})}
})().catch(error=>{console.error(error);process.exitCode=1});
