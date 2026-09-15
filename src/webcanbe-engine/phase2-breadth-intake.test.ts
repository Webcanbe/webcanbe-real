import {expect,it,afterEach} from 'vitest'
import {extractSafeZip} from './runtime/projectRegistry'
import {validateIntakeMetadata,isOpaqueBunLock} from './runtime/intakeMetadata'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {ZipFile} from 'yazl'
const dirs:string[]=[]
afterEach(()=>{for(const d of dirs.splice(0))fs.rmSync(d,{recursive:true,force:true})})
async function unpack(files:Record<string,Buffer|string>){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'wcb-breadth-intake-'));dirs.push(dir);const zip=new ZipFile();for(const [p,b]of Object.entries(files))zip.addBuffer(Buffer.from(b),p);zip.end();const chunks:Buffer[]=[];for await(const c of zip.outputStream)chunks.push(Buffer.from(c));const dest=path.join(dir,'out');await extractSafeZip(Buffer.concat(chunks),dest);return dest}
it('preserves finite project metadata, public example URLs and unexecuted text templates byte exactly',async()=>{
 const files={'.node-version':'22\n','.nvmrc':'v20.19.2','.whitesource':JSON.stringify({scanSettings:{baseBranches:['main']},checkRunSettings:{displayMode:'diff',useMendCheckNames:true},issueSettings:{minSeverityLevel:'HIGH',issueType:'DEPENDENCY'}}),'public/_redirects':'/* /index.html 200\n','.env.example':'VITE_APP_API_URL=https://api.example-application.com\nVITE_APP_ENABLE_API_MOCKING=true','generators/component.hbs':'export const {{name}} = () => <div>{{label}}</div>'}
 const root=await unpack(files);for(const [name,value]of Object.entries(files))expect(fs.readFileSync(path.join(root,name),'utf8')).toBe(value)
})
it.each([['.node-version','lts/*'],['.nvmrc','22; touch sentinel'],['_redirects','/* https://external.invalid 302'],['.whitesource','{"scanSettings":{"authToken":"private"}}'],['.env.example','VITE_ACCESS_TOKEN=secret'],['.env.example','VITE_APP_URL=https://user:pass@example.com'],['.env.example','VITE_APP_URL=https://example.com/?secret=private']])('refuses executable/credential metadata %s %s',(name,value)=>{expect(()=>validateIntakeMetadata(name,Buffer.from(value))).toThrow()})
it('admits only bounded recognized opaque Bun framing without claiming dependency resolution',async()=>{
 const header=Buffer.from('#!/usr/bin/env bun\nbun-lockfile-format-v0\n'),opaque=Buffer.concat([header,Buffer.from([2,0,0,0]),Buffer.alloc(64)])
 expect(isOpaqueBunLock('bun.lockb',opaque)).toBe(true);const root=await unpack({'bun.lockb':opaque});expect(fs.readFileSync(path.join(root,'bun.lockb'))).toEqual(opaque)
 for(const b of [Buffer.from([0,1,2]),Buffer.concat([header,Buffer.alloc(64)]),Buffer.alloc(2*1024*1024+1)])await expect(unpack({'bun.lockb':b})).rejects.toThrow()
})
