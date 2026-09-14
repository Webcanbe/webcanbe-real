// Run as root inside the dedicated VM. All collectors/canaries are synthetic.
const fs=require('node:fs'),http=require('node:http'),net=require('node:net'),dgram=require('node:dgram'),cp=require('node:child_process'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const records=[],servers=[];let mode='control',outside;
async function tcp(server){servers.push(server);await new Promise(r=>server.listen(0,'::',r));return server.address().port}
async function udp(name){const s=dgram.createSocket('udp6');servers.push(s);s.on('message',(b,info)=>records.push({mode,name,bytes:b.length,address:info.address}));await new Promise(r=>s.bind(0,'::',r));return s.address().port}
async function run(command,args,config){return new Promise((resolve,reject)=>{const p=cp.spawn(command,args,{env:{...process.env,WCB_SYNTHETIC_SECRET:'guest-outside-only'},stdio:['pipe','pipe','pipe']});let out='',err='';p.stdout.on('data',c=>out+=c);p.stderr.on('data',c=>err=(err+c).slice(-10000));p.on('error',reject);p.on('exit',code=>{if(code!==0)reject(Error(err||out));else{try{resolve(JSON.parse(out.trim()))}catch{reject(Error(out+err))}}});p.stdin.end(JSON.stringify(config));});}
(async()=>{
 fs.mkdirSync('/var/lib/wcb-runner',{recursive:true});fs.writeFileSync('/var/lib/wcb-runner/synthetic-canary','not-a-platform-secret',{mode:0o644});
 const httpServer=http.createServer((req,res)=>{records.push({mode,name:req.url.split('/').at(-1)});res.writeHead(200,{'Access-Control-Allow-Origin':'*','Content-Type':'text/plain'});res.end('synthetic')});httpServer.on('upgrade',(req,s)=>{records.push({mode,name:'websocket'});s.destroy()});
 const host=Object.values(require('os').networkInterfaces()).flat().find(v=>v.family==='IPv4'&&!v.internal).address;
 outside=cp.spawn('/usr/sbin/runuser',['-u','wcb-runner','--','node','-e','console.log(process.pid);setInterval(()=>{},1000)']);
 const outsidePid=await new Promise(r=>outside.stdout.once('data',v=>r(Number(v.toString().trim()))));
 const config={mode,host,hosts:[host,'127.0.0.1','::1'],outsidePid,http:await tcp(httpServer),tcp:await tcp(net.createServer(s=>{records.push({mode,name:'tcp',address:s.remoteAddress});s.on('error',()=>{});s.on('data',()=>{});s.end()})),udp:await udp('raw-udp'),stun:await udp('stun'),turn:await udp('turn'),ice:await udp('ice'),dns:await udp('dns')};
 const control=await run('/usr/sbin/runuser',['-u','wcb-runner','--','/usr/bin/node','/opt/wcb-runtime/probe.cjs'],config);
 assert.equal(control.raw.filesystemEscapeDenied,false);assert.equal(control.raw.shellDenied,false);assert.equal(control.raw.outsideProcessDenied,false);assert.equal(control.raw.secretAbsent,false);assert.equal(control.raw.vsock,'VSOCK_ALLOWED');
 for(const name of ['fetch','websocket','eventsource','image','beacon','stun','turn','ice','tcp','raw-udp','dns'])assert(records.some(r=>r.mode==='control'&&r.name===name),'Missing positive collector: '+name);
 assert(records.some(r=>r.name==='tcp'&&r.address==='::1'));assert(records.some(r=>r.name==='raw-udp'&&r.address==='::1'));
 mode='isolated';const generation=randomUUID();const isolated=await run('/opt/wcb-runtime/launch.sh',[generation,'proof'],{...config,mode});
 assert.equal(records.filter(r=>r.mode==='isolated').length,0,'Outer network denial failed');
 for(const name of ['secretAbsent','filesystemEscapeDenied','shellDenied','outsideProcessDenied','systemWriteDenied','hostHomeAbsent','noNewPrivs','procRootEscapeDenied','traversalDenied'])assert.equal(isolated.raw[name],true,name);
 assert.equal(isolated.raw.child.net,isolated.raw.net);assert.equal(isolated.raw.child.pid,isolated.raw.pid);assert.match(isolated.raw.child.vsock,/VSOCK_DENIED:/);
 assert.match(isolated.raw.vsock,/VSOCK_DENIED:/);assert.notEqual(isolated.raw.net,control.raw.net);assert.notEqual(isolated.raw.pid,control.raw.pid);assert.deepEqual(isolated.raw.interfaces,['lo']);
 assert.match(isolated.raw.sandbox,/Layer 1 Sandbox\s+Namespace/);assert.match(isolated.raw.sandbox,/Seccomp-BPF sandbox\s+Yes/);assert.equal(isolated.observations.fetch,'rejected');
 cp.execFileSync('/opt/wcb-runtime/stop.sh',[generation]);
 // Tombstones prevent delayed or reused launch after a completed revoke.
 const retry=cp.spawnSync('/opt/wcb-runtime/launch.sh',[generation,'proof'],{input:JSON.stringify({...config,mode:'reuse'}),timeout:4000});assert.notEqual(retry.status,0,'Revoked generation restarted');
 const watchdogGeneration=randomUUID(), started=Date.now();
 const frozen=cp.spawn('/opt/wcb-runtime/launch.sh',[watchdogGeneration,'proof'],{stdio:['pipe','pipe','pipe']});let stderr='';frozen.stderr.on('data',v=>stderr=(stderr+v).slice(-2000));frozen.stdin.end(JSON.stringify({hold:true}));
 const frozenExit=new Promise(r=>frozen.on('exit',(code,signal)=>r({code,signal})));
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Frozen worker failed to start')),5000);frozen.stdout.once('data',()=>{clearTimeout(timer);resolve()})});
 const resourceProperties=cp.execFileSync('systemctl',['show','wcb-preview-'+watchdogGeneration+'.service','--property=MemoryMax,MemorySwapMax,CPUQuotaPerSecUSec,TasksMax,RuntimeMaxUSec,NoNewPrivileges,KillMode,RestrictAddressFamilies'],{encoding:'utf8'});
 assert.match(resourceProperties,/MemoryMax=1610612736/);assert.match(resourceProperties,/MemorySwapMax=0/);assert.match(resourceProperties,/TasksMax=192/);assert.match(resourceProperties,/RuntimeMaxUSec=1min 5s/);assert.match(resourceProperties,/NoNewPrivileges=yes/);assert(!resourceProperties.includes('AF_VSOCK'));
 const timeoutResult=await frozenExit,elapsed=Date.now()-started;assert.notEqual(timeoutResult.code,0);assert(elapsed>=60000&&elapsed<75000,'Outer deadline did not bound frozen process');cp.execFileSync('/opt/wcb-runtime/stop.sh',[watchdogGeneration]);
 const oomGeneration=randomUUID(),oom=cp.spawnSync('/opt/wcb-runtime/launch.sh',[oomGeneration,'proof'],{input:JSON.stringify({oom:true}),timeout:15000});assert(oom.status!==0&&!oom.error,'Memory allocation was not bounded');cp.execFileSync('/opt/wcb-runtime/stop.sh',[oomGeneration]);
 const taskGeneration=randomUUID(),tasks=await run('/opt/wcb-runtime/launch.sh',[taskGeneration,'proof'],{tasks:true});
 assert.equal(tasks.limitDenied,true);assert(tasks.spawned>0&&tasks.spawned<192);assert.equal(tasks.childrenReaped,true);cp.execFileSync('/opt/wcb-runtime/stop.sh',[taskGeneration]);
 console.log(JSON.stringify({result:'PASS',taskExhaustion:tasks,resourceProperties,frozenWorkerKilledAfterMs:elapsed,memoryExhaustionKilled:true,boundary:'Linux namespaces + systemd cgroup inside no-mount Lima VM',control,isolated,records,revokedGenerationDenied:true},null,2));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{outside?.kill('SIGTERM');for(const server of servers){server.closeAllConnections?.();server.close()}fs.rmSync('/var/lib/wcb-runner/synthetic-canary',{force:true})});
