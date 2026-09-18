// Security experiment with synthetic data and loopback collectors only.
// Exit 2 means the browser policy is NOT sufficient for imported HTTP admission.
const http=require('node:http'),dgram=require('node:dgram'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.WCB_PLAYWRIGHT_MODULE || 'playwright');
const servers=[];async function listen(handler){const server=http.createServer(handler);servers.push(server);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return 'http://127.0.0.1:'+server.address().port}
(async()=>{
 const output=process.argv[2];if(!output)throw Error('Usage: node scripts/verify-phase2c-policy.cjs OUTPUT_DIRECTORY');fs.mkdirSync(output,{recursive:true});
 const packets=[],udp=dgram.createSocket('udp4');udp.on('message',()=>packets.push('synthetic STUN packet'));await new Promise(resolve=>udp.bind(0,'127.0.0.1',resolve));
 const received=[];const collector=await listen((req,res)=>{received.push(req.url);res.writeHead(200,{'Content-Type':'text/html'});res.end('<p>Controlled collector</p>')});
 const policy="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none';";
 const preview=await listen((req,res)=>{res.writeHead(200,{'Content-Type':'text/html','Content-Security-Policy':policy+(req.url.includes('rtc-probe')?" webrtc 'block';":''),'Cache-Control':'no-store','X-DNS-Prefetch-Control':'off'});res.end('<!doctype html><h1>Native HTTP policy probe</h1><script>window.probeReady=true;</script>')});
 const editor=await listen((req,res)=>{res.writeHead(200,{'Content-Type':'text/html',...(req.url==='/restricted'?{'Content-Security-Policy':'frame-src '+preview+';'}:{})});res.end('<h1>Trusted editor synthetic canary</h1>')});
 let browser;
 try{
  browser=await chromium.launch({headless:true,chromiumSandbox:true});const page=await browser.newPage();const warnings=[];page.on('console',m=>{if(m.text().includes('Unrecognized Content-Security-Policy'))warnings.push(m.text())});
  // This guard contains the experiment; it is not presented as a WebRTC firewall.
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const results=[];
  for(const mode of ['opaque-http','origin-http','parent-csp-http','opaque-envelope-http','blob-baseline']){
   await page.goto(editor+(mode==='parent-csp-http'?'/restricted':'/'));const editorURL=page.url();
   await page.evaluate(({mode,preview,policy})=>{
    const outer=document.createElement('iframe');outer.sandbox=mode==='origin-http'?'allow-scripts allow-same-origin':'allow-scripts';
    if(mode==='opaque-envelope-http')outer.src=URL.createObjectURL(new Blob(['<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; frame-src '+preview+';"><iframe sandbox="allow-scripts" src="'+preview+'/"></iframe>'],{type:'text/html'}));
    else if(mode==='blob-baseline')outer.src=URL.createObjectURL(new Blob(['<!doctype html><meta http-equiv="Content-Security-Policy" content="'+policy+'"><h1>Blob probe</h1><script>window.probeReady=true;</script>'],{type:'text/html'}));
    else outer.src=preview+'/';document.body.append(outer);
   },{mode,preview,policy});
   const matches=f=>mode==='blob-baseline'?f.url().startsWith('blob:'):f.url().startsWith(preview);
   const frame=page.frames().find(matches)||await page.waitForEvent('framenavigated',{predicate:matches});await frame.waitForFunction(()=>window.probeReady===true);
   const result=await frame.evaluate(async collector=>{
    const attempt=fn=>{try{return{allowed:true,value:fn()}}catch(error){return{allowed:false,error:error.name}}};
    const push=attempt(()=>{history.pushState({native:true},'', '/nested/42?q=one#anchor');return location.pathname+location.search+location.hash});
    const replace=attempt(()=>{history.replaceState({native:true},'', '/nested/43?q=two#anchor');return location.pathname+location.search+location.hash});
    const parentDOM=attempt(()=>parent.document.body.textContent),storage=attempt(()=>{localStorage.setItem('synthetic','probe');return true});
    let fetchBlocked=false;try{await fetch(collector+'/fetch')}catch{fetchBlocked=true}
    const topNavigation=attempt(()=>{top.location.href=collector+'/top'});
    return{origin:self.origin,push,replace,parentDOM,storage,fetchBlocked,topNavigation};
   },collector);
   const before=received.length;await frame.evaluate(collector=>{location.href=collector+'/self?canary=synthetic-only'},collector);await page.waitForTimeout(200);
   results.push({mode,...result,selfNavigationRequests:received.slice(before),editorRouteUnchanged:page.url()===editorURL});
  }
  await page.goto(editor);await page.evaluate(preview=>{const f=document.createElement('iframe');f.sandbox='allow-scripts';f.src=preview+'/rtc-probe';document.body.append(f)},preview);
  const rtcFrame=page.frames().find(f=>f.url().startsWith(preview))||await page.waitForEvent('framenavigated',{predicate:f=>f.url().startsWith(preview)});await rtcFrame.waitForFunction(()=>window.probeReady===true);
  const rtc=await rtcFrame.evaluate(async port=>{try{const pc=new RTCPeerConnection({iceServers:[{urls:'stun:127.0.0.1:'+port}]});window.probePC=pc;pc.createDataChannel('synthetic');await pc.setLocalDescription(await pc.createOffer());return{origin:self.origin,created:true}}catch(error){return{created:false,error:error.name}}},udp.address().port);
  await page.waitForTimeout(1500);await rtcFrame.evaluate(()=>window.probePC?.close());
  const report={browser:browser.version(),nativeChromiumSandbox:true,syntheticLoopbackOnly:true,results,webrtc:{...rtc,receivedUdpPackets:packets.length,warnings},httpAdmissionSafe:false,rtcEgressObserved:packets.length>0};
  fs.writeFileSync(path.join(output,'policy-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  // A quiet STUN collector cannot certify all browser egress or admit HTTP.
  process.exitCode=2;
 }finally{if(browser)await browser.close();udp.close();for(const server of servers){server.closeAllConnections();server.close()}}
})().catch(error=>{console.error(error);process.exitCode=1});
