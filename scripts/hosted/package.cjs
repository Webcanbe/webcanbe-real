const fs=require('node:fs'),path=require('node:path'),{buildSync}=require('esbuild');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'.webcanbe/hosted-package');
fs.mkdirSync(out,{recursive:true,mode:0o700});
buildSync({entryPoints:[path.join(__dirname,'gateway-main.ts')],outfile:path.join(out,'gateway.cjs'),bundle:true,platform:'node',format:'cjs',target:'node20',external:['pg-native'],logLevel:'warning'});
buildSync({entryPoints:[path.join(__dirname,'editor-main.ts')],outfile:path.join(out,'editor.cjs'),bundle:true,platform:'node',format:'cjs',target:'node22',packages:'external',logLevel:'warning'});
buildSync({entryPoints:[path.join(root,'src/webcanbe-engine/runtime/refreshPolicy.ts')],outfile:path.join(out,'refresh-policy.cjs'),bundle:true,platform:'node',format:'cjs',target:'node20'});
for(const file of ['worker.cjs','launch.sh','stop.sh','probe.cjs','verify.cjs','socket-probe.c'])fs.copyFileSync(path.join(root,'scripts/runner',file),path.join(out,file));
for(const file of ['postgres.sql','wcb-gateway.service','gateway-config.example.json','editor-config.example.json','README.md'])fs.copyFileSync(path.join(root,'deployment/hosted',file),path.join(out,file));
console.log('Reproducible hosted package built in ignored .webcanbe/hosted-package. No credentials included.');
