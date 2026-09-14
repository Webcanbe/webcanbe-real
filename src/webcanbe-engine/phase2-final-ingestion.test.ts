import fs from 'node:fs'
import {EventEmitter} from 'node:events'
import {PassThrough} from 'node:stream'
import {randomUUID,createHash} from 'node:crypto'
import {afterEach,expect,it,vi} from 'vitest'
import {Pool} from 'pg'
import yazl from 'yazl'
import {sourceReference,publicSourceAddress,GitHubSourceProvider} from './runtime/externalSource'
import {HostedProjectRegistry} from './runtime/hostedProjectRegistry'
import {PostgresAccess,PostgresProjectStore} from './runtime/postgresStores'
const network=vi.hoisted(()=>({status:200,headers:{} as Record<string,string>,body:Buffer.from('zip'),request:undefined as any,options:undefined as any,url:'',stall:false}))
vi.mock('node:https',()=>({request:(url:string,options:any,respond:(res:any)=>void)=>{const req:any=new EventEmitter();req.destroy=vi.fn();req.end=()=>{if(!network.stall)queueMicrotask(()=>{const res:any=new PassThrough();res.statusCode=network.status;res.headers=network.headers;respond(res);res.end(network.body)})};network.request=req;network.options=options;network.url=url;return req}}))
afterEach(()=>{vi.useRealTimers();network.status=200;network.headers={};network.body=Buffer.from('zip');network.stall=false})
const reference={provider:'github' as const,repository:'example/project',commit:'a'.repeat(40)}
it('rejects branch names, arbitrary endpoints, credentials and ambiguous external references',()=>{
 expect(sourceReference(reference)).toEqual(reference)
 for(const extra of [{commit:'main'},{repository:'../private'},{repository:'user/repo?token=secret'},{url:'https://127.0.0.1'},{token:'secret'},{commit:'a'.repeat(40)+'/..'},{provider:'file'},{expectedArchiveSha256:'short'}])expect(()=>sourceReference({...reference,...extra})).toThrow()
})
it('rejects private, loopback, metadata, reserved, multicast and non-IPv4 source DNS',()=>{
 for(const address of ['127.0.0.1','10.0.0.1','100.64.0.1','169.254.169.254','172.16.0.1','192.168.0.1','0.0.0.0','224.0.0.1','198.18.0.1','198.51.100.1','203.0.113.1','::1','999.1.2.3'])expect(publicSourceAddress(address)).toBe(false)
 expect(publicSourceAddress('140.82.113.10')).toBe(true)
})
it('uses fixed credential-free HTTPS and pins returned archive integrity',async()=>{
 const p=new GitHubSourceProvider(),r=await p.fetch(reference,new AbortController().signal);expect(network.url).toBe('https://codeload.github.com/example/project/zip/'+reference.commit);expect(network.options.headers.Authorization).toBeUndefined();expect(network.options.agent).toBe(false);expect(r.archive).toEqual(network.body);expect(r.origin.archiveSha256).toBe(createHash('sha256').update(network.body).digest('hex'))
 await expect(p.fetch({...reference,expectedArchiveSha256:'f'.repeat(64)},new AbortController().signal)).rejects.toThrow('integrity')
})
it('rejects redirects, compression, oversized declarations and oversized streamed bytes',async()=>{
 const p=new GitHubSourceProvider();network.status=302;await expect(p.fetch(reference,new AbortController().signal)).rejects.toThrow('response');network.status=200;network.headers={'content-encoding':'gzip'};await expect(p.fetch(reference,new AbortController().signal)).rejects.toThrow('response');network.headers={'content-length':String(26*1024*1024)};await expect(p.fetch(reference,new AbortController().signal)).rejects.toThrow('response');network.headers={};network.body=Buffer.alloc(25*1024*1024+1);await expect(p.fetch(reference,new AbortController().signal)).rejects.toThrow('intake limit')
})
it('cancels a stalled transfer and enforces a whole-transfer deadline',async()=>{
 network.stall=true;const p=new GitHubSourceProvider(),a=new AbortController(),pending=p.fetch(reference,a.signal),rejected=expect(pending).rejects.toThrow('cancelled');a.abort();await rejected;expect(network.request.destroy).toHaveBeenCalled()
 vi.useFakeTimers();const stalled=p.fetch(reference,new AbortController().signal),expired=expect(stalled).rejects.toThrow('deadline');await vi.advanceTimersByTimeAsync(10000);await expired;expect(vi.getTimerCount()).toBe(0)
})
it.skipIf(process.env.WCB_PG_TEST!=='1')('shares intake slots across registries, releases on failure and refuses revocation before atomic acceptance',async()=>{
 const config=JSON.parse(fs.readFileSync('.webcanbe/runner/qa-phase2g2/postgres.json','utf8')),schema='test_'+randomUUID().replace(/-/g,''),admin=new Pool(config);await admin.query(`CREATE SCHEMA ${schema}`);const pool=new Pool({...config,options:`-c search_path=${schema}`});try{
 await pool.query(fs.readFileSync('deployment/hosted/postgres.sql','utf8'));const access=new PostgresAccess(pool),store=new PostgresProjectStore(access),registry=new HostedProjectRegistry(access,store,process.cwd()),other=new HostedProjectRegistry(access,store,process.cwd());const users=[];for(let i=0;i<3;i++){const session={sessionId:randomUUID(),userId:randomUUID(),expiresAt:Date.now()+600000},workspace=randomUUID();await access.registerSession(session);await access.workspace(workspace,session.userId,'owner');users.push({session,workspace})}
 const zip=new yazl.ZipFile();zip.addBuffer(fs.readFileSync('fixtures/compatible-react-vite/package.json'),'package.json');zip.addBuffer(Buffer.from('export const App=()=> <main>Source</main>'),'src/App.tsx');zip.addBuffer(Buffer.from("import {App} from './App';import {createRoot} from 'react-dom/client';createRoot(document.getElementById('root')!).render(<App/>);"),'src/main.tsx');zip.addBuffer(fs.readFileSync('fixtures/compatible-react-vite/index.html'),'index.html');zip.end();const chunks=[];for await(const c of zip.outputStream)chunks.push(Buffer.from(c));const archive=Buffer.concat(chunks);let release!:()=>void,entered!:()=>void;const waiting=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>release=r),first=registry.importSource(users[0].session,users[0].workspace,'first',async()=>{entered();await gate;return{archive}});const rejection=expect(first).rejects.toThrow();await waiting;
 let secondRelease!:()=>void,secondEntered!:()=>void;const secondWaiting=new Promise<void>(r=>secondEntered=r),secondGate=new Promise<void>(r=>secondRelease=r),second=other.importSource(users[1].session,users[1].workspace,'second',async()=>{secondEntered();await secondGate;throw Error('injected fetch failure')});const secondRejection=expect(second).rejects.toThrow('injected');await secondWaiting;
 const loader=vi.fn(async()=>({archive}));await expect(other.importSource(users[0].session,users[0].workspace,'duplicate',loader)).rejects.toThrow('busy');await expect(other.importSource(users[2].session,users[2].workspace,'capacity',loader)).rejects.toThrow('capacity');expect(loader).not.toHaveBeenCalled();await access.revokeSession(users[0].session.sessionId);release();secondRelease();await rejection;await secondRejection;expect((await pool.query('SELECT count(*) AS n FROM wcb_projects')).rows[0].n).toBe('0');const accepted=await registry.importSource(users[2].session,users[2].workspace,'accepted',loader);expect(accepted.imported).toBe(true);expect((await pool.query('SELECT count(*) AS n FROM wcb_projects')).rows[0].n).toBe('1')
 }finally{await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end()}
},20000)
