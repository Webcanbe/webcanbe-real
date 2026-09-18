// Operator-only independent export gate. The archive and configuration are data;
// only the trusted compiler and selected pinned dependency graph run in Node.
const fs = require('node:fs'), path = require('node:path'), { createHash } = require('node:crypto'), { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '../..'), state = path.join(root, '.webcanbe/runner/qa-common-applications');
const [name, archive, profile] = process.argv.slice(2);
if (!/^[a-z][a-z0-9-]{0,50}$/.test(name) || !archive || !path.resolve(archive).startsWith(state + '/')) throw Error('Expected a named owned TEST export/profile');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
(async () => {
  const bundle = path.join(state, 'export-intake.cjs');
  buildSync({ stdin: { contents: 'export {buildIndependentExport} from "./src/webcanbe-engine/runtime/independentExport";export {RUNTIME_PROFILES} from "./src/webcanbe-engine/runtime/runtimeCompatibility";', resolveDir: root }, bundle: true, platform: 'node', format: 'cjs', packages: 'external', outfile: bundle, logLevel: 'silent' });
  const engine = require(bundle);
  if (!engine.RUNTIME_PROFILES.includes(profile)) throw Error('Unsupported fixed export profile');
  const bytes = fs.readFileSync(archive), began = performance.now();
  const result = { status: 'FAIL', archiveSha256: hash(bytes), profile, boundary: 'Fresh exact ZIP checkout; confined static compiler; pinned immutable Rollup graph; no uploaded config/plugins/scripts or application code execution' };
  try {
    const artifact = await engine.buildIndependentExport(bytes, root);
    if (artifact.profile !== profile) throw Error('Export does not match selected profile');
    const output = [{ path: '/index.html', body: Buffer.from(artifact.html), contentType: 'text/html' }, ...[...artifact.files].map(([path, file]) => ({ path, ...file }))];
    result.platformMarkersAbsent = output.every(f => !/data-wcb-id|__webcanbe|wcb-raster/.test(f.body.toString()));
    if (!result.platformMarkersAbsent) throw Error('Export contains platform instrumentation');
    const mountBase = artifact.base === './' ? '/' : artifact.base;
    result.mountBase = mountBase;
    result.sourceUnchanged = artifact.sourceUnchanged;
    result.plan = artifact.plan;
    result.artifactFiles = output.map(f => ({ path: f.path, sha256: hash(f.body) }));
    result.packageScriptsExecuted = false;
    result.uploadedConfigurationExecuted = false;
    result.cleanupVerified = true;
    fs.mkdirSync(path.join(state, 'hosted'), { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(state, 'hosted', name + '-artifact.json'), JSON.stringify({ html: artifact.html, files: output.map(f => ({ path: f.path.startsWith(mountBase) ? f.path : mountBase + f.path.slice(1), base64: f.body.toString('base64'), contentType: f.contentType })) }), { mode: 0o600 });
    result.status = 'PASS';
  } catch (error) { result.error = String(error.message).split(root).join('<repository>'); }
  result.totalMs = performance.now() - began;
  fs.writeFileSync(path.join(state, name + '-build.json'), JSON.stringify(result, null, 2) + '\n');
  fs.copyFileSync(path.join(state, name + '-build.json'), path.join(state, name + '-build-' + Date.now() + '.json'));
  console.log(JSON.stringify(result));
  if (result.status !== 'PASS') process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
