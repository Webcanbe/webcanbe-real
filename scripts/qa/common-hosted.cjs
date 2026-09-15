// Independent QA helper; does not import, alter or replace any existing test.
// Starts the actual packaged TLS editor against the existing TEST PG/mTLS gateway.
const fs=require('node:fs'),path=require('node:path'),https=require('node:https');
const {randomUUID,createHash}=require('node:crypto'),{spawn,execFileSync}=require('node:child_process');
const {Pool}=require('pg'),{build}=require('esbuild');
const root=path.resolve(__dirname,'../..'),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
exports.setup=async(options={})=>{
 const dir=path.join(root,'.webcanbe/runner/qa-common-applications/hosted');fs.mkdirSync(dir,{recursive:true,mode:0o700});
 const bundle=path.join(dir,'trusted-api.cjs');await build({stdin:{contents:['postgresStores','postgresIdentity','runtimeCompatibility','projectRegistry','isolatedPreview','controlledPreview','localLimaRunner'].map(n=>`export * from './src/webcanbe-engine/runtime/${n}';`).join('\n')+'\nexport {MutationHistory} from "./src/webcanbe-engine/mutations/sourceMutations";',resolveDir:root},bundle:true,platform:'node',format:'cjs',packages:'external',outfile:bundle,logLevel:'silent'});
 const engine=require(bundle),{generateKeyPair,exportJWK,SignJWT}=await import('jose');
 const config=JSON.parse(fs.readFileSync(path.join(root,'.webcanbe/runner/qa-phase2g2/gateway-client.json'))),pool=new Pool(config.postgres);
 await pool.query(fs.readFileSync(path.join(root,'deployment/hosted/postgres.sql'),'utf8'));
 const access=new engine.PostgresAccess(pool),identities=new engine.PostgresIdentityStore(pool);
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,DNS:app.wcb-app.test,DNS:viewer.wcb-preview.test','-keyout',path.join(dir,'key.pem'),'-out',path.join(dir,'cert.pem')],{stdio:'ignore'});
 const ca=fs.readFileSync(path.join(dir,'cert.pem'),'utf8'),key=fs.readFileSync(path.join(dir,'key.pem'),'utf8'),keys=await generateKeyPair('RS256'),jwk={...await exportJWK(keys.publicKey),kid:'common-test',alg:'RS256'},codes=new Map();let issuer,child,origin;
 const idp=https.createServer({key,cert:ca},async(req,res)=>{
  if(req.url==='/jwks'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({keys:[jwk]}));return}
  let text='';for await(const c of req)text+=c;
  const params=new URLSearchParams(text),record=codes.get(params.get('code'));codes.delete(params.get('code'));
  if(!record||createHash('sha256').update(params.get('code_verifier')||'').digest('base64url')!==record.challenge){res.writeHead(403);res.end();return}
  const now=Math.floor(Date.now()/1000),token=await new SignJWT({iss:issuer,sub:record.subject,aud:'common-test-client',iat:now,exp:now+120,nonce:record.nonce}).setProtectedHeader({alg:'RS256',kid:'common-test'}).sign(keys.privateKey);
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({id_token:token}));
 });
 await new Promise(r=>idp.listen(0,'127.0.0.1',r));issuer=`https://localhost:${idp.address().port}`;
 const portProbe=https.createServer();await new Promise(r=>portProbe.listen(0,'127.0.0.1',r));const port=portProbe.address().port;await new Promise(r=>portProbe.close(r));origin=`https://app.wcb-app.test:${port}`;
 const host={...config.host};for(const name of ['ca','cert','key']){const file=path.join(dir,'gateway-'+name+'.pem');fs.writeFileSync(file,host[name],{mode:0o600});host[name]=file}
 const settings={applicationRoot:root,localTest:true,listenAddress:'127.0.0.1',port,key:path.join(dir,'key.pem'),cert:path.join(dir,'cert.pem'),postgres:config.postgres,origins:{editorOrigin:origin,viewerOrigin:`https://viewer.wcb-preview.test:${port}`,editorSite:'wcb-app.test',viewerSite:'wcb-preview.test'},oidc:{issuer,authorizationEndpoint:issuer+'/authorize',tokenEndpoint:issuer+'/token',jwksUri:issuer+'/jwks',clientId:'common-test-client',redirectUri:origin+'/__webcanbe/auth/callback',ca},hosts:[host],fastRefresh:true,publicStaticAssets:options.publicStaticAssets===true,publicGitHubSourceIntake:options.publicGitHubSourceIntake===true};
 fs.writeFileSync(path.join(dir,'editor-config.json'),JSON.stringify(settings),{mode:0o600});
 async function launch(){child=spawn(process.execPath,[path.join(root,'.webcanbe/hosted-package/editor.cjs'),path.join(dir,'editor-config.json')],{cwd:root,stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Packaged editor startup timeout')),15000);child.stdout.on('data',d=>{if(String(d).includes('Hosted editor TLS listener started.')){clearTimeout(timer);resolve()}});child.once('exit',()=>{clearTimeout(timer);reject(Error('Packaged editor exited'))});child.stderr.on('data',()=>{});});}
 async function shutdown(signal='SIGTERM'){if(child&&child.exitCode===null&&child.signalCode===null){const done=new Promise(r=>child.once('exit',r));child.kill(signal);await done}}
 async function call(user,route,body={},method='POST'){return new Promise((resolve,reject)=>{const req=https.request(origin+route,{ca,lookup:(_h,_o,cb)=>cb(null,[{address:'127.0.0.1',family:4}]),method,headers:{Origin:origin,'Content-Type':'application/json',...(user?.cookie?{Cookie:user.cookie}:{}),...(user?.csrf?{'X-WCB-CSRF':user.csrf}:{})}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>{try{const text=Buffer.concat(chunks).toString();resolve({status:res.statusCode,body:text?JSON.parse(text):null,cookies:res.headers['set-cookie']||[]})}catch{reject(Error('Non-JSON hosted response'))}})});req.on('error',reject);req.setTimeout(25000,()=>req.destroy(Error('Bounded QA HTTP timeout')));req.end(method==='POST'?JSON.stringify(body):undefined)})}
 async function login(subject){const user={id:randomUUID(),workspace:randomUUID()};await identities.provision({issuer,subject},user.id);await access.workspace(user.workspace,user.id,'owner');const start=await call(null,'/__webcanbe/auth/start'),url=new URL(start.body.authorizationUrl),code=randomUUID();codes.set(code,{nonce:url.searchParams.get('nonce'),challenge:url.searchParams.get('code_challenge'),subject});const end=await call({cookie:start.cookies[0].split(';')[0]},'/__webcanbe/auth/callback?state='+url.searchParams.get('state')+'&code='+code,{},'GET');if(end.status!==303)throw Error('TEST OIDC login failed');user.cookie=end.cookies[0].split(';')[0];user.csrf=(await call(user,'/__webcanbe/auth/session')).body.csrf;return user;}
 const api=(user,p,action,body={})=>call(user,`/__webcanbe/api/projects/${p.id}/${action}`,{previewId:p.previewId,capability:p.capability,...body});
 const session=async(user,id)=>{const r=await call(user,`/__webcanbe/api/projects/${id}/session`);if(r.status!==201)throw Error('Session failed');return{id,...r.body.session}};
 const projects=[];
 async function close(){for(const p of projects)try{await api(p.user,p,'preview',{command:'stop'})}catch{}await shutdown();idp.closeAllConnections();await new Promise(r=>idp.close(r));await pool.end();for(const file of ['editor-config.json','key.pem','cert.pem','gateway-ca.pem','gateway-cert.pem','gateway-key.pem'])fs.rmSync(path.join(dir,file),{force:true});}
 execFileSync(process.execPath,[path.join(root,'scripts/hosted/package.cjs')],{stdio:'pipe'});
 await launch();
 return{root,dir,engine,pool,access,identities,origin,ca,call,api,session,login,launch,shutdown,close,projects,sha};
};
