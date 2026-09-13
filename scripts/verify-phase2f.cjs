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
  if (!process.argv[2]) throw Error('Usage: node scripts/verify-phase2f.cjs OUTPUT_DIRECTORY');
  fs.mkdirSync(output, { recursive: true });
  const job = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'wcb-2f-qa-')));
  const runtime = path.join(root, '.webcanbe/qa-owned/phase2f-' + crypto.randomUUID() + '.cjs'); fs.mkdirSync(path.dirname(runtime), { recursive: true });
  let child, browser, key, origin, port, latest, uiSession;
  const results = {}, errors = [], logs = [];
  try {
    await build({ stdin: { contents: 'export {webCanBeFixturePlugin} from "./src/webcanbe-engine/runtime/viteFixturePlugin";export {ProjectRegistry} from "./src/webcanbe-engine/runtime/projectRegistry";export {LocalLimaRunnerProvider} from "./src/webcanbe-engine/runtime/localLimaRunner";', resolveDir: root }, bundle: true, platform: 'node', format: 'cjs', packages: 'external', outfile: runtime, logLevel: 'silent' });
    const { ProjectRegistry } = require(runtime);
    fs.cpSync(path.join(root, 'fixtures/compatible-react-vite'), path.join(job, 'fixtures/compatible-react-vite'), { recursive: true });
    const telemetry = `\nsetInterval(()=>{const q=s=>document.querySelector(s),v=(s,p)=>q(s)&&getComputedStyle(q(s))[p]; console.log('DEQA:'+JSON.stringify({p:v('main','padding'),g:v('section','gap'),f:v('section','flexDirection'),c:v('article','gridTemplateColumns'),m:v('aside','padding'),u:v('footer','padding'),i:v('main>div','padding'),s:[...document.querySelectorAll('section>p')].map(e=>e.textContent)}))},250);`;
    const registry = new ProjectRegistry(job), zip = new ZipFile();
    for (const file of fs.readdirSync(path.join(root, 'fixtures/responsive-authoring'), { recursive: true })) {
      const absolute = path.join(root, 'fixtures/responsive-authoring', file); if (!fs.statSync(absolute).isFile()) continue;
      let data = fs.readFileSync(absolute);
      if (file === 'src/main.tsx') data = Buffer.from(data.toString() + telemetry);

      zip.addBuffer(data, file);
    }
    const chunks = []; zip.outputStream.on('data', chunk => chunks.push(chunk)); const zipped = new Promise(resolve => zip.outputStream.on('end', resolve)); zip.end(); await zipped;
    let project = await registry.importZip('Phase 2F BrowserRouter', Buffer.concat(chunks)), id = project.id;
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
    async function choose(tag, index = 0) {
      await canvas();
      await page.getByRole('button', { name: new RegExp('^' + tag + ' · ') }).nth(index).click();
      await page.getByLabel('Authoring breakpoint').waitFor();
    }
    async function style(property, value, breakpoint = 'base') {
      console.log('Checking visual', property, breakpoint);
      await page.getByLabel('Authoring breakpoint').selectOption(breakpoint);
      const input = page.locator('input[data-wcb-property="' + property + '"]'); await input.fill(value);
      const received = page.waitForResponse(response => response.url().endsWith('/mutate'));
      await input.locator('..').getByRole('button', { name: 'Save', exact: true }).click();
      const response = await received, data = await response.json(); assert(response.ok(), JSON.stringify(data)); return data;
    }
    async function undo() { const received = page.waitForResponse(response => response.url().endsWith('/undo')); await page.getByRole('button', { name: 'Undo', exact: true }).click(); assert((await received).ok()) }
    for (const mode of ['BrowserRouter', 'HashRouter']) {
      if (mode === 'HashRouter') {
        const zip = new ZipFile(), chunks = [];
        for (const file of fs.readdirSync(path.join(root, 'fixtures/responsive-authoring'), { recursive: true })) {
          const absolute = path.join(root, 'fixtures/responsive-authoring', file); if (!fs.statSync(absolute).isFile()) continue;
          let data = fs.readFileSync(absolute);
          if (file === 'src/App.tsx') data = Buffer.from(data.toString().replaceAll('BrowserRouter', 'HashRouter'));
          if (file === 'src/main.tsx') data = Buffer.from(data.toString() + telemetry);
          zip.addBuffer(data, file);
        }
        zip.outputStream.on('data', chunk => chunks.push(chunk)); const done = new Promise(resolve => zip.outputStream.on('end', resolve)); zip.end(); await done;
        const imported = await fetch(origin + '/__webcanbe/api/projects/import', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'X-WCB-Editor-Key': key }, body: JSON.stringify({ name: 'Phase 2F HashRouter', archive: Buffer.concat(chunks).toString('base64') }) });
        const data = await imported.json(); assert(imported.ok, JSON.stringify(data)); id = data.project.id; project = { root: path.join(job, '.webcanbe/projects', id) }; latest = undefined;
      }
      console.log('Checking router', mode);
      await page.goto(origin + '/workspace/' + id); await connect();
      await observed((frame, value) => value.p === '48px' && value.g === '32px');
      assert.equal(await page.title(), 'WebCanBe'); assert.match(await page.locator('iframe').getAttribute('src'), /^http:\/\/wcb-view\.localhost:/); assert.equal(await page.locator('vite-error-overlay').count(), 0);
      const expectedRoute = mode === 'BrowserRouter' ? '/details' : '/#/details';
      await page.getByLabel('Preview path').fill(expectedRoute); await page.getByRole('button', { name: 'Open route', exact: true }).click(); await observed(frame => frame.observation.route === expectedRoute);
      // Base visual change appears byte-for-byte in Code and changes mobile only
      // because this source already has md/lg overrides.
      await choose('main'); const original = source('src/App.tsx'); await style('padding', '24px');
      assert.equal(source('src/App.tsx'), original.replace('p-4 md:p-8 lg:p-12', 'p-6 md:p-8 lg:p-12'));
      await page.getByLabel('Viewport', { exact: true }).selectOption('mobile'); await observed((frame, value) => frame.observation.viewport.width === 390 && value.p === '24px');
      await code('src/App.tsx'); assert((await page.getByRole('textbox', { name: 'Source code editor' }).innerText()).includes('p-6 md:p-8 lg:p-12'));
      await undo(); await observed((frame, value) => value.p === '16px');
      await choose('main'); await style('padding', '40px', 'tw:md');
      assert(source('src/App.tsx').includes('p-4 md:p-10 lg:p-12'));
      await page.getByLabel('Viewport', { exact: true }).selectOption('tablet'); await observed((frame, value) => frame.observation.viewport.width === 768 && value.p === '40px');
      await page.getByLabel('Viewport', { exact: true }).selectOption('desktop'); await observed((frame, value) => value.p === '48px');
      // CSS media rules, scope refusal, Module and inline source locations.
      await choose('aside'); await page.getByLabel('Effect scope').selectOption('instance');
      await page.getByLabel('Authoring breakpoint').selectOption('css:(max-width: 620px)');
      const cssInput = page.locator('input[data-wcb-property=padding]'); await cssInput.fill('12px');
      const rejected = page.waitForResponse(response => response.url().endsWith('/mutate')); await cssInput.locator('..').getByRole('button', { name: 'Save', exact: true }).click(); assert.equal((await rejected).status(), 422);
      await page.getByLabel('Effect scope').selectOption('source'); await style('padding', '12px', 'css:(max-width: 620px)');
      await page.getByLabel('Viewport', { exact: true }).selectOption('mobile'); await observed((frame, value) => value.m === '12px');
      await choose('footer'); await style('padding', '28px'); await observed((frame, value) => value.u === '28px');
      await choose('div'); await style('padding', '18'); await observed((frame, value) => value.i === '18px');
      // Actual source reorder is a visual transaction, not CSS coordinates.
      await choose('p', 0); const received = page.waitForResponse(response => response.url().endsWith('/mutate'));
      await page.getByRole('button', { name: 'Move after next sibling', exact: true }).click(); assert((await received).ok());
      await observed((frame, value) => value.s?.[0] === 'Second sibling');
      await undo(); await observed((frame, value) => value.s?.[0] === 'First sibling');
      await choose('section'); await style('flexDirection', 'column'); await observed((frame, value) => value.f === 'column');
      await choose('section'); await style('gap', '24px'); await observed((frame, value) => value.g === '24px');
      await choose('article'); await style('gridTemplateColumns', '3'); await observed((frame, value) => value.c?.split(' ').length === 3);
      // Code changes responsive source, Canvas recompiles the matching viewport.
      await code('src/App.tsx'); await save(source('src/App.tsx').replace('md:p-10', 'md:p-16'));
      await page.getByLabel('Viewport', { exact: true }).selectOption('tablet'); await observed((frame, value) => value.p === '64px');
      await canvas(); await page.screenshot({ path: path.join(output, mode + '-tablet.png') });
      const history = await api('history'), generation = latest.generation;
      await page.getByRole('button', { name: 'History', exact: true }).click(); assert(await page.locator('.history-view').count() || await page.getByText('Visual', { exact: false }).count());
      await api('preview', { command: 'stop' }); await stop(); await start(); await page.reload(); await connect();
      await observed((frame, value) => frame.generation !== generation && value.p === '48px');
      assert.equal((await api('history')).revision, history.revision); assert.equal(latest.observation.route, expectedRoute);
      await page.getByLabel('Viewport', { exact: true }).selectOption('tablet'); await observed((frame, value) => value.p === '64px');
      await undo(); await observed((frame, value) => value.p === '40px');
      await page.getByLabel('Viewport', { exact: true }).selectOption('mobile'); await observed((frame, value) => value.p === '16px' && value.m === '12px');
      await canvas(); await page.screenshot({ path: path.join(output, mode + '-mobile.png') });
      // Remove only QA telemetry through the same Code path before clean export.
      await code('src/main.tsx'); await save(source('src/main.tsx').replace(telemetry, ''));
      const exported = await api('export'); fs.writeFileSync(path.join(output, mode + '-edited.zip'), Buffer.from(exported.archive, 'base64'));
      assert(!source('src/main.tsx').includes('DEQA:')); assert(!source('src/App.tsx').includes('data-wcb-'));
      results[mode] = { strictRunner: true, visualBaseExactCodeUndo: true, responsiveOnlySelectedToken: true, viewportWidths: [390,768,1280], CSSMediaScopeRefusalAndEdit: true, module: true, inline: true, siblingReorderPreviewUndo: true, flexDirectionGap: true, gridTracks: true, codeResponsiveCanvas: true, realServerRestartHeadHistoryUndo: true, cleanExport: true };
      await api('preview', { command: 'stop' });
    }
    await stop(); assert.equal(errors.length, 0, errors.join('; '));
    fs.writeFileSync(path.join(output, 'acceptance-results.json'), JSON.stringify({ result: 'PASS', ...results, browser: browser.version(), errors }, null, 2) + '\n');
    console.log('PASS Phase 2F responsive semantic browser acceptance', JSON.stringify(results));
  } finally {
    if (browser) await browser.close();
    if (child) { const current = child; current.kill('SIGKILL'); await new Promise(resolve => current.once('exit', resolve)) }
    fs.writeFileSync(path.join(output, 'private-server.log'), logs.join(''), { mode: 0o600 }); fs.rmSync(runtime, { force: true }); fs.rmSync(job, { recursive: true, force: true });
  }
}
(process.env.WCB_QA_CHILD === '1' ? serve() : verify()).catch(error => { console.error(error); if (process.env.WCB_QA_CHILD === '1') process.exit(1); else process.exitCode = 1 });
