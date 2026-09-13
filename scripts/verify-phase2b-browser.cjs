const fs=require('fs'),path=require('path');
const {chromium}=require(process.env.WCB_PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(__dirname,'..');
const artifacts=path.resolve(process.argv[2]||'');
const devLog=process.argv[3],origin=process.argv[4]||'http://127.0.0.1:5181';
if(!process.argv[2]||!devLog||!/^http:\/\/(127\.0\.0\.1|localhost):[0-9]+$/.test(origin))throw Error('Usage: node scripts/verify-phase2b-browser.cjs ARTIFACTS_DIR DEV_LOG [LOOPBACK_ORIGIN]');
fs.mkdirSync(artifacts,{recursive:true});
const check=(condition,message)=>{if(!condition)throw Error(message)};
(async()=>{
 const {ZipFile}=require('yazl');
 for(const name of ['trail-atlas','studio-ledger']){const directory=path.join(root,'fixtures',name),zip=new ZipFile();for(const file of fs.readdirSync(directory,{recursive:true})){const absolute=path.join(directory,file);if(fs.statSync(absolute).isFile()&&!file.split(path.sep).includes('node_modules'))zip.addBuffer(fs.readFileSync(absolute),file.split(path.sep).join('/'))}const output=fs.createWriteStream(path.join(artifacts,name+'.zip'));const done=new Promise((resolve,reject)=>{output.on('close',resolve);output.on('error',reject);zip.outputStream.on('error',reject)});zip.outputStream.pipe(output);zip.end();await done;}
 const browser=await chromium.launch({headless:true,chromiumSandbox:true});
 for(const fixture of [{name:'trail-atlas',heading:'A good day begins with a trail.',route:'Field guides',routeHeading:'Pack light. Notice more.',back:'Discover',source:'src/pages/Home.jsx',style:'css-module'}, {name:'studio-ledger',heading:'Make space for focused work.',route:'Archive',routeHeading:'Good work, carefully kept.',back:'This week',source:'src/pages/Dashboard.tsx',style:'tailwind'}]) {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/workspace/northstar');
  check(await page.title()==='WebCanBe','Wrong editor page');await page.getByLabel('Local editor access key').waitFor();
  const access=[...fs.readFileSync(devLog,'utf8').matchAll(/key \(this server run only\): (\S+)/g)].at(-1)[1];
  await page.getByLabel('Local editor access key').fill(access);await page.getByRole('button',{name:'Connect / renew session'}).click();
  await page.waitForFunction(()=>document.querySelector('iframe')?.src.startsWith('blob:'));
  await page.locator('input[type=file]').setInputFiles(artifacts+'/'+fixture.name+'.zip');await page.waitForURL(/workspace\/[a-f0-9-]{36}$/);
  const projectRoot=path.join(process.env.WCB_QA_REGISTRY_ROOT || root,'.webcanbe/projects',page.url().split('/').at(-1));const frame=page.frameLocator('iframe');
  async function history(action) {const previous=await page.locator('iframe').getAttribute('src');const resultPromise=page.waitForResponse(response=>response.url().endsWith('/'+action.toLowerCase()));await page.getByRole('button',{name:action,exact:true}).click();const result=await resultPromise;check(result.ok(),'History refused: '+await result.text());await page.waitForFunction(previous=>document.querySelector('iframe')?.src.startsWith('blob:')&&document.querySelector('iframe')?.src!==previous,previous);}

  try {await frame.getByRole('heading',{name:fixture.heading}).waitFor({timeout:10000})} catch(error){console.log('FAILED_RENDER',fixture.name,await page.locator('.transaction-status').innerText(),errors);throw error}
  check(await frame.locator('body').evaluate(()=>{try{void parent.document.body;return false}catch{return true}}),'Preview lost opaque isolation');
  check(await frame.locator('body').evaluate(async origin=>{try{await fetch(origin+'/__webcanbe/api/projects',{method:'POST',body:'{}'});return false}catch{return true}},origin),'Preview API fetch restriction failed');
  check(!(await frame.locator('html').evaluate(node=>node.outerHTML)).includes(access),'Operator key leaked into preview');
  check(await frame.locator('img').first().evaluate(img=>img.complete&&img.naturalWidth>0),'Local asset failed');
  check(await page.locator('vite-error-overlay').count()===0,'Framework error overlay');
  await frame.getByRole('heading',{name:fixture.heading}).click();await page.locator('.inspector-control textarea').waitFor();
  check((await page.locator('[data-preview-boundary]').innerText()).includes('CSP does not block all browser egress'),'Preview security qualification missing');
  await page.getByRole('button',{name:'Interact with preview'}).click();await frame.getByRole('link',{name:fixture.route,exact:true}).click();await frame.getByRole('heading',{name:fixture.routeHeading}).waitFor();
  await page.locator('.source-location').waitFor({state:'detached'});
  check(await page.locator('.inspector-control textarea').count()===0,'HashRouter kept an old source inspector');
  await frame.locator('body').evaluate(()=>{dispatchEvent(new Event('scroll'));dispatchEvent(new Event('resize'))});
  await page.waitForTimeout(180);check(await page.locator('.canvas-outline').count()===0,'HashRouter resurrected stale geometry after scroll/resize');
  await frame.getByRole('link',{name:fixture.back,exact:true}).click();await frame.getByRole('heading',{name:fixture.heading}).waitFor();
  await page.getByRole('button',{name:'Select elements',exact:true}).click();
  const sourceFile=path.join(projectRoot,fixture.source),original=fs.readFileSync(sourceFile,'utf8'),changed='A careful update to '+fixture.name+'.';
  await frame.getByRole('heading',{name:fixture.heading}).click();await page.locator('.inspector-control textarea').fill(changed);await page.getByRole('button',{name:'Apply text change'}).click();await frame.getByRole('heading',{name:changed}).waitFor();
  check(fs.readFileSync(sourceFile,'utf8').includes(changed),'Actual source did not change');check((await page.locator('.source-diff').last().innerText()).includes('+'+changed),'Diff missing actual text');
  await history('Undo');await frame.getByRole('heading',{name:fixture.heading}).waitFor();check(fs.readFileSync(sourceFile,'utf8')===original,'Undo source mismatch');
  await history('Redo');await frame.getByRole('heading',{name:changed}).waitFor();
  // Reopen editor and reconnect: the source edit survives a full browser reload.
  await page.reload();await page.getByLabel('Local editor access key').fill(access);await page.getByRole('button',{name:'Connect / renew session'}).click();await frame.getByRole('heading',{name:changed}).waitFor();
  await frame.locator('main').click({position:{x:4,y:4}});const input=page.locator('input[data-wcb-property=padding]');await input.fill('40px');
  const responsePromise=page.waitForResponse(response=>response.url().endsWith('/mutate'));const navigation=page.waitForEvent('framenavigated',{predicate:frame=>frame.parentFrame()!==null});await input.locator('..').getByRole('button',{name:'Save',exact:true}).click();const response=await responsePromise;check(response.ok(),'Style mutation refused: '+await response.text());await navigation;await frame.getByRole('heading',{name:changed}).waitFor();
  if(fixture.style==='css-module')check(fs.readFileSync(path.join(projectRoot,'src/pages/Home.module.css'),'utf8').includes('padding: 40px'),'CSS module edit missing');
  else check(fs.readFileSync(sourceFile,'utf8').includes("'p-10 md:p-8 lg:p-10'"),'clsx Tailwind edit missing');
  await history('Undo');await frame.getByRole('heading',{name:changed}).waitFor();
  await history('Redo');await frame.getByRole('heading',{name:changed}).waitFor();
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export code',exact:true}).click();await (await downloadPromise).saveAs(artifacts+'/'+fixture.name+'-edited.zip');
  await page.screenshot({path:artifacts+'/'+fixture.name+'-verified.png'});
  check(errors.length===0,'Runtime errors: '+errors.join('\n'));
  console.log('PASS',fixture.name,'import/profile/assets/routes/source/text/style/diff/reload/undo/redo/export',projectRoot);
  await page.close();
 }
 await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
