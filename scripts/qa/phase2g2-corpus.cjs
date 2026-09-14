// Independent, unchanged public-project corpus. Never runs upstream package scripts,
// configuration modules, lifecycle hooks, dependencies or project JavaScript on the host.
// Fetch is pinned to this fixed list; failures remain in every receipt.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { build } = require('esbuild'), yauzl = require('yauzl');
const root = path.resolve(__dirname, '../..');
const candidates = [
  { id: 'redux-essentials', repository: 'https://github.com/reduxjs/redux-essentials-example-app.git', commit: 'b4414e1504c914ece3253dd8a21adfb2278464d9', subpath: '', license: 'UNDETERMINED: no repository LICENSE at this commit; read-only public inspection; no source redistributed', routeModel: 'BrowserRouter, React Router 6; Redux tutorial application with MSW service worker' },
  { id: 'bulletproof-react', repository: 'https://github.com/alan2207/bulletproof-react.git', commit: '9506629ed003a561c6627735480cce4994244bb4', subpath: 'apps/react-vite', license: 'MIT (repository-root LICENSE applies to app)', routeModel: 'BrowserRouter data router, React Router 7; authenticated discussion application' },
  { id: 'todo-list-react', repository: 'https://github.com/tuanductran/todo-list-react.git', commit: 'f48aef130c31452341450adfb6c3fc2234b79389', subpath: '', license: 'MIT (repository-root LICENSE)', routeModel: 'Single-page task application; no declared React Router dependency' },
  { id: 'zustand', repository: 'https://github.com/pmndrs/zustand.git', commit: 'b57db4f86ef179285da216eeb291266da82c361c', subpath: 'examples/demo', license: 'MIT (repository-root LICENSE applies to demo)', routeModel: 'Single-page interactive Three.js/Zustand demonstration; no declared router' },
];
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const git = (directory, args) => execFileSync('git', ['-C', directory, ...args], { maxBuffer: 128 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const milliseconds = started => Math.round((performance.now() - started) * 10) / 10;
const blocked = reason => ({ status: 'BLOCKED', reason });
function safeDataPath(name) {
  return name && !name.startsWith('/') && !name.includes('\\') && !/[\x00-\x1f]/.test(name) && name.split('/').every(part => part && part !== '.' && part !== '..' && part !== '.git');
}
async function zipMembers(archive) {
  return new Promise((resolve, reject) => yauzl.fromBuffer(archive, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }, (error, zip) => {
    if (error) return reject(error);
    const files = new Map(), metadata = []; let total = 0;
    const fail = error => { zip.close(); reject(error); };
    zip.on('error', fail); zip.on('end', () => resolve({ files, metadata }));
    zip.on('entry', entry => {
      const name = entry.fileName.replace(/\/$/, ''), directory = entry.fileName.endsWith('/'), mode = (entry.externalFileAttributes >>> 16) & 0o170000;
      if (!safeDataPath(name) || ![0, 0o100000, 0o040000].includes(mode) || entry.uncompressedSize > 16 * 1024 * 1024 || total + entry.uncompressedSize > 100 * 1024 * 1024 || metadata.length >= 10000) return fail(new Error('Upstream inspection archive exceeded the independent read-only data bounds.'));
      metadata.push({ file: name, directory, bytes: entry.uncompressedSize, compressedBytes: entry.compressedSize, mode }); total += entry.uncompressedSize;
      if (directory) return zip.readEntry();
      zip.openReadStream(entry, async (error, stream) => {
        if (error) return fail(error);
        try { const chunks = []; for await (const bytes of stream) chunks.push(bytes); const value = Buffer.concat(chunks); assert(value.length === entry.uncompressedSize, 'ZIP member length mismatch'); files.set(name, value); zip.readEntry(); } catch (error) { fail(error); }
      });
    }); zip.readEntry();
  }));
}
function intakeFindings(api, metadata, startingAdapters) {
  const findings = []; let total = 0;
  for (const [index, item] of metadata.entries()) {
    total += item.bytes;
    if (!api.safeArchivePath(item.file)) findings.push({ file: item.file, reason: 'path/secret exclusion' });
    if (index + 1 > api.ZIP_LIMITS.entries || item.bytes > api.ZIP_LIMITS.fileBytes || total > api.ZIP_LIMITS.totalBytes || item.bytes / Math.max(1, item.compressedBytes) > api.ZIP_LIMITS.ratio) findings.push({ file: item.file, reason: 'archive size/entry/ratio boundary' });
    if (!item.directory && (startingAdapters || !/\.[cm]ts$/i.test(item.file)) && !/\.(tsx?|jsx?|css|json|html|md|txt|svg|png|jpe?g|gif|webp|ico|woff2?|mjs|cjs|yaml|yml|lock)$/i.test(item.file) && !/(^|\/)(LICENSE|_gitignore|\.gitignore|\.env.example)$/.test(item.file)) findings.push({ file: item.file, reason: 'file extension not in the inspected intake grammar; actual full-project API result is authoritative' });
  }
  return findings;
}
(async () => {
  const cache = path.resolve(process.argv[2] || path.join(root, '.webcanbe/runner/qa-phase2g2/corpus/upstream'));
  const name = process.argv[3] || 'corpus-results'; assert(/^[a-z0-9-]+$/.test(name), 'Invalid receipt name');
  const startingAdapters = process.argv[4] === '--starting-intake-profiles', startingCommit = 'cac7b3abe33a26dcb4f5110b67a8433840960b95';
  assert(!process.argv[4] || startingAdapters, 'Unknown corpus option');
  const baselineModules = ['src/webcanbe-engine/runtime/projectRegistry.ts', 'src/webcanbe-engine/runtime/runtimeCompatibility.ts'];
  const platformFiles = [...baselineModules, 'src/webcanbe-engine/runtime/isolatedPreview.ts', 'src/webcanbe-engine/runtime/viteFixturePlugin.ts', 'src/webcanbe-engine/mutations/sourceValidation.ts', 'src/webcanbe-engine/mutations/durableSource.ts'];
  const sourceFor = file => startingAdapters && baselineModules.includes(file) ? git(root, ['show', startingCommit + ':' + file]) : fs.readFileSync(path.join(root, file));
  const scratch = path.join(root, '.webcanbe/runner/qa-phase2g2/corpus'), reportPath = path.join(root, 'docs/reports/phase2g2-evidence', name + '.json');
  fs.mkdirSync(cache, { recursive: true, mode: 0o700 }); fs.mkdirSync(scratch, { recursive: true, mode: 0o700 });
  const run = fs.mkdtempSync(path.join(scratch, 'run-')), runtime = path.join(run, 'runtime.cjs'), app = path.join(run, 'app');
  fs.cpSync(path.join(root, 'fixtures/compatible-react-vite'), path.join(app, 'fixtures/compatible-react-vite'), { recursive: true });
  const result = { schema: 1, classification: 'INDEPENDENT PROJECT', boundary: 'Local real API/static compiler; never hosted evidence', selectedBeforeAttempts: true, thirdPartySourcesCommitted: false, upstreamCodeExecutedOnHost: false, sourceChangesToForceCompatibility: false, createdAt: new Date().toISOString(), platformBaseCommit: git(root, ['rev-parse', 'HEAD']).toString().trim(), controller: { platform: process.platform, architecture: process.arch, node: process.version }, startingAdapterOverrides: startingAdapters ? { commit: startingCommit, modules: baselineModules, meaning: 'Only intake/profile modules from the starting checkpoint; remaining dependencies are working-tree code. No source files modified.' } : null, platformModuleHashes: Object.fromEntries(platformFiles.map(file => [file, sha(sourceFor(file))])), subjects: [], summary: {} };
  let server;
  try {
    await build({ stdin: { contents: ['projectRegistry', 'runtimeCompatibility', 'isolatedPreview', 'viteFixturePlugin', 'localLimaRunner'].map(file => `export * from "./src/webcanbe-engine/runtime/${file}";`).join('\n') + '\nexport { MutationHistory } from "./src/webcanbe-engine/mutations/sourceMutations";\nexport { analyzeReactSource } from "./src/webcanbe-engine/adapters/react/reactSourceAdapter";', resolveDir: root }, bundle: true, platform: 'node', format: 'cjs', packages: 'external', outfile: runtime, logLevel: 'silent', plugins: startingAdapters ? [{ name: 'starting-intake-and-profile-data', setup(builder) { builder.onLoad({ filter: /(?:projectRegistry|runtimeCompatibility)\.ts$/ }, args => { const relative = path.relative(root, args.path).split(path.sep).join('/'); if (baselineModules.includes(relative)) return { contents: sourceFor(relative).toString('utf8'), loader: 'ts' }; }); } }] : [] });
    const api = require(runtime), { createServer } = await import('vite');
    let registry = new api.ProjectRegistry(app); const key = crypto.randomBytes(32).toString('base64url');
    const start = async () => { server = await createServer({ configFile: false, root, cacheDir: path.join(run, 'cache'), plugins: [api.webCanBeFixturePlugin(root, { registry, editorKey: key, runner: new api.LocalLimaRunnerProvider(root) })], server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' }); await server.listen(); return 'http://127.0.0.1:' + server.httpServer.address().port; };
    let origin = await start();
    const call = async (endpoint, body) => { const response = await fetch(origin + '/__webcanbe/api/' + endpoint, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'X-WCB-Editor-Key': key }, body: JSON.stringify(body) }); return { status: response.status, body: await response.json() }; };
    for (const candidate of candidates) {
      const directory = path.join(cache, candidate.id);
      if (!fs.existsSync(path.join(directory, '.git'))) { fs.mkdirSync(directory, { recursive: true }); git(directory, ['init', '-q']); git(directory, ['remote', 'add', 'origin', candidate.repository]); git(directory, ['-c', 'core.hooksPath=/dev/null', 'fetch', '--depth=1', 'origin', candidate.commit]); git(directory, ['update-ref', 'HEAD', candidate.commit]); }
      assert(git(directory, ['remote', 'get-url', 'origin']).toString().trim() === candidate.repository, 'Cached repository origin differs');
      assert(git(directory, ['rev-parse', 'HEAD']).toString().trim() === candidate.commit, 'Pinned upstream revision differs');
      const tree = candidate.commit + (candidate.subpath ? ':' + candidate.subpath : ''), archiveTime = git(directory, ['show', '-s', '--format=%cI', candidate.commit]).toString().trim(), archive = git(directory, ['archive', '--format=zip', '--mtime=' + archiveTime, tree]);
      const { files, metadata } = await zipMembers(archive), manifest = JSON.parse(files.get('package.json').toString('utf8'));
      const licenseBytes = (() => { try { return git(directory, ['show', candidate.commit + ':LICENSE']); } catch { return undefined; } })();
      const item = { ...candidate, classification: 'INDEPENDENT PROJECT', upstreamTree: git(directory, ['rev-parse', tree]).toString().trim(), archiveMtime: archiveTime, archiveSha256: sha(archive), archiveBytes: archive.length, unchangedFiles: Object.fromEntries([...files].map(([file, bytes]) => [file, { bytes: bytes.length, sha256: sha(bytes) }])), licenseEvidence: licenseBytes ? { path: 'LICENSE', sha256: sha(licenseBytes), length: licenseBytes.length } : { path: null, note: 'No license file; source is not redistributed.' }, framework: { react: manifest.dependencies?.react, reactDom: manifest.dependencies?.['react-dom'], vite: manifest.devDependencies?.vite || manifest.dependencies?.vite }, dependencies: manifest.dependencies || {}, devDependencies: manifest.devDependencies || {}, configuration: { packageManager: manifest.packageManager || null, lockfiles: [...files.keys()].filter(file => /(?:^|\/)(?:package-lock.json|yarn.lock|pnpm-lock.yaml|bun.lockb?|npm-shrinkwrap.json)$/.test(file)), files: [...files.keys()].filter(file => !file.includes('/') && /config|\.env|\.npmrc|\.yarnrc/.test(file)), scriptsInspectedOnly: manifest.scripts || {} }, intakeDiagnostics: intakeFindings(api, metadata, startingAdapters), performance: {}, performanceNotMeasured: { coldRunnerStartup: 'Runtime admission failed', warmCssEdit: 'No admitted runtime', warmReactEdit: 'No admitted runtime', fastRefresh: 'No admitted runtime', documentReload: 'No admitted runtime', fullGenerationRestart: 'No admitted runtime', exportBuild: 'No admitted export build' }, stages: {} };
      const began = performance.now(), imported = await call('projects/import', { name: candidate.id, archive: archive.toString('base64') });
      item.performance.coldImportMs = milliseconds(began); item.stages.import = { status: imported.status === 201 ? 'PASS' : 'FAIL', httpStatus: imported.status, reason: imported.body.error || null };
      // Read-only independent inspection continues after a rejected import to expose
      // underlying compatibility blockers. It is never a bypassed runtime admission.
      const inspection = path.join(run, candidate.id); fs.mkdirSync(inspection);
      for (const [file, bytes] of files) { fs.mkdirSync(path.dirname(path.join(inspection, file)), { recursive: true }); fs.writeFileSync(path.join(inspection, file), bytes, { flag: 'wx', mode: 0o600 }); }
      const rawProject = { id: crypto.randomUUID(), name: candidate.id, root: fs.realpathSync(inspection), sourceRoot: path.join(fs.realpathSync(inspection), 'src'), imported: true, detection: api.detectProject(inspection, root), history: new api.MutationHistory() };
      const inspectStart = performance.now(), runtimeReport = api.inspectRuntime(rawProject, root); item.performance.staticRuntimeInspectionMs = milliseconds(inspectStart); item.runtimeInspection = runtimeReport;
      const compileStart = performance.now(); try { await api.buildIsolatedHttpPreview(rawProject, root); item.stages.compilerDiagnostic = { status: 'PASS', boundary: 'Byte-identical read-only inspection, independent of intake admission' }; } catch (error) { item.stages.compilerDiagnostic = { status: 'FAIL', boundary: 'Compiler refused unchanged source before project execution', reason: error.message }; } item.performance.compilerDiagnosticMs = milliseconds(compileStart);
      const sourceAnalysis = { boundary: 'Static AST inspection only, not rendered compatibility or Code workflow', files: 0, targets: 0, visualCandidates: 0, textCandidates: 0, responsiveCandidates: 0, exceptions: [] };
      const readSource = file => files.get(file)?.toString('utf8');
      for (const [file, bytes] of files) { if (!/^src\/.*\.[jt]sx?$/.test(file)) continue; sourceAnalysis.files++; try { const targets = api.analyzeReactSource(file, bytes.toString('utf8'), readSource, { tailwind: rawProject.detection.tailwind }); sourceAnalysis.targets += targets.length; sourceAnalysis.visualCandidates += targets.filter(target => target.capabilities?.visualEdit).length; sourceAnalysis.textCandidates += targets.filter(target => target.capabilities?.text).length; sourceAnalysis.responsiveCandidates += targets.reduce((count, target) => count + target.styleOrigins.filter(origin => origin.media || origin.prefix).length, 0); } catch (error) { sourceAnalysis.exceptions.push({ file, error: error.message }); } }
      item.sourceAnalysis = sourceAnalysis;
      for (const stage of ['runtime', 'visualCompatibility', 'codeEditing', 'responsiveEditing', 'historyRestart', 'exportExactness', 'exportBuild', 'exportRender']) item.stages[stage] = blocked('Import failed; no admitted project exists. Static diagnostics do not authorize execution or establish UI behavior.');
      if (imported.status === 201) {
        const project = registry.get(imported.body.project.id), route = 'projects/' + project.id + '/';
        const connected = await call(route + 'session', {}); assert(connected.status === 201, 'Admitted project session must initialize');
        const session = connected.body.session, request = body => ({ ...session, ...body });
        const history = await call(route + 'history', request({})), before = await call(route + 'files', request({ file: rawProject.detection.entry }));
        assert(history.status === 200 && before.status === 200, 'Admitted project history/source must be readable');
        const previewStart = performance.now(), preview = await call(route + 'preview', request({ command: 'start', route: '/' })); item.performance.coldRunnerAttemptMs = milliseconds(previewStart);
        item.stages.runtime = { status: preview.status === 200 ? 'PASS' : 'FAIL', httpStatus: preview.status, reason: preview.body.error || null };
        item.stages.visualCompatibility = preview.status === 200 ? { status: 'UNPROVEN', reason: 'Runner started; screenshots require separate visual review and upstream baseline.' } : blocked('Real preview API refuses runtime profile before a runner is started.');
        const code = await call(route + 'code', request({ expectedRevision: before.body.revision, idempotencyKey: crypto.randomUUID(), operations: [{ kind: 'update', file: rawProject.detection.entry, expectedHash: sha(before.body.source), content: before.body.source + '\n// Corpus authoring acceptance probe\n' }] }));
        item.stages.codeEditing = { status: code.status === 200 ? 'PASS' : 'PARTIAL', sourceReadHttpStatus: before.status, saveHttpStatus: code.status, reason: code.body.error || null, draftAccepted: code.status === 200 };
        const after = await call(route + 'files', request({ file: rawProject.detection.entry }));
        if (code.status !== 200) assert(after.body.source === before.body.source && after.body.revision === before.body.revision, 'Rejected draft altered accepted source');
        item.stages.codeEditing.rejectedDraftPreservedCanonicalBytes = code.status !== 200;
        for (const [file, bytes] of files) assert(fs.readFileSync(path.join(project.root, file)).equals(bytes), 'Admitted source differs from unchanged upstream after rejected draft');
        item.admittedSourceUnchangedAfterRejectedDraft = true;
        item.stages.responsiveEditing = blocked('No admitted render; responsive origin counts are static candidates only.');
        const exportStart = performance.now(), exported = await call(route + 'export', request({ expectedRevision: after.body.revision })); item.performance.exportAttemptMs = milliseconds(exportStart);
        if (exported.status === 200) {
          const extracted = await zipMembers(Buffer.from(exported.body.archive, 'base64')); assert(code.status !== 200, 'Unexpected accepted edit requires a reviewed inverse before unchanged export comparison');
          assert(files.size === extracted.files.size && [...files].every(([file, bytes]) => extracted.files.get(file)?.equals(bytes)), 'Export is not byte-exact upstream source');
          item.stages.exportExactness = { status: 'PASS', httpStatus: exported.status, files: files.size, method: 'Compare every extracted file byte with pinned upstream archive after rejected Code draft' };
        } else item.stages.exportExactness = { status: 'BLOCKED', httpStatus: exported.status, reason: exported.body.error };
        item.stages.exportBuild = blocked('No matching declared dependency/lock/configuration profile. No upstream dependency install, lifecycle or config execution attempted on host.'); item.stages.exportRender = blocked('Independent export build unavailable.');
        if (preview.status === 200) await call(route + 'preview', request({ command: 'stop' }));
        await server.close(); registry = new api.ProjectRegistry(app); origin = await start();
        const reconnect = await call(route + 'session', {}), recoveredHistory = await call(route + 'history', reconnect.body.session), recoveredSource = await call(route + 'files', { ...reconnect.body.session, file: rawProject.detection.entry });
        assert(recoveredHistory.body.revision === history.body.revision && recoveredSource.body.source === before.body.source, 'Fresh server/registry lost unchanged source/history');
        item.stages.historyRestart = { status: 'PARTIAL', preservedInitialRevisionAndSourceAfterServerRestart: true, rejectedCodeSaveAddedNoRevision: code.status !== 200, limitation: 'No accepted edited history; compile gate blocks that workflow for this project.' };
      }
      for (const [file, bytes] of files) assert(fs.readFileSync(path.join(inspection, file)).equals(bytes), 'Read-only diagnostic source changed');
      item.unchangedAfterInspection = true; result.subjects.push(item); console.log(JSON.stringify({ id: item.id, import: item.stages.import, profile: runtimeReport.profile, runtimeIssues: runtimeReport.issues.length, runtime: item.stages.runtime, code: item.stages.codeEditing, export: item.stages.exportExactness }));
    }
    result.summary = { selected: candidates.length, retained: result.subjects.length, intakePassed: result.subjects.filter(item => item.stages.import.status === 'PASS').length, runtimePassed: result.subjects.filter(item => item.stages.runtime.status === 'PASS').length, fullCompatibilityPassed: 0, allFailingCandidatesRetained: true, fullProjectCompatibilityGate: 'NOT YET', performance: 'Attempt timings only; no warm-edit, rendering or export-build latency claims for rejected profiles.' };
    fs.writeFileSync(reportPath, JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result.summary));
  } finally { if (server) await server.close(); fs.rmSync(run, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
