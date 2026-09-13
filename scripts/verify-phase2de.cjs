// Authored-fixture acceptance. Private keys, archives and logs remain in ignored
// QA storage. Project JavaScript runs only through the real controlled provider.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { fork } = require('node:child_process'), { build } = require('esbuild'), { ZipFile } = require('yazl');
const root = path.resolve(__dirname, '..');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function serve() {
  const { ProjectRegistry, webCanBeFixturePlugin, LocalLimaRunnerProvider } = require(process.env.WCB_QA_RUNTIME);
  const { createServer } = await import('vite'), { default: react } = await import('@vitejs/plugin-react'), { default: tailwind } = await import('@tailwindcss/vite');
  const registry = new ProjectRegistry(process.env.WCB_QA_PROJECTS);
  const server = await createServer({ configFile: false, root, cacheDir: path.join(process.env.WCB_QA_PROJECTS, 'cache'), plugins: [webCanBeFixturePlugin(root, { registry, editorKey: process.env.WCB_QA_KEY, runner: new LocalLimaRunnerProvider(root) }), react(), tailwind()], server: { host: '127.0.0.1', port: Number(process.env.WCB_QA_PORT || 0), strictPort: true, watch: { ignored: ['**/.webcanbe/**'] } }, logLevel: 'error' });
  await server.listen(); process.send({ port: server.httpServer.address().port });
  process.on('message', async message => { if (message === 'stop') { await server.close(); await sleep(500); process.exit(0) } });
}

