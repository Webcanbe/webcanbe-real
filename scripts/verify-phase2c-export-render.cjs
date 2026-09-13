// Standalone render QA for the two fixed authored fixture exports, after sandboxed builds.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.WCB_PLAYWRIGHT_MODULE||'playwright');
if(process.argv.length<5)throw Error('Usage: node scripts/verify-phase2c-export-render.cjs COAST_BUILD_JOB HARBOR_BUILD_JOB OUTPUT_DIR');
const output=path.resolve(process.argv[4]);fs.mkdirSync(output,{recursive:true});
const check=(value,message)=>{if(!value)throw Error(message)};
(async()=>{const browser=await chromium.launch({headless:true,chromiumSandbox:true});const reports=[];try{
 for(const fixture of [{name:'coast-paths',job:process.argv[2],entry:'/places/42?mode=quiet#details',next:'Next place',nextText:'PLACE 7',root:'/',rootHeading:'A coast worth exploring.'},{name:'harbor-desk',job:process.argv[3],entry:'/desk/projects/23?tab=notes#summary',next:'Next project',nextText:'Project 24',root:'/desk/',rootHeading:'A place for careful work.'}]){
  const job=path.resolve(fixture.job),result=JSON.parse(fs.readFileSync(path.join(job,'result.json')));check(result.status==='PASS','Export build did not pass');const dist=path.join(job,'project/dist'),files=new Map();
  for(const file of fs.readdirSync(dist,{recursive:true})){const absolute=path.join(dist,file);if(fs.statSync(absolute).isFile())files.set('/'+file,fs.readFileSync(absolute))}
  let origin;const server=http.createServer((req,res)=>{
   if(req.headers.host!==new URL(origin).host||req.method!=='GET'){res.writeHead(403);return res.end()}
   let name;try{name=decodeURIComponent(req.url.split('?')[0])}catch{res.writeHead(400);return res.end()}
   if(name.split('/').some(part=>part.startsWith('.'))||/[\\%]/.test(name)){res.writeHead(404);return res.end()}
   const requested=files.get(name),spa=!requested&&!path.extname(name)&&req.headers.accept?.includes('text/html');const body=requested||(spa?files.get('/index.html'):undefined);if(!body){res.writeHead(404,{'Content-Type':'text/plain'});return res.end('Missing resource')}
   const ext=requested?path.extname(name):'.html',type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'}[ext];res.writeHead(200,{'Content-Type':type||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body)
  });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  try{
   const response=await page.goto(origin+fixture.entry);check(response.headers()['content-type'].includes('text/html'),'Deep entry response type');await page.getByRole('heading',{name:'A source change on the nested route.'}).waitFor();
   check(await page.locator('[data-wcb-id]').count()===0,'Export has editor instrumentation');for(const img of await page.locator('img').all())check(await img.evaluate(e=>e.complete&&e.naturalWidth>0),'Standalone asset missing');check(await page.locator('main').evaluate(e=>getComputedStyle(e).padding)==='40px','Exported style missing');
   await page.getByRole('button',{name:fixture.next}).click();await page.getByText(fixture.nextText,{exact:true}).waitFor();await page.goBack();await page.getByRole('heading',{name:'A source change on the nested route.'}).waitFor();await page.reload();await page.getByRole('heading',{name:'A source change on the nested route.'}).waitFor();check(page.url()===origin+fixture.entry,'Standalone history/refresh lost path/query/hash');
   await page.screenshot({path:path.join(output,fixture.name+'-standalone-desktop.png')});await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,fixture.name+'-standalone-mobile.png')});
   await page.goto(origin+fixture.root);await page.getByRole('heading',{name:fixture.rootHeading}).waitFor();check(errors.length===0,'Standalone runtime errors: '+errors.join(';'));
   reports.push({fixture:fixture.name,standalone:true,root:true,nestedRouteQueryHash:true,nativeHistory:true,hardRefresh:true,publicAndImportedAssets:true,editedTextAndStyle:true,instrumentationAbsent:true,desktop:'1280x900',mobile:'390x844',runtimeErrors:errors});console.log('STANDALONE EXPORT PASS',fixture.name,'root/deep route/history/refresh/assets/edits; no editor coupling');
  }finally{await page.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
 }
 fs.writeFileSync(path.join(output,'standalone-results.json'),JSON.stringify({browser:browser.version(),nativeChromiumSandbox:true,reports},null,2));
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
