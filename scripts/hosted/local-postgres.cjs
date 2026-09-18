// Local integration backend only. Requires PostgreSQL in the existing Lima VM.
// Generated credentials and tunnel state are private, ignored and never printed.
const fs = require('node:fs'), path = require('node:path'), net = require('node:net');
const { randomBytes } = require('node:crypto'), { spawn, execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..'), state = path.join(root, '.webcanbe/runner/qa-phase2g2');
fs.mkdirSync(state, {recursive:true,mode:0o700});
const password = randomBytes(32).toString('hex'), env = {...process.env,LIMA_HOME:path.join(root,'.webcanbe/runner/lima')};
const sql = `SELECT 'CREATE ROLE wcb_qa LOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname='wcb_qa')\n\\gexec\nALTER ROLE wcb_qa PASSWORD '${password}';\nSELECT 'CREATE DATABASE wcb_qa OWNER wcb_qa' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname='wcb_qa')\n\\gexec\n`;
execFileSync(path.join(root,'.webcanbe/runner/tools/bin/limactl'),['shell','--workdir=/','wcb','sudo','-n','-u','postgres','psql','-v','ON_ERROR_STOP=1'],{env,input:sql,stdio:['pipe','ignore','inherit']});
(async()=>{
 const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));
 const ssh=spawn('/usr/bin/ssh',['-F',path.join(root,'.webcanbe/runner/lima/wcb/ssh.config'),'-S','none','-o','ExitOnForwardFailure=yes','-N','-L',`127.0.0.1:${port}:127.0.0.1:5432`,'lima-wcb'],{stdio:'ignore'});
 ssh.on('error',()=>process.exit(1));ssh.on('exit',code=>process.exit(code||0));
 const config={host:'127.0.0.1',port,user:'wcb_qa',password,database:'wcb_qa',ssl:false};
 fs.writeFileSync(path.join(state,'postgres.json'),JSON.stringify(config),{mode:0o600});
 console.log('Local PostgreSQL tunnel started; private connection file written. This is not cloud evidence.');
 const close=()=>{ssh.kill('SIGTERM');fs.rmSync(path.join(state,'postgres.json'),{force:true});};process.on('SIGTERM',close);process.on('SIGINT',close);
})();