async function verify() {
  const output = path.resolve(process.argv[2] || '');
  if (!process.argv[2]) throw Error('Usage: node scripts/verify-phase2de.cjs OUTPUT_DIRECTORY');
  fs.mkdirSync(output, { recursive: true });
  const job = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'wcb-2de-qa-')));
  const runtime = path.join(root, '.webcanbe/qa-owned/phase2de-' + crypto.randomUUID() + '.cjs'); fs.mkdirSync(path.dirname(runtime), { recursive: true });
  let child, browser, key, origin, port, latest, uiSession;
  const results = {}, errors = [], logs = [];
  try {
    await build({ stdin: { contents: 'export {webCanBeFixturePlugin} from "./src/webcanbe-engine/runtime/viteFixturePlugin";export {ProjectRegistry} from "./src/webcanbe-engine/runtime/projectRegistry";export {LocalLimaRunnerProvider} from "./src/webcanbe-engine/runtime/localLimaRunner";', resolveDir: root }, bundle: true, platform: 'node', format: 'cjs', packages: 'external', outfile: runtime, logLevel: 'silent' });
    const { ProjectRegistry } = require(runtime);
    fs.cpSync(path.join(root, 'fixtures/compatible-react-vite'), path.join(job, 'fixtures/compatible-react-vite'), { recursive: true });
    const registry = new ProjectRegistry(job), zip = new ZipFile();
    for (const file of fs.readdirSync(path.join(root, 'fixtures/coast-paths'), { recursive: true })) {
      const absolute = path.join(root, 'fixtures/coast-paths', file); if (!fs.statSync(absolute).isFile()) continue;
      let data = fs.readFileSync(absolute);
      if (file === 'src/main.jsx') data = Buffer.from(data.toString() + `\nsetInterval(()=>console.log('DEQA:'+JSON.stringify({h:document.querySelector('h1')?.textContent,color:document.querySelector('h1')&&getComputedStyle(document.querySelector('h1')).color,padding:document.querySelector('main')&&getComputedStyle(document.querySelector('main')).padding,alt:document.querySelector('img')?.alt,sibling:document.querySelector('.new-sibling')?.textContent,first:document.querySelector('main')?.firstElementChild?.textContent,p:document.querySelector('main>p')?.textContent,assets:[...document.images].every(i=>i.complete&&i.naturalWidth>0)})),250);`);
      zip.addBuffer(data, file);
    }
    const chunks = []; zip.outputStream.on('data', chunk => chunks.push(chunk)); const zipped = new Promise(resolve => zip.outputStream.on('end', resolve)); zip.end(); await zipped;
    const project = await registry.importZip('Phase 2D/E coast', Buffer.concat(chunks)), id = project.id;
    async function start() {
      key = crypto.randomBytes(32).toString('base64url'); latest = undefined;
      if (!port) { const reservation = require('node:net').createServer(); await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve)); port = reservation.address().port; await new Promise(resolve => reservation.close(resolve)) }
      child = fork(__filename, [], { cwd: root, env: { ...process.env, WCB_QA_CHILD: '1', WCB_QA_RUNTIME: runtime, WCB_QA_PROJECTS: job, WCB_QA_KEY: key, WCB_QA_PORT: String(port || 0) }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
      child.stdout.on('data', chunk => logs.push(chunk.toString())); child.stderr.on('data', chunk => logs.push(chunk.toString()));
      port = await new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(Error('Server start timeout: ' + logs.join('').slice(-2000))), 20000); child.once('message', value => { clearTimeout(timeout); resolve(value.port) }); child.once('exit', code => { clearTimeout(timeout); reject(Error('Server exited during startup: ' + code + ' ' + logs.join('').slice(-2000))) }) });
      origin = 'http://127.0.0.1:' + port;
    }
    async function stop() { if (!child) return; const current = child; child = undefined; current.send('stop'); await new Promise((resolve, reject) => { current.once('exit', code => code === 0 ? resolve() : reject(Error('Server stop failed'))); setTimeout(() => { current.kill('SIGKILL'); reject(Error('Server stop timeout')) }, 12000).unref() }) }
    await start();
    const { chromium } = require(process.env.WCB_PLAYWRIGHT_MODULE || 'playwright');
    browser = await chromium.launch({ headless: true, chromiumSandbox: true });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', async response => { try { const data = await response.json(); if (response.url().endsWith('/preview') && data.png) latest = data; if (response.url().endsWith('/session')) uiSession = data.session } catch {} });
    const qa = frame => { const lines = frame?.observation?.logs.filter(line => line.startsWith('log: DEQA:')) || []; return lines.length ? JSON.parse(lines.at(-1).slice(10)) : {} };
    async function observed(predicate, timeout = 18000) { const deadline = Date.now() + timeout; while (Date.now() < deadline) { if (latest && predicate(latest, qa(latest))) return latest; await sleep(80) } throw Error('Controlled frame expectation failed: ' + JSON.stringify(qa(latest)) + ' ' + await page.locator('.transaction-status').innerText() + ' ' + await page.locator('.code-status').innerText().catch(() => '')) }
    async function connect() { await page.getByLabel('Local editor access key').fill(key); await page.getByRole('button', { name: 'Connect / renew session', exact: true }).click(); }
    async function api(action, body = {}) { const response = await fetch(origin + '/__webcanbe/api/projects/' + id + '/' + action, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'X-WCB-Editor-Key': key }, body: JSON.stringify({ ...uiSession, ...body }) }); const data = await response.json(); assert(response.ok, JSON.stringify(data)); return data }
    const source = file => fs.readFileSync(path.join(project.root, file), 'utf8');
    async function code(file) {
      await page.getByRole('button', { name: 'Code', exact: true }).click();
      const button = page.getByLabel('Source file tree').getByRole('button', { name: new RegExp('^' + file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?: M| ●)?$') });
      await button.click(); await page.locator('.source-editor-actions strong').filter({ hasText: file }).waitFor();
      await page.getByRole('textbox', { name: 'Source code editor' }).waitFor();
    }
    async function fillCode(text) { const editor = page.getByRole('textbox', { name: 'Source code editor' }); await editor.click(); await editor.press('Meta+a'); await editor.fill(text); }
    async function save(text, keyboard = false, success = true) {
      await fillCode(text);
      const received = page.waitForResponse(response => response.url().endsWith('/code'));
      if (keyboard) await page.getByRole('textbox', { name: 'Source code editor' }).press('Meta+s'); else await page.getByRole('button', { name: 'Save source', exact: true }).click();
      const response = await received, data = await response.json(); assert.equal(response.ok(), success, JSON.stringify(data)); return data;
    }
    async function canvas() { await page.getByRole('button', { name: 'Canvas', exact: true }).click(); }
    async function selectHeading(value) {
      await canvas();
      // Select the actual rendered heading by coordinates in the raster viewer.
      const box = await page.locator('iframe').boundingBox(); await page.mouse.click(box.x + 200 * box.width / 1280, box.y + 190 * box.width / 1280);
      await page.locator('.inspector-control textarea').waitFor({ timeout: 10000 }); assert.equal(await page.locator('.inspector-control textarea').inputValue(), value);
    }
    await page.goto(origin + '/workspace/' + id); assert.equal(await page.title(), 'WebCanBe'); assert(await page.locator('body').innerText()); assert.equal(await page.locator('vite-error-overlay').count(), 0);
    await connect(); await observed((frame, value) => value.h === 'A coast worth exploring.' && value.assets);
    assert.match(await page.locator('iframe').getAttribute('src'), /^http:\/\/wcb-view\.localhost:/); assert.equal(await page.locator('iframe').getAttribute('sandbox'), 'allow-scripts');
    await selectHeading('A coast worth exploring.'); await page.locator('.inspector-control textarea').fill('Visual edit before restart.'); await page.getByRole('button', { name: 'Apply text change' }).click(); await observed((frame, value) => value.h === 'Visual edit before restart.');
    await code('src/App.jsx'); assert((await page.getByRole('textbox', { name: 'Source code editor' }).innerText()).includes('Visual edit before restart.'));
    await page.getByRole('button', { name: 'History', exact: true }).click(); await page.getByText('Visual text: src/App.jsx', { exact: true }).waitFor();
    const beforeRestart = await api('history'), oldPid = child.pid, oldGeneration = latest.generation;
    await api('preview', { command: 'stop' }); await stop(); await start(); assert.notEqual(child.pid, oldPid);
    await page.reload(); await connect(); await observed((frame, value) => frame.generation !== oldGeneration && value.h === 'Visual edit before restart.');
    const afterRestart = await api('history'); assert.equal(afterRestart.revision, beforeRestart.revision); assert.deepEqual(afterRestart.history.transactions.map(entry => entry.id), beforeRestart.history.transactions.map(entry => entry.id));
    results.visualCodeServerRestart = { source: true, history: true, exactHead: true, separateServerProcess: true, freshControlledGeneration: true };
    // Code text + JSX className and prop literals, then direct CSS and CSS Module saves.
    await code('src/App.jsx'); let app = source('src/App.jsx').replace('Visual edit before restart.', 'Code meets the canvas.').replace('<h1>Code meets', '<h1 className="code-title">Code meets').replace('alt="Coast illustration"', 'alt="Coast from code"');
    const firstCode = await save(app, true); await observed((frame, value) => value.h === 'Code meets the canvas.' && value.alt === 'Coast from code'); assert.equal(firstCode.transaction.producer, 'code');
    await code('src/styles.css'); const styled = source('src/styles.css') + '\n.code-title { color: #a12345; }\n'; await save(styled); await observed((frame, value) => value.color === 'rgb(161, 35, 69)');
    await canvas(); await page.getByLabel('Preview path').fill('/places/42?mode=quiet#details'); await page.getByRole('button', { name: 'Open route', exact: true }).click(); await observed((frame, value) => frame.observation.route === '/places/42?mode=quiet#details' && value.p === 'PLACE 42');
    await page.locator('.compatible-preview-head select').selectOption('tablet'); await observed(frame => frame.observation.viewport.width === 768);
    await code('src/pages/Place.module.css'); await save(source('src/pages/Place.module.css').replace('padding: 32px', 'padding: 44px')); await observed((frame, value) => frame.observation.route === '/places/42?mode=quiet#details' && frame.observation.viewport.width === 768 && value.padding === '44px');
    await canvas(); await page.locator('.compatible-preview-head select').selectOption('desktop'); await page.getByLabel('Preview path').fill('/'); await page.getByRole('button', { name: 'Open route', exact: true }).click(); await observed((frame, value) => value.h === 'Code meets the canvas.' && frame.observation.viewport.width === 1280);
    results.codeTextClassCSSModuleProp = { keyboardSave: true, text: true, className: true, css: true, cssModule: true, literalProp: true, routeAndViewportPreserved: true };
    // Invalid local syntax never changes source or generation; repair is accepted.
    await code('src/App.jsx'); const good = source('src/App.jsx'), goodRevision = (await api('history')).revision, goodGeneration = latest.generation;
    await fillCode(good + '\nexport const broken = <'); await page.getByText('Syntax/validation error — draft retained; preview remains at the last accepted revision.', { exact: false }).waitFor();
    assert.equal(source('src/App.jsx'), good); assert.equal((await api('history')).revision, goodRevision); assert.equal(latest.generation, goodGeneration);
    const failed = await save(good + '\nexport const broken = <', false, false); assert.equal(failed.transaction.status, 'rejected'); assert.equal(source('src/App.jsx'), good); assert((await page.getByRole('textbox', { name: 'Source code editor' }).innerText()).includes('export const broken'));
    app = good.replace('Code meets the canvas.', 'Recovered code draft.'); await save(app); await observed((frame, value) => frame.generation === goodGeneration && frame.revision !== goodRevision && value.h === 'Recovered code draft.');
    results.invalidDraftRecovery = { localDraftRetained: true, lastGoodRevision: true, lastGoodPreview: true, rejectedSaveRecorded: true, repairedSaveRendered: true };
    // Structural source edits invalidate previous offsets, then permit fresh selection.
    const anchors = await api('compatibility'), oldAnchor = anchors.targets.find(item => item.text === 'Recovered code draft.').identity;
    app = source('src/App.jsx').replace('<h1 className="code-title">', '<p className="new-sibling">A structural sibling.</p><h1 className="code-title">'); await save(app); await observed((frame, value) => value.sibling === 'A structural sibling.');
    const updated = await api('compatibility'); assert.notEqual(updated.targets.find(item => item.text === 'Recovered code draft.').identity.elementStart, oldAnchor.elementStart);
    const stale = await fetch(origin + '/__webcanbe/api/projects/' + id + '/mutate', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'X-WCB-Editor-Key': key }, body: JSON.stringify({ ...uiSession, expectedRevision: updated.revision, identity: oldAnchor, idempotencyKey: crypto.randomUUID(), edit: { type: 'text', value: 'stale' } }) }); assert.equal(stale.status, 409);
    // Move then remove the new element; no stale offset survives either save.
    app = source('src/App.jsx').replace('<p className="new-sibling">A structural sibling.</p>', '').replace('<main className="home">', '<main className="home"><p className="new-sibling">A structural sibling.</p>'); await save(app); await observed((frame, value) => value.first === 'A structural sibling.');
    app = source('src/App.jsx').replace('<p className="new-sibling">A structural sibling.</p>', ''); await save(app); await observed((frame, value) => value.sibling === undefined && value.h === 'Recovered code draft.');
    await selectHeading('Recovered code draft.'); await page.locator('.inspector-control textarea').fill('Visual after code.'); await page.getByRole('button', { name: 'Apply text change' }).click(); await observed((frame, value) => value.h === 'Visual after code.');
    results.structureAndVisualRoundTrip = { add: true, reorder: true, remove: true, reanalysis: true, staleAnchorRejected: true, freshSelection: true, visualCodeVisual: true };
    await page.screenshot({ path: path.join(output, 'canvas-after-code.png') });
    await page.getByRole('button', { name: 'History', exact: true }).click(); await page.getByRole('button', { name: 'Create checkpoint', exact: true }).click(); await page.getByText('Validated checkpoint recorded.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Undo', exact: true }).click(); await observed((frame, value) => value.h === 'Recovered code draft.');
    await page.getByRole('button', { name: 'Redo', exact: true }).click(); await observed((frame, value) => value.h === 'Visual after code.');
    await page.getByRole('button', { name: 'View diff', exact: true }).first().click(); assert(await page.locator('.history-diff').innerText()); await page.screenshot({ path: path.join(output, 'durable-history.png') });
    await code('src/App.jsx'); await page.getByRole('button', { name: 'Draft diff', exact: true }).click(); await page.screenshot({ path: path.join(output, 'real-code.png') });
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export code', exact: true }).click(); await (await download).saveAs(path.join(output, 'phase2de-edited.zip'));
    const finalHistory = await api('history'); assert(finalHistory.history.transactions.some(entry => entry.producer === 'visual')); assert(finalHistory.history.transactions.some(entry => entry.producer === 'code')); assert(finalHistory.history.transactions.some(entry => entry.editType === 'checkpoint'));
    // Editor process/UI close and reopen once more after mixed history operations.
    const finalGeneration = latest.generation; await api('preview', { command: 'stop' }); await stop(); await start(); await page.reload(); await connect(); await observed((frame, value) => frame.generation !== finalGeneration && value.h === 'Visual after code.');
    const finalReopen = await api('history'); assert.equal(finalReopen.revision, finalHistory.revision); assert.equal(finalReopen.history.transactions.length, finalHistory.history.transactions.length);
    assert.equal(errors.length, 0, errors.join('; ')); assert.equal(await page.locator('vite-error-overlay').count(), 0);
    results.historyCheckpointUndoRedoExport = { realDiff: true, checkpoint: true, undo: true, redo: true, sourceExport: true, mixedHistoryRestart: true };
    results.browser = { version: browser.version(), nativeSandbox: true, editorViewport: '1600x1100', previewWidths: [1280, 768], pageIdentity: true, meaningfulContent: true, noFrameworkOverlay: true, runtimeErrors: errors, boundary: 'real Linux controlled raster provider' };
    await api('preview', { command: 'stop' });
    // Strict HashRouter: direct Tailwind and a single component-call prop edit.
    const hashZip = new ZipFile(), hashChunks = [];
    for (const file of fs.readdirSync(path.join(root, 'fixtures/studio-ledger'), { recursive: true })) {
      const absolute = path.join(root, 'fixtures/studio-ledger', file); if (!fs.statSync(absolute).isFile()) continue;
      let data = fs.readFileSync(absolute);
      if (file === 'src/main.tsx') data = Buffer.from(data.toString() + `\nsetInterval(()=>console.log('DEQA:'+JSON.stringify({h:document.querySelector('h1')?.textContent,padding:document.querySelector('main')&&getComputedStyle(document.querySelector('main')).padding,metrics:[...document.querySelectorAll('article strong')].map(e=>e.textContent)})),250);`);
      hashZip.addBuffer(data, file);
    }
    hashZip.outputStream.on('data', chunk => hashChunks.push(chunk)); const hashDone = new Promise(resolve => hashZip.outputStream.on('end', resolve)); hashZip.end(); await hashDone;
    const imported = await fetch(origin + '/__webcanbe/api/projects/import', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'X-WCB-Editor-Key': key }, body: JSON.stringify({ name: 'Strict HashRouter code acceptance', archive: Buffer.concat(hashChunks).toString('base64') }) });
    const hashProject = (await imported.json()).project; assert(hashProject); latest = undefined;
    await page.goto(origin + '/workspace/' + hashProject.id); await connect(); await observed((frame, value) => value.h === 'Make space for focused work.');
    assert.match(await page.locator('iframe').getAttribute('src'), /^http:\/\/wcb-view\.localhost:/);
    await code('src/pages/Dashboard.tsx');
    const dashboard = fs.readFileSync(path.join(job, '.webcanbe/projects', hashProject.id, 'src/pages/Dashboard.tsx'), 'utf8');
    await save(dashboard.replace('p-6 md:p-8 lg:p-10', 'p-6 md:p-8 lg:p-16').replace("<Metric label='Active projects' value='4'", "<Metric label='Active projects' value='9'"));
    await observed((frame, value) => value.padding === '64px' && value.metrics?.[0] === '9' && value.metrics?.[1] === '2');
    await canvas(); await page.screenshot({ path: path.join(output, 'strict-hashrouter-code.png') });
    await code('src/pages/Dashboard.tsx'); await page.getByText('File operations', { exact: true }).click();
    async function fileOperation(action, destination) {
      await page.getByLabel('File action', { exact: true }).selectOption(action);
      if (destination) await page.getByLabel('New source path', { exact: true }).fill(destination);
      const received = page.waitForResponse(response => response.url().endsWith('/code'));
      await page.getByRole('button', { name: 'Apply file operation', exact: true }).click(); const response = await received; assert(response.ok(), await response.text());
      await page.getByText('Source ' + action + ' accepted. History retains a safe inverse.', { exact: true }).waitFor();
      await observed((frame, value) => value.metrics?.[0] === '9' && value.padding === '64px');
      await page.getByRole('button', { name: 'Apply file operation', exact: true }).waitFor({ state: 'visible' });
    }
    await fileOperation('create', 'src/TemporaryNote.ts');
    await page.getByLabel('Source file tree').getByRole('button', { name: /^src\/TemporaryNote\.ts/ }).waitFor();
    await fileOperation('rename', 'src/RenamedNote.ts');
    await page.getByLabel('Source file tree').getByRole('button', { name: /^src\/RenamedNote\.ts/ }).waitFor();
    await fileOperation('delete');
    assert(!fs.existsSync(path.join(job, '.webcanbe/projects', hashProject.id, 'src/RenamedNote.ts')));
    results.safeFileOperationUI = { create: true, rename: true, delete: true, compiledBeforeAcceptance: true };

    results.strictHashRouterCode = { realControlledProvider: true, tailwindRecompiled: true, componentPropLiteral: true, otherInstancePreserved: true };
    await page.getByRole('button', { name: 'Stop preview', exact: true }).click(); await page.locator('[data-preview-state=stopped]').waitFor(); await stop();
    assert.equal(errors.length, 0, errors.join('; '));
    fs.writeFileSync(path.join(output, 'acceptance-results.json'), JSON.stringify({ result: 'PASS', ...results }, null, 2) + '\n'); console.log('PASS Phase 2D/E controlled Code/Canvas/server restart acceptance', JSON.stringify(results));
  } finally {
    if (browser) await browser.close();
    if (child) { const current = child; current.kill('SIGKILL'); await new Promise(resolve => current.once('exit', resolve)) }
    fs.writeFileSync(path.join(output, 'private-server.log'), logs.join(''), { mode: 0o600 }); fs.rmSync(runtime, { force: true }); fs.rmSync(job, { recursive: true, force: true });
  }
}
(process.env.WCB_QA_CHILD === '1' ? serve() : verify()).catch(error => { console.error(error); if (process.env.WCB_QA_CHILD === '1') process.exit(1); else process.exitCode = 1 });
