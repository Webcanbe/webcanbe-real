// Trusted compiler worker: uploaded input is data, never evaluated or emitted.
const {parentPort,workerData}=require('node:worker_threads');
const fs=require('node:fs'),path=require('node:path').posix;
const ts=require('/opt/wcb-runtime/typescript.cjs');
try {
  if(ts.version!=='5.9.3')throw Error('Unpinned TypeScript toolchain');
  const input=workerData;
  if(!input||input.schema!==1||!Array.isArray(input.files)||input.files.length>8192||JSON.stringify(input).length>32*1024*1024)throw Error('Typecheck input bound exceeded');
  const files=new Map();let bytes=0;
  for(const item of input.files){
    if(!item||typeof item.path!=='string'||typeof item.text!=='string'||item.path.length>512||item.path.includes('\\')||item.path.split('/').some(p=>!p||p==='.'||p==='..')||files.has('/project/'+item.path))throw Error('Invalid semantic source identity');
    bytes+=Buffer.byteLength(item.text);if(bytes>28*1024*1024||Buffer.byteLength(item.text)>2*1024*1024)throw Error('Typecheck source bound exceeded');
    files.set('/project/'+item.path,item.text);
  }
  for(const name of fs.readdirSync('/opt/wcb-runtime/typecheck-lib'))if(/^lib\.[a-z0-9.]+\.d\.ts$/.test(name))files.set('/typescript/'+name,fs.readFileSync('/opt/wcb-runtime/typecheck-lib/'+name,'utf8'));
  const allowed=new Set(['moduleDetection','erasableSyntaxOnly','noUncheckedSideEffectImports','resolvePackageJsonExports','resolvePackageJsonImports','allowArbitraryExtensions','target','lib','jsx','strict','skipLibCheck','esModuleInterop','allowSyntheticDefaultImports','forceConsistentCasingInFileNames','module','moduleResolution','resolveJsonModule','isolatedModules','verbatimModuleSyntax','allowImportingTsExtensions','noUnusedLocals','noUnusedParameters','noFallthroughCasesInSwitch','noUncheckedIndexedAccess','exactOptionalPropertyTypes','useDefineForClassFields','baseUrl','paths','types','allowJs','checkJs','strictNullChecks','noImplicitAny','noImplicitReturns','noPropertyAccessFromIndexSignature','useUnknownInCatchVariables']);
  if(!input.options||typeof input.options!=='object'||Array.isArray(input.options)||Object.keys(input.options).some(k=>!allowed.has(k)))throw Error('Unsupported semantic compiler option');
  const parsed=ts.convertCompilerOptionsFromJson(input.options,'/project');
  const options={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,jsx:ts.JsxEmit.ReactJSX,strict:false,skipLibCheck:false,allowJs:true,checkJs:false,types:[],...parsed.options,noEmit:true,incremental:false,composite:false};
  if (typeof input.scope !== 'string' || !input.scope || input.scope.split('/').some(p => !p || p === '.' || p === '..' || p === 'node_modules') || /[\\\x00-\x1f:]/.test(input.scope)) throw Error('Invalid semantic source scope');
  const names=[...files.keys()].filter(p=>p.startsWith('/project/'+input.scope+'/')&&/\.(?:[cm]?[jt]sx?)$/.test(p));
  const directories=new Set(['/project','/typescript']);for(const file of files.keys()){let d=path.dirname(file);while(d!=='/'){directories.add(d);d=path.dirname(d)}}
  const host={getSourceFile:(name,languageVersion)=>{const text=files.get(path.normalize(name));return text===undefined?undefined:ts.createSourceFile(name,text,languageVersion,true)},getDefaultLibFileName:()=>'/typescript/lib.es2022.full.d.ts',writeFile:()=>{throw Error('Typecheck cannot emit')},getCurrentDirectory:()=>'/project',getDirectories:directory=>[...directories].filter(d=>path.dirname(d)===directory).map(d=>path.basename(d)),fileExists:name=>files.has(path.normalize(name)),readFile:name=>files.get(path.normalize(name)),directoryExists:name=>directories.has(path.normalize(name).replace(/\/$/,'')),getCanonicalFileName:name=>name,useCaseSensitiveFileNames:()=>true,getNewLine:()=>"\n",realpath:name=>path.normalize(name)};
  const program=ts.createProgram(names,options,host),all=[...parsed.errors,...ts.getPreEmitDiagnostics(program)],diagnostics=all.slice(0,100).map(d=>{const position=d.file&&d.start!==undefined?d.file.getLineAndCharacterOfPosition(d.start):undefined;return{file:d.file?.fileName.replace(/^\/project\//,'').replace(/^\/typescript\//,'<typescript>/')||'project',code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,'\n').slice(0,1000),...(position?{line:position.line+1,column:position.character+1}:{})}});
  if(!names.length)diagnostics.push({file:'project',message:'No TypeScript or JavaScript source files to check'});
  parentPort.postMessage({level:'semantic',toolchain:'typescript@5.9.3',passed:all.length===0&&names.length>0,diagnostics,truncated:all.length>100});
}catch(error){parentPort.postMessage({level:'semantic',toolchain:'typescript@5.9.3',passed:false,diagnostics:[{file:'project',message:String(error.message).slice(0,1000)}]})}
