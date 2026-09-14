// Local TLS/mTLS validation only. Does not create production PKI, DNS or accounts.
const fs=require('node:fs'),path=require('node:path'),net=require('node:net');
const {spawn,execFileSync}=require('node:child_process'),{Pool}=require('pg');
const root=path.resolve(__dirname,'../..'),state=path.join(root,'.webcanbe/runner/qa-phase2g2'),pki=path.join(state,'test-pki');
fs.mkdirSync(pki,{recursive:true,mode:0o700});
const run=(exe,args,options={})=>execFileSync(exe,args,{stdio:'ignore',...options});
run('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=WebCanBe LOCAL TEST CA','-keyout',path.join(pki,'ca-key.pem'),'-out',path.join(pki,'ca.pem')]);
for(const name of ['gateway','controller']) {
 run('openssl',['req','-new','-newkey','rsa:2048','-nodes','-subj',`/CN=${name==='gateway'?'localhost':'WebCanBe LOCAL TEST controller'}`,'-keyout',path.join(pki,name+'-key.pem'),'-out',path.join(pki,name+'.csr')]);
 fs.writeFileSync(path.join(pki,name+'.ext'),`subjectAltName=DNS:localhost\nextendedKeyUsage=${name==='gateway'?'serverAuth':'clientAuth'}\n`);
 run('openssl',['x509','-req','-in',path.join(pki,name+'.csr'),'-CA',path.join(pki,'ca.pem'),'-CAkey',path.join(pki,'ca-key.pem'),'-CAcreateserial','-days','1','-extfile',path.join(pki,name+'.ext'),'-out',path.join(pki,name+'.pem')]);
}
const env={...process.env,LIMA_HOME:path.join(root,'.webcanbe/runner/lima')};
const lima=args=>run(path.join(root,'.webcanbe/runner/tools/bin/limactl'),args,{env});
(async()=>{
 const config=JSON.parse(fs.readFileSync(path.join(state,'postgres.json'))),schema='wcb_gateway_qa';
 const pool=new Pool(config);await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);await pool.end();
 const db=new Pool({...config,options:`-c search_path=${schema}`});await db.query(fs.readFileSync(path.join(root,'deployment/hosted/postgres.sql'),'utf8'));await db.end();
 const guest='/opt/wcb-control-qa';
 lima(['shell','--workdir=/','wcb','sudo','-n','mkdir','-p',guest]);
 // A dedicated unprivileged control service with only fixed root entrypoints.
 lima(['shell','--workdir=/','wcb','sudo','-n','sh','-c','id wcb-controller >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin wcb-controller']);
 const sudoers=path.join(state,'sudoers-qa');fs.writeFileSync(sudoers,'wcb-controller ALL=(root) NOPASSWD: /opt/wcb-runtime/launch.sh *, /opt/wcb-runtime/stop.sh *\n',{mode:0o600});
 lima(['copy',sudoers,'wcb:/tmp/wcb-sudoers-qa']);lima(['shell','--workdir=/','wcb','sudo','-n','install','-m','440','/tmp/wcb-sudoers-qa','/etc/sudoers.d/wcb-controller-qa']);
 const gatewayConfig={hostId:'local-test-host',listenAddress:'127.0.0.1',port:9443,localTest:true,key:guest+'/gateway-key.pem',cert:guest+'/gateway.pem',ca:guest+'/ca.pem',postgres:{...config,port:5432,options:`-c search_path=${schema}`}};
 fs.writeFileSync(path.join(state,'gateway.json'),JSON.stringify(gatewayConfig),{mode:0o600});
 for(const [from,name] of [[path.join(root,'.webcanbe/hosted-package/gateway.cjs'),'gateway.cjs'],[path.join(state,'gateway.json'),'gateway.json'],...['ca.pem','gateway.pem','gateway-key.pem'].map(name=>[path.join(pki,name),name])]) {
  lima(['copy',from,'wcb:/tmp/wcb-qa-'+name]);lima(['shell','--workdir=/','wcb','sudo','-n','install','-o','wcb-controller','-m','600','/tmp/wcb-qa-'+name,guest+'/'+name]);lima(['shell','--workdir=/','wcb','rm','-f','/tmp/wcb-qa-'+name]);
 }
 try{lima(['shell','--workdir=/','wcb','sudo','-n','systemctl','stop','wcb-qa-gateway'])}catch{}
 lima(['shell','--workdir=/','wcb','sudo','-n','systemd-run','--unit=wcb-qa-gateway','--collect','--property=User=wcb-controller','--property=MemoryMax=512M','--property=TasksMax=64','/usr/bin/node',guest+'/gateway.cjs',guest+'/gateway.json']);
 const listener=net.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
 const ssh=spawn('/usr/bin/ssh',['-F',path.join(root,'.webcanbe/runner/lima/wcb/ssh.config'),'-S','none','-o','ExitOnForwardFailure=yes','-N','-L',`127.0.0.1:${port}:127.0.0.1:9443`,'lima-wcb'],{stdio:'ignore'});
 ssh.on('error',()=>process.exit(1));ssh.on('exit',code=>process.exit(code||0));
 const client={postgres:{...config,options:`-c search_path=${schema}`},host:{id:'local-test-host',origin:`https://localhost:${port}`,ca:fs.readFileSync(path.join(pki,'ca.pem'),'utf8'),cert:fs.readFileSync(path.join(pki,'controller.pem'),'utf8'),key:fs.readFileSync(path.join(pki,'controller-key.pem'),'utf8')}};
 fs.writeFileSync(path.join(state,'gateway-client.json'),JSON.stringify(client),{mode:0o600});
 console.log('Local TEST mTLS gateway is running in the existing Lima VM. No deployed-hosted evidence is implied.');
 const close=()=>{ssh.kill('SIGTERM');try{lima(['shell','--workdir=/','wcb','sudo','-n','systemctl','stop','wcb-qa-gateway'])}catch{}fs.rmSync(path.join(state,'gateway-client.json'),{force:true})};process.on('SIGTERM',close);process.on('SIGINT',close);
})().catch(()=>{console.error('Local gateway preparation failed; inspect private local service state.');process.exit(1)});
