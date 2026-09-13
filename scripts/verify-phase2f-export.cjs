// Standalone render of the authored Phase 2F export after its independent
// sandboxed Vite build. No editor server, bridge, source registry or runner API.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { chromium } = require(process.env.WCB_PLAYWRIGHT_MODULE || 'playwright');
const job = process.argv[2] && path.resolve(process.argv[2]), output = process.argv[3] && path.resolve(process.argv[3]);
if (!job || !output) throw Error('Usage: node scripts/verify-phase2f-export.cjs SANDBOX_BUILD_JOB OUTPUT_DIRECTORY');
(async () => {
  assert.equal(JSON.parse(fs.readFileSync(path.join(job, 'result.json'))).status, 'PASS'); fs.mkdirSync(output, { recursive: true });
  const dist = path.join(job, 'project/dist'), files = new Map();
  for (const name of fs.readdirSync(dist, { recursive: true })) { const absolute = path.join(dist, name); if (fs.statSync(absolute).isFile()) files.set('/' + name, fs.readFileSync(absolute)) }
  let origin;
  const server = http.createServer((request, response) => {
    if (request.method !== 'GET' || request.headers.host !== new URL(origin).host) { response.writeHead(403); return response.end() }
    let name; try { name = decodeURIComponent(request.url.split('?')[0]) } catch { response.writeHead(400); return response.end() }
    const resource = files.get(name), document = !resource && !path.extname(name) && request.headers.accept?.includes('text/html'), body = resource || (document ? files.get('/index.html') : undefined);
    if (!body) { response.writeHead(404); return response.end('Not found') }
    const extension = document ? '.html' : path.extname(name);
    response.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' }[extension] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); response.end(body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ headless: true, chromiumSandbox: true }), page = await browser.newPage({ viewport: { width: 1280, height: 900 } }), errors = [];
  page.on('pageerror', error => errors.push(error.message)); await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  try {
    await page.goto(origin + '/'); await page.getByRole('heading', { name: 'Responsive source workshop', exact: true }).waitFor();
    assert.equal(await page.title(), 'Responsive authoring fixture');
    assert.equal(await page.locator('[data-wcb-id]').count(), 0);
    assert(![...files.values()].some(data => data.toString().includes('DEQA:') || data.toString().includes('__webcanbe')));
    for (const [width, padding, media, gap] of [[1280,'48px','32px','32px'],[768,'40px','20px','32px'],[390,'16px','12px','24px']]) {
      await page.setViewportSize({ width, height: 900 });
      const values = await page.evaluate(() => {const style=s=>getComputedStyle(document.querySelector(s));return {padding:style('main').padding,media:style('aside').padding,gap:style('section').gap,direction:style('section').flexDirection,columns:style('article').gridTemplateColumns.split(' ').length,module:style('footer').padding,inline:style('main>div').padding,siblings:[...document.querySelectorAll('section>p')].map(item=>item.textContent)}});
      assert.deepEqual(values, { padding, media, gap, direction:'column',columns:3,module:'28px',inline:'18px',siblings:['First sibling','Second sibling','Third sibling'] });
      await page.screenshot({ path: path.join(output, 'standalone-' + width + '.png') });
    }
    await page.getByRole('link', { name: 'Open details', exact: true }).click(); assert(page.url().endsWith('/details'));
    await page.reload(); await page.getByRole('heading', { name: 'Responsive source workshop', exact: true }).waitFor();
    await page.goBack(); await page.getByRole('heading', { name: 'Responsive source workshop', exact: true }).waitFor();
    assert.equal(errors.length, 0, errors.join('; '));
    const result = { result: 'PASS', browser: browser.version(), nativeChromiumSandbox: true, independentViteBuild: true, noEditorServer: true, instrumentationAbsent: true, responsiveTailwind: true, CSSMedia: true, CSSModule: true, inline: true, flexDirectionGap: true, gridTracks: true, sourceOrder: true, nestedRouteHistoryRefresh: true, widths: [1280,768,390], runtimeErrors: errors };
    fs.writeFileSync(path.join(output, 'standalone-results.json'), JSON.stringify(result, null, 2) + '\n'); console.log('PASS independent exported build/render', JSON.stringify(result));
  } finally { await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
})().catch(error => { console.error(error); process.exitCode = 1 });
