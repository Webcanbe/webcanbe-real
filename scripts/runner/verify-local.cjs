const path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const limaHome=path.join('/private/tmp','wcb-lima-'+crypto.createHash('sha256').update(root).digest('hex').slice(0,8));
const result=spawnSync(path.join(root,'.webcanbe/runner/tools/bin/limactl'),['shell','--workdir=/','wcb','sudo','-n','/usr/bin/node','/opt/wcb-runtime/verify.cjs'],{env:{...process.env,LIMA_HOME:limaHome},stdio:'inherit',timeout:110000});
if(result.error)throw result.error;
process.exit(result.status??1);
