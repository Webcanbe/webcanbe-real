// No global packages, mounts, agent forwarding, cloud account or paid service.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '../..'), state = path.join(root, '.webcanbe/runner');
if (process.platform !== 'darwin' || process.arch !== 'arm64') throw Error('This local provider is validated only on Apple Silicon macOS with Virtualization.framework.');
fs.mkdirSync(state, {recursive:true});
const executable = path.join(state, 'tools/bin/limactl');
const run = (exe,args,options={}) => execFileSync(exe,args,{stdio:'inherit',...options});
if (!fs.existsSync(executable)) {
 const archive = path.join(state,'lima.tar.gz');
 run('/usr/bin/curl',['--fail','--location','--proto','=https','--tlsv1.2','--output',archive,'https://github.com/lima-vm/lima/releases/download/v2.2.0/lima-2.2.0-Darwin-arm64.tar.gz']);
 if (crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex') !== 'bbdef91774885a0d05f7b048c4eb89ae2bcf3a0c252ae7ca7934e63df76d93c3') throw Error('Lima checksum mismatch.');
 fs.mkdirSync(path.join(state,'tools'),{recursive:true});run('/usr/bin/tar',['-xzf',archive,'-C',path.join(state,'tools')]);
}
const env = {...process.env,LIMA_HOME:path.join(state,'lima')};
const lima = args => run(executable,args,{env});
lima(fs.existsSync(path.join(state,'lima/wcb/lima.yaml')) ? ['start','wcb','--timeout=10m'] : ['start','-y','--name=wcb',path.join(__dirname,'vm.yaml'),'--timeout=10m']);
require('esbuild').buildSync({entryPoints:[path.join(root,'src/webcanbe-engine/runtime/refreshPolicy.ts')],outfile:path.join(state,'refresh-policy.cjs'),bundle:true,platform:'node',format:'cjs',target:'node20'});
lima(['copy',path.join(state,'refresh-policy.cjs'),'wcb:/tmp/wcb-refresh-policy.cjs']);
lima(['shell','--workdir=/','wcb','sudo','-n','install','-m','644','/tmp/wcb-refresh-policy.cjs','/opt/wcb-runtime/refresh-policy.cjs']);
for (const name of ['worker.cjs','launch.sh','stop.sh','probe.cjs','verify.cjs','socket-probe.c']) {
 lima(['copy',path.join(__dirname,name),'wcb:/tmp/wcb-'+name]);
 lima(['shell','--workdir=/','wcb','sudo','-n','install','-m',name.endsWith('.sh')?'755':'644','/tmp/wcb-'+name,'/opt/wcb-runtime/'+name]);
}
lima(['shell','--workdir=/','wcb','sudo','-n','sh','-c','cd /opt/wcb-runtime && npm install --ignore-scripts --no-audit --no-fund playwright-core@1.63.0 && cc -O2 socket-probe.c -o socket-probe']);
console.log('Local runner prepared. Start with WCB_PREVIEW_PROVIDER=lima npm run dev. Run npm run runner:verify before relying on this installation.');
