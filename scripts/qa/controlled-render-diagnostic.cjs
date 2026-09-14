// Operator-only diagnostic launcher. Exact retained OS policy, separate TEST script.
// Never exposed through the gateway; cannot change ordinary capture acceptance.
const fs=require('node:fs'),path=require('node:path'),{spawn,execFileSync}=require('node:child_process'),{randomUUID,createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../..'),state=path.join(root,'.webcanbe/runner/qa-common-applications'),name=process.argv[2];
if(!['zustand','kanban-refresh','kanban-board','GroqRecipeBook','kanban-export','zustand-export','recipe-export'].includes(name))throw Error('Unknown fixed diagnostic subject');
const input=JSON.parse(fs.readFileSync(path.join(state,'hosted',name+'-artifact.json'))),generation=randomUUID(),snapshot={...input,digest:createHash('sha256').update(JSON.stringify(input)).digest('hex')};
const env={...process.env,LIMA_HOME:path.join(root,'.webcanbe/runner/lima')},lima=path.join(root,'.webcanbe/runner/tools/bin/limactl');
const run=args=>execFileSync(lima,args,{env,stdio:'pipe',timeout:15000});
const worker=path.join(__dirname,'render-diagnostic-worker.cjs'),launcher=path.join(state,'diagnostic-launch.sh');
// Copy a fixed TEST launcher; the original worker and launch policy are never edited.
fs.writeFileSync(launcher,fs.readFileSync(path.join(root,'scripts/runner/launch.sh'),'utf8').replace('entry=worker.cjs','entry=common-render-diagnostic.cjs'),{mode:0o700});
for(const[from,to,mode]of [[worker,'common-render-diagnostic.cjs','644'],[launcher,'common-render-diagnostic.sh','755']]){run(['copy',from,'wcb:/tmp/'+to]);run(['shell','--workdir=/','wcb','sudo','-n','install','-m',mode,'/tmp/'+to,'/opt/wcb-runtime/'+to]);run(['shell','--workdir=/','wcb','rm','-f','/tmp/'+to]);}
const child=spawn(lima,['shell','--workdir=/','wcb','sudo','-n','/opt/wcb-runtime/common-render-diagnostic.sh',generation],{env,stdio:['pipe','pipe','pipe']});let output='',errors='',samples=[];
child.stdout.on('data',d=>{output+=d;if(output.length>16*1024*1024)child.kill('SIGKILL')});child.stderr.on('data',d=>errors=(errors+d).slice(-1500));
const timer=setTimeout(()=>child.kill('SIGKILL'),55000),sampler=setInterval(()=>{try{samples.push(run(['shell','--workdir=/','wcb','systemctl','show','wcb-preview-'+generation,'-p','MemoryCurrent','-p','MemoryPeak','-p','CPUUsageNSec','-p','TasksCurrent','-p','Result','-p','CPUQuotaPerSecUSec']).toString().trim())}catch{}},500);
child.stdin.end(JSON.stringify({generation,origin:'http://wcb-'+generation+'.preview.invalid',snapshot,scenario:name})+'\n');
child.on('exit',code=>{clearTimeout(timer);clearInterval(sampler);let result;try{result=JSON.parse(output.trim())}catch{result={error:'Diagnostic process failed',exitCode:code,stderr:errors}}
 for(const key of ['ordinaryPng','rawPng','extendedPng'])if(result[key]){fs.writeFileSync(path.join(state,name+'-'+key+'.png'),Buffer.from(result[key],'base64'));result[key]={sha256:createHash('sha256').update(Buffer.from(result[key],'base64')).digest('hex')}}
 for(const entry of result.exportViewports||[])if(entry.png){const b=Buffer.from(entry.png,'base64');fs.writeFileSync(path.join(state,name+'-'+entry.width+'.png'),b);entry.png={sha256:createHash('sha256').update(b).digest('hex')}}
 result.resources=samples;result.boundary='Separate diagnostic only: unchanged 4000ms ordinary capture, bounded 15000ms observation, retained namespace/native sandbox/default egress denial';
 try{run(['shell','--workdir=/','wcb','sudo','-n','/opt/wcb-runtime/stop.sh',generation]);result.cleanupVerified=true}catch{result.cleanupVerified=false}
 fs.writeFileSync(path.join(state,name+'-diagnostic.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
});
