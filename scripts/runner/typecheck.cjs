// Fixed service inside the existing isolated job; no arbitrary worker path/code.
const {Worker}=require('node:worker_threads');
module.exports=async function typecheck(snapshot){
  const artifact=snapshot.files.find(f=>f.path==='/_wcb/typecheck.json');
  if(!artifact||artifact.contentType!=='application/json'||artifact.base64.length>40*1024*1024)throw Error('Invalid semantic artifact');
  const data=JSON.parse(Buffer.from(artifact.base64,'base64').toString('utf8'));
  const worker=new Worker('/opt/wcb-runtime/typecheck-worker.cjs',{workerData:data,resourceLimits:{maxOldGenerationSizeMb:768,maxYoungGenerationSizeMb:32}});
  let timer;
  try{return await new Promise((resolve,reject)=>{
    timer=setTimeout(()=>reject(Error('Semantic checking exceeded 4000ms deadline')),4000);
    worker.once('message',resolve);worker.once('error',()=>reject(Error('Semantic checker failed')));worker.once('exit',code=>{if(code!==0)reject(Error('Semantic checker exited'))});
  })}finally{clearTimeout(timer);await worker.terminate()}
};
