// Fixed synthetic verification program, NEVER selected by the editor API.
const fs=require('node:fs'),net=require('node:net'),dgram=require('node:dgram'),cp=require('node:child_process');
const {chromium}=require('/opt/wcb-runtime/node_modules/playwright-core');
let text='';process.stdin.on('data',v=>text+=v);process.stdin.on('end',()=>run(JSON.parse(text)).catch(e=>{console.error(e);process.exit(1)}));
async function run(config){
 if(config.hold){console.log('FROZEN_WORKER');process.kill(process.pid,'SIGSTOP');return}
 if(config.oom){const buffers=[];for(;;)buffers.push(Buffer.alloc(64*1024*1024,1));}
 if(config.tasks){const result=cp.spawnSync('/opt/wcb-runtime/socket-probe',['tasks'],{encoding:'utf8',timeout:5000});if(result.error||result.status!==0)throw Error('Task exhaustion boundary failed');console.log(result.stdout.trim());return}

 const denied=fn=>{try{fn();return false}catch{return true}};
 const raw={procRootEscapeDenied:denied(()=>fs.readFileSync('/proc/1/root/var/lib/wcb-runner/synthetic-canary')),traversalDenied:denied(()=>fs.readFileSync('/tmp/../../var/lib/wcb-runner/synthetic-canary')),secretAbsent:!process.env.WCB_SYNTHETIC_SECRET, filesystemEscapeDenied:denied(()=>fs.readFileSync('/var/lib/wcb-runner/synthetic-canary')), shellDenied:cp.spawnSync('/bin/sh',['-c','true']).error?.code==='ENOENT', outsideProcessDenied:denied(()=>process.kill(config.outsidePid,0)), systemWriteDenied:denied(()=>fs.writeFileSync('/opt/wcb-runtime/escape','synthetic')), hostHomeAbsent:!fs.existsSync('/Users'), vsock:cp.spawnSync('/opt/wcb-runtime/socket-probe',[],{encoding:'utf8'}).stdout?.trim(), net:fs.readlinkSync('/proc/self/ns/net'), pid:fs.readlinkSync('/proc/self/ns/pid'), interfaces:Object.keys(require('node:os').networkInterfaces()), noNewPrivs:/NoNewPrivs:\s+1/.test(fs.readFileSync('/proc/self/status','utf8'))};
 const child=cp.spawnSync('/usr/bin/node',['-e',"const fs=require('fs');console.log(JSON.stringify({net:fs.readlinkSync('/proc/self/ns/net'),pid:fs.readlinkSync('/proc/self/ns/pid'),vsock:require('child_process').spawnSync('/opt/wcb-runtime/socket-probe',[],{encoding:'utf8'}).stdout.trim()}))"],{encoding:'utf8'});raw.child=JSON.parse(child.stdout);
 await Promise.all(config.hosts.map(host=>new Promise(resolve=>{const s=net.createConnection({host,port:config.tcp},()=>s.end('raw-'+config.mode));s.on('error',()=>{});s.on('close',resolve);s.setTimeout(800,()=>s.destroy());})));
 for(const host of config.hosts){const s=dgram.createSocket(host.includes(':')?'udp6':'udp4');s.on('error',()=>{});await new Promise(resolve=>s.send('raw-'+config.mode,config.udp,host,()=>{s.close();resolve()}));}
// Test-only: remove the browser local-network gate in BOTH controls so it cannot mask OS enforcement.
 const resolver=new(require('node:dns').promises.Resolver)({timeout:300,tries:1});resolver.setServers([config.host+':'+config.dns]);try{await resolver.resolve4('synthetic.invalid')}catch{}
 const browser=await chromium.launch({executablePath:'/usr/lib/chromium/chromium',headless:true,chromiumSandbox:true,args:['--disable-features=LocalNetworkAccessChecks']});
 const page=await browser.newPage();raw.failures=[];page.on('requestfailed',req=>raw.failures.push({url:req.url(),error:req.failure()}));page.on('console',msg=>{if(msg.type()==='error')raw.failures.push({console:msg.text().slice(0,500)})});await page.goto('chrome://sandbox');raw.sandbox=await page.locator('body').innerText();
 const documentURL='http://'+config.host+':'+config.http+'/probe-document';
 await page.route(documentURL,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><h1>Synthetic probe</h1>'}));
 await page.goto(documentURL);
 // Only the synthetic document is delivered in memory, identically in both runs.
 // No CSP, sandbox attribute, Permissions Policy or interception of probe requests.
 const observations=await page.evaluate(async c=>{
  const result={}, endpoint=name=>'http://'+c.host+':'+c.http+'/'+c.mode+'/'+name;
  const controller=new AbortController();setTimeout(()=>controller.abort(),1500);
  await Promise.all([fetch(endpoint('fetch'),{mode:'no-cors',signal:controller.signal}).then(()=>result.fetch='resolved',()=>result.fetch='rejected'),new Promise(done=>{const ws=new WebSocket(endpoint('websocket').replace('http:','ws:'));ws.onerror=()=>done();setTimeout(()=>{ws.close();done()},500)}),new Promise(done=>{const es=new EventSource(endpoint('eventsource'));es.onerror=()=>{es.close();done()};setTimeout(()=>{es.close();done()},500)})]);
  const img=new Image();img.src=endpoint('image');document.body.append(img);navigator.sendBeacon(endpoint('beacon'),'synthetic');
  const peers=[];for(const [name,url] of [['stun','stun:'+c.host+':'+c.stun],['turn','turn:'+c.host+':'+c.turn+'?transport=udp'],['turnTcp','turn:'+c.host+':'+c.tcp+'?transport=tcp']]){const pc=new RTCPeerConnection({iceServers:[{urls:url,username:'synthetic',credential:'synthetic'}]});peers.push(pc);pc.createDataChannel(name);await pc.setLocalDescription(await pc.createOffer());result[name]='offer-created'}
  const pc=new RTCPeerConnection({iceServers:[]});peers.push(pc);pc.createDataChannel('remote');const offer=await pc.createOffer();await pc.setLocalDescription(offer);await pc.setRemoteDescription({type:'answer',sdp:offer.sdp.replace('a=setup:actpass','a=setup:active').replace(/a=ice-ufrag:[^\r\n]+/,'a=ice-ufrag:synthetic').replace(/a=ice-pwd:[^\r\n]+/,'a=ice-pwd:syntheticpassword1234567890')});await pc.addIceCandidate({candidate:'candidate:1 1 udp 2130706431 '+c.host+' '+c.ice+' typ host',sdpMid:'0',sdpMLineIndex:0});result.ice='accepted';
  await new Promise(r=>setTimeout(r,2000));for(const pc of peers)pc.close();return result;
 },config);
 await browser.close();console.log(JSON.stringify({raw,observations}));
}
