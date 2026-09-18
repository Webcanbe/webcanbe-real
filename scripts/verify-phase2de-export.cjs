// Standalone render of the authored Phase 2D/E export after its independent
// sandboxed Vite build. No editor server, bridge, source registry or runner API.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { chromium } = require(process.env.WCB_PLAYWRIGHT_MODULE || 'playwright');
const job = process.argv[2] && path.resolve(process.argv[2]), output = process.argv[3] && path.resolve(process.argv[3]);
if (!job || !output) throw Error('Usage: node scripts/verify-phase2de-export.cjs SANDBOX_BUILD_JOB OUTPUT_DIRECTORY');
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
    await page.goto(origin + '/'); await page.getByRole('heading', { name: 'Visual after code.', exact: true }).waitFor();
    assert.equal(await page.locator('h1').evaluate(element => getComputedStyle(element).color), 'rgb(161, 35, 69)'); assert.equal(await page.locator('img').first().getAttribute('alt'), 'Coast from code');
    assert.equal(await page.locator('[data-wcb-id]').count(), 0); assert.equal(await page.locator('.new-sibling').count(), 0);
    for (const image of await page.locator('img').all()) assert(await image.evaluate(element => element.complete && element.naturalWidth > 0));
    await page.screenshot({ path: path.join(output, 'standalone-desktop.png') });
    await page.goto(origin + '/places/42?mode=quiet#details'); await page.getByText('PLACE 42', { exact: true }).waitFor();
    assert.equal(await page.locator('main').evaluate(element => getComputedStyle(element).padding), '44px');
    await page.getByRole('button', { name: 'Next place', exact: true }).click(); await page.getByText('PLACE 7', { exact: true }).waitFor();
    await page.goBack(); await page.getByText('PLACE 42', { exact: true }).waitFor(); await page.reload(); await page.getByText('PLACE 42', { exact: true }).waitFor();
    assert.equal(page.url(), origin + '/places/42?mode=quiet#details');
    await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: path.join(output, 'standalone-mobile.png') }); assert.equal(errors.length, 0, errors.join('; '));
    const result = { result: 'PASS', browser: browser.version(), nativeChromiumSandbox: true, independentViteBuild: true, noEditorServer: true, instrumentationAbsent: true, sourceTextAndStyle: true, propLiteral: true, CSSModule: true, structuralRemoval: true, nestedRouteHistoryRefresh: true, assets: true, desktop: '1280x900', mobile: '390x844', runtimeErrors: errors };
    fs.writeFileSync(path.join(output, 'standalone-results.json'), JSON.stringify(result, null, 2) + '\n'); console.log('PASS independent exported build/render', JSON.stringify(result));
  } finally { await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
})().catch(error => { console.error(error); process.exitCode = 1 });
