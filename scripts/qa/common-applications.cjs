// Entire immutable archives through actual hosted HTTP. Diagnostic source is data only.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{randomUUID}=require('node:crypto');
const {setup}=require('./common-hosted.cjs');
(async()=>{
 const h=await setup(),{root,dir,engine,pool,api,call,sha}=h,results=[];
 const previous=JSON.parse(fs.readFileSync(path.join(root,'docs/reports/phase2g2-evidence/async-corpus-final.json'))),selection=JSON.parse(fs.readFileSync(path.join(root,'docs/reports/phase2-common-applications-evidence/preselection.json')));
 const candidates=[...previous.subjects.map(x=>({...x,cache:path.join(root,'.webcanbe/runner/qa-phase2g2/corpus/upstream',x.id)})),...selection.subjects.map(x=>({...x,subpath:'',cache:path.join(root,'.webcanbe/runner/qa-common-applications/selection',x.id)}))];
 try{
  const user=await h.login('common-applications-user');
  for(const c of candidates){
   const git=args=>execFileSync('git',['-C',c.cache,...args],{maxBuffer:64*1024*1024});assert.equal(git(['rev-parse','HEAD']).toString().trim(),c.commit);
   const tree=c.commit+(c.subpath?':'+c.subpath:''),archive=git(['archive','--format=zip','--mtime='+c.archiveMtime,tree]);assert.equal(sha(archive),c.archiveSha256);
   const source=new Map(),hashes=c.unchangedFiles||c.files;
   for(const name of git(['ls-tree','-r','--name-only',tree]).toString().trim().split('\n')){assert(name.split('/').every(p=>p&&p!=='.'&&p!=='..'));const bytes=git(['show',c.commit+':'+(c.subpath?c.subpath+'/':'')+name]);assert.equal(sha(bytes),hashes[name].sha256);source.set(name,bytes)}
   const r={id:c.id,commit:c.commit,scope:c.subpath||'root',archiveSha256:sha(archive),exactInitialFileHashes:true,stages:{},performance:{},fullWorkflow:'NOT YET'};results.push(r);
   let began=performance.now();const imported=await call(user,'/__webcanbe/api/projects/import',{workspaceId:user.workspace,name:c.id,archive:archive.toString('base64')});r.performance.importMs=performance.now()-began;r.stages.intake={status:imported.status===201?'PASS':'FAIL',httpStatus:imported.status,error:imported.body.error};
   const scratch=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'wcb-common-readonly-')));
   try{
    for(const[name,bytes]of source){const file=path.join(scratch,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes,{flag:'wx',mode:0o600})}
    const project={id:randomUUID(),name:c.id,root:scratch,sourceRoot:path.join(scratch,'src'),imported:true,detection:engine.detectProject(scratch,root),history:new engine.MutationHistory()},runtime=engine.inspectRuntime(project,root);r.profile=runtime.profile;r.stages.resolution={status:runtime.supported?'PASS':'FAIL',issues:runtime.issues,configuration:runtime.configuration,notes:runtime.notes};
    began=performance.now();try{const artifact=await engine.buildIsolatedHttpPreview(project,root);r.stages.compilation={status:'PASS',artifactFiles:artifact.files.size};fs.writeFileSync(path.join(dir,c.id+'-artifact.json'),JSON.stringify({html:artifact.html,files:[...artifact.files].map(([name,f])=>({path:name,contentType:f.contentType,base64:f.body.toString('base64')}))}),{mode:0o600})}catch(e){r.stages.compilation={status:'FAIL',error:e.message.replaceAll(scratch,'<read-only-diagnostic>')}}r.performance.staticCompileMs=performance.now()-began;
    for(const[name,bytes]of source)assert(fs.readFileSync(path.join(scratch,name)).equals(bytes));
   }finally{fs.rmSync(scratch,{recursive:true,force:true})}
   for(const stage of ['startup','render','interaction','viewerSelection','visualEdit','codeEdit','responsive','history','restart','export','exportBuild','exportRender'])r.stages[stage]={status:'BLOCKED',reason:'Prior application stage has not passed'};
   if(imported.status===201){
    const p=await h.session(user,imported.body.project.id);h.projects.push({...p,user});const row=(await pool.query('SELECT files,revision FROM wcb_projects WHERE project_id=$1',[p.id])).rows[0];assert.equal(Object.keys(row.files).length,source.size);for(const[name,bytes]of source)assert(Buffer.from(row.files[name],'base64').equals(bytes));p.revision=row.revision;r.canonicalInitialBytesExact=true;
    began=performance.now();const started=await api(user,p,'preview',{command:'start',expectedRevision:p.revision});r.performance.startMs=performance.now()-began;r.stages.startup={status:started.status===200?'PASS':'FAIL',httpStatus:started.status,error:started.body.error};
    if(started.status===200){p.generation=started.body.generation;began=performance.now();const frame=await api(user,p,'preview',{command:'capture',generation:p.generation,expectedRevision:p.revision});r.performance.captureMs=performance.now()-began;r.stages.render={status:frame.status===200?'REVIEW_REQUIRED':'FAIL',httpStatus:frame.status,error:frame.body.error,observation:frame.body.observation};if(frame.status===200)fs.writeFileSync(path.join(dir,c.id+'-initial.png'),Buffer.from(frame.body.png,'base64'));}
    await api(user,p,'preview',{command:'stop'});
   }
   console.log(JSON.stringify({id:r.id,intake:r.stages.intake,profile:r.profile,issues:r.stages.resolution.issues.length,compile:r.stages.compilation.status,start:r.stages.startup,render:r.stages.render}));
   fs.writeFileSync(path.join(dir,'applications.json'),JSON.stringify({boundary:'Actual packaged hosted HTTPS / PostgreSQL / mTLS native Linux; local TEST only',applications:results},null,2)+'\n',{mode:0o600});
   await h.shutdown();await h.launch(); // A failed capture may quarantine its controller; each independent case gets a fresh controller after verified stop.
  }
 }finally{await h.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
