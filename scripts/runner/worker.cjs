// Trusted Linux guest worker. Only fixed commands; imported JS runs in Chromium.
const fs = require('node:fs');
const {boundedRaster,captureRaster}=require('/opt/wcb-runtime/raster-capture.cjs');
const {refreshChanges,refreshManifest}=require('/opt/wcb-runtime/refresh-policy.cjs');
const { createHash } = require('node:crypto');
const { chromium } = require('/opt/wcb-runtime/node_modules/playwright-core');
let browser, page, cdp, job, artifacts, selectedRoute = '', closed = false;
const logs = [];
let deliveredSecrets = [];
let documentEpoch = 0, clipboard;
const send = value => process.stdout.write(JSON.stringify(value) + '\n');
async function close() { if (closed) return; closed = true; try { if (browser) await browser.close(); } finally { deliveredSecrets=[]; if(job)delete job.secretDelivery; } }
process.stdin.on('end', () => { void close().finally(() => process.exit(0)); });
process.on('SIGTERM', () => { void close().finally(() => process.exit(0)); });
setTimeout(() => { void close().finally(() => process.exit(0)); }, 60000).unref();
// Isolated world uses native DOM APIs even if project code changes its own globals.
async function dom(fn, arg) {
  const tree = await cdp.send('Page.getFrameTree');
  const world = await cdp.send('Page.createIsolatedWorld', { frameId: tree.frameTree.frame.id, worldName: 'webcanbe-supervisor' });
  const result = await cdp.send('Runtime.evaluate', { contextId: world.executionContextId, expression: '(' + fn.toString() + ')(' + JSON.stringify(arg === undefined ? null : arg) + ')', returnByValue: true });
  if (result.exceptionDetails) throw Error('Controlled DOM observation failed');
  return result.result.value;
}
function describeSelected() {
  const e = globalThis.__wcbSelected;
  if (!e?.isConnected) return null;
  const decode = node => { try { return JSON.parse(decodeURIComponent(escape(atob(node.getAttribute('data-wcb-id') || '')))); } catch { return null; } };
  const layout = s => ['absolute', 'fixed'].includes(s.position) ? 'positioned' : s.display.includes('flex') ? 'flex' : s.display.includes('grid') ? 'grid' : ['block', 'inline-block', 'inline'].includes(s.display) ? 'block' : 'unknown';
  const rect = e.getBoundingClientRect(), style = getComputedStyle(e), parent = e.parentElement?.closest('[data-wcb-id]');
  const computed = {};
  for (const property of ['display','position','backgroundColor','color','fontSize','fontWeight','padding','margin','gap','width','height','border','borderRadius']) computed[property] = style[property];
  return { identity: decode(e), tagName: e.tagName.toLowerCase(), rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }, computed, layoutContext: layout(style), ...(parent ? { parentIdentity: decode(parent), parentLayoutContext: layout(getComputedStyle(parent)) } : {}) };
}
async function open(value) {
  if (job) throw Error('Already started');
  if (!value || value.network?.external !== 'deny' || !/^[a-f0-9-]{36}$/.test(value.generation) || value.origin !== 'http://wcb-' + value.generation + '.preview.invalid') throw Error('Invalid job');
  const digest = createHash('sha256').update(JSON.stringify({ html: value.snapshot.html, files: value.snapshot.files })).digest('hex');
  if (digest !== value.snapshot.digest) throw Error('Artifact digest mismatch');
  if (value.expiresAt <= Date.now() || value.expiresAt > Date.now() + 60000) throw Error('Invalid lease');
  if (value.secretDelivery) {
    const delivery = value.secretDelivery;
    if (value.purpose || delivery.generation !== value.generation || delivery.runtime !== 'isolated-browser' || !delivery.values || typeof delivery.values !== 'object' || Array.isArray(delivery.values) || Object.keys(delivery.values).length > 16 || Object.entries(delivery.values).some(([name,secret]) => !/^WCB_PREVIEW_[A-Z0-9_]{1,64}$/.test(name) || typeof secret !== 'string' || Buffer.byteLength(secret)<16 || Buffer.byteLength(secret)>4096 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(secret))) throw Error('Invalid runtime secret delivery');
    deliveredSecrets = Object.values(delivery.values).sort((a,b)=>b.length-a.length);
  }
  job = value;
  setTimeout(() => { void close().finally(() => process.exit(0)); }, Math.max(0, job.expiresAt - Date.now())).unref();
  if (value.purpose !== undefined) {
    if (value.purpose !== 'semantic-typescript-v1') throw Error('Unsupported job purpose');
    return {toolchain:'typescript@5.9.3'};
  }
  browser = await chromium.launch({ executablePath: '/usr/lib/chromium/chromium', headless: true, chromiumSandbox: true, args: ['--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, acceptDownloads: false, serviceWorkers: 'block' });
  if (job.secretDelivery) await context.addInitScript(values => { Object.defineProperty(globalThis, '__WCB_PREVIEW_SECRETS__', { value: Object.freeze(values), writable: false, configurable: false }); }, job.secretDelivery.values);
  const diagnostic = await context.newPage(); await diagnostic.goto('chrome://sandbox');
  const sandbox = await diagnostic.locator('body').innerText(); await diagnostic.close();
  if (!/Layer 1 Sandbox\s+Namespace/.test(sandbox) || !/Seccomp-BPF sandbox\s+Yes/.test(sandbox)) throw Error('Native Chromium sandbox was not verified: ' + sandbox);
  page = await context.newPage();
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) documentEpoch++; });
  page.setDefaultTimeout(4000); page.setDefaultNavigationTimeout(4000);
  context.on('page', extra => { if (extra !== page) void extra.close(); });
  page.on('console', message => { logs.push(deliveredSecrets.length ? 'Runtime logs withheld for managed preview values.' : (message.type() + ': ' + message.text()).slice(0, 300)); if (logs.length > 20) logs.shift(); });
  page.on('dialog', dialog => { void dialog.dismiss(); });
  artifacts = new Map(job.snapshot.files.map(file => [file.path, file]));
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    // External requests really reach the OS boundary; interception is NOT the firewall.
    if (url.origin !== job.origin) return route.continue();
    let pathname; try { pathname = decodeURIComponent(url.pathname); } catch { return route.fulfill({ status: 404, body: '' }); }
    const file = artifacts.get(pathname);
    if (!['GET', 'HEAD'].includes(route.request().method())) return route.fulfill({ status: 405, body: '' });
    if (file) return route.fulfill({ status: 200, contentType: file.contentType, body: Buffer.from(file.base64, 'base64'), headers: { 'Cache-Control': 'no-store' } });
    const navigation = route.request().isNavigationRequest() && !pathname.split('/').some(p => p.startsWith('.') || ['api','__webcanbe','src','node_modules','_wcb'].includes(p)) && !pathname.split('/').at(-1).includes('.');
    return route.fulfill({ status: navigation ? 200 : 404, contentType: 'text/html', body: navigation ? job.snapshot.html : '', headers: { 'Cache-Control': 'no-store' } });
  });
  cdp = await context.newCDPSession(page);
  await page.goto(job.origin + job.route, { waitUntil: 'load' });
  return { browser: browser.version(), sandbox, networkNamespace: fs.readlinkSync('/proc/self/ns/net'), processNamespace: fs.readlinkSync('/proc/self/ns/pid') };
}
async function update(value) {
  if (!job || closed || Date.now() >= job.expiresAt || value?.expectedRevision !== job.revision || value.expectedDigest !== job.snapshot.digest || !['css-hot-update', 'react-fast-refresh', 'incremental-rebuild-reload'].includes(value.kind)) throw Error('Stale update authority');
  const snapshot = value.snapshot;
  if (!snapshot || JSON.stringify(snapshot).length > 48 * 1024 * 1024 || snapshot.files.length > 2000 || createHash('sha256').update(JSON.stringify({ html: snapshot.html, files: snapshot.files })).digest('hex') !== snapshot.digest) throw Error('Update artifact digest mismatch');
  const next = new Map(snapshot.files.map(file => [file.path, file]));
  if (value.kind === 'css-hot-update' && (job.snapshot.html !== snapshot.html || artifacts.size !== next.size || snapshot.files.some(file => { const previous = artifacts.get(file.path); return !previous || previous.contentType !== file.contentType || (!file.path.endsWith('.css') && previous.base64 !== file.base64) }))) throw Error('CSS update changes executable artifacts');
  const changed = value.kind === 'react-fast-refresh' ? refreshChanges(job.snapshot, snapshot) : undefined;
  if (value.kind === 'react-fast-refresh' && !changed) throw Error('Refresh crosses an unsupported module boundary');
  const current = new URL(page.url());
  if (current.origin !== job.origin) throw Error('Update origin mismatch');
  // Swap the full immutable map in the trusted supervisor. CSS is modified from
  // its isolated world, never by an imported JS HMR client in the editor browser.
  artifacts = next;
  if (value.kind === 'css-hot-update') {
    const css = snapshot.files.filter(file => file.path.endsWith('.css')).map(file => ({ path: file.path, text: Buffer.from(file.base64, 'base64').toString('utf8') }));
    await dom(styles => {
      for (const item of styles) {
        for (const link of document.querySelectorAll('link[rel="stylesheet"]')) if (new URL(link.href).pathname === item.path) link.remove();
        let style = [...document.querySelectorAll('style[data-wcb-stylesheet]')].find(node => node.getAttribute('data-wcb-stylesheet') === item.path);
        if (!style) { style = document.createElement('style'); style.setAttribute('data-wcb-stylesheet', item.path); document.head.append(style); }
        style.textContent = item.text;
      }
      globalThis.__wcbSelected = null;
    }, css);
  } else if (value.kind === 'react-fast-refresh') {
    // This executes only inside the isolated project browser. No imported JS is
    // sent to the ordinary editor/viewer browser, and no new network is enabled.
    await page.evaluate(({manifest,changed}) => { if (window.__wcbApplyRefresh(manifest,changed) !== true) throw Error('Refresh failed'); }, {manifest:refreshManifest(snapshot),changed});
    await dom(() => { globalThis.__wcbSelected = null; });
  } else {
    const scroll = await dom(() => ({ x: scrollX, y: scrollY }));
    job = { ...job, snapshot };
    // Retire old-revision logs before navigation; preserve startup diagnostics
    // emitted by the newly accepted document.
    logs.length = 0;
    await page.reload({ waitUntil: 'load' });
    await dom(position => { scrollTo(position.x, position.y); globalThis.__wcbSelected = null; }, scroll);
  }
  job = { ...job, revision: value.revision, snapshot };
  await page.waitForTimeout(40);
  return { revision: job.revision, digest: snapshot.digest, kind: value.kind };
}
async function input(value) {
  if (!page) throw Error('Not started');
  if (value.type === 'text') {
    if(typeof value.text!=='string'||!value.text.length||value.text.length>4096||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value.text))throw Error('Invalid text input');
    await page.keyboard.insertText(value.text);
  } else if (value.type === 'key') {
    if(typeof value.shift!=='boolean'||!['Tab','Enter','Escape','Backspace','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown','SelectAll','CopySelection'].includes(value.key))throw Error('Invalid key input');
    if(value.key==='CopySelection') clipboard=await dom(()=>{const e=document.activeElement;if(e?.tagName==='INPUT'||e?.tagName==='TEXTAREA'){if(e.type==='password'||typeof e.selectionStart!=='number'||typeof e.selectionEnd!=='number')return '';return e.value.slice(e.selectionStart,e.selectionEnd).slice(0,4096);}return (getSelection()?.toString()||'').slice(0,4096);});
    else await page.keyboard.press(value.key==='SelectAll' ?'Control+A':(value.shift?'Shift+':'')+value.key);
  } else if (value.type === 'pointer') {
    if (value.action === 'select') await dom(point => { globalThis.__wcbSelected = document.elementFromPoint(point.x, point.y)?.closest('[data-wcb-id]') || null; }, value);
    else { await dom(() => { globalThis.__wcbSelected = null; }); if (value.action === 'click') await page.mouse.click(value.x, value.y); else await page.mouse.move(value.x, value.y); }
  } else if (value.type === 'navigate') await page.goto(job.origin + value.route, { waitUntil: 'load' });
  else if (value.type === 'history') { if (value.action === 'reload') await page.reload(); else if (value.action === 'back') await page.goBack(); else await page.goForward(); }
  else if (value.type === 'scroll') await page.mouse.wheel(value.dx, value.dy);
  else if (value.type === 'viewport') await page.setViewportSize({ width: value.width, height: value.height });
  else throw Error('Unsupported input');
  await page.waitForTimeout(80);
}
async function sample() {
  return boundedRaster(async () => {
    const authority=job, epoch=documentEpoch, href=page.url(), viewport=page.viewportSize();
    const assertCurrent=()=>{
      const current=page.viewportSize();
      if (closed || job !== authority || Date.now() >= authority.expiresAt || documentEpoch !== epoch || page.url() !== href || current.width !== viewport.width || current.height !== viewport.height) throw Error('Stale raster capture');
    };
    assertCurrent();
    const url=new URL(href);
    if (url.origin !== authority.origin) throw Error('Application left its preview origin');
    const route=url.pathname+url.search+url.hash;
    if (selectedRoute && route !== selectedRoute) await dom(()=>{globalThis.__wcbSelected=null;});
    selectedRoute=route;
    const selection=await dom(describeSelected);
    // Chromium computes names, roles and states; project JS cannot override the CDP API.
    const ax = await cdp.send('Accessibility.getFullAXTree');
    const states = new Set(['disabled','expanded','selected','checked','pressed','required','readonly','invalid','level','live','modal','multiline']);
    const roles = new Set(['button','textbox','link','checkbox','radio','combobox','slider','heading','paragraph','StaticText','list','listitem','navigation','main','dialog','alert','status','tab','tablist','tabpanel','menu','menuitem','option','listbox','table','row','cell','columnheader','rowheader','progressbar','spinbutton','switch','searchbox']);
    const describe = n => ({role:n.role?.value||'unknown',name:String(n.name?.value||'').slice(0,200),description:String(n.description?.value||'').slice(0,200),states:Object.fromEntries((n.properties||[]).filter(p=>states.has(p.name)&&['string','boolean','number'].includes(typeof p.value?.value)).map(p=>[p.name,String(p.value.value).slice(0,100)]))});
    const focusedNode=ax.nodes.find(n=>!n.ignored&&(n.properties||[]).some(p=>p.name==='focused'&&p.value?.value===true)&&n.role?.value!=='RootWebArea');
    const focused=focusedNode?describe(focusedNode):{role:'unknown',name:'No focused control'};
    if(!roles.has(focused.role))focused.role='unknown';
    const accessibility=ax.nodes.filter(n=>!n.ignored&&roles.has(n.role?.value)&&n.role?.value!=='InlineTextBox').slice(0,256).map(describe);
    assertCurrent();
    const png=await captureRaster(cdp,viewport);
    assertCurrent();
    const copied=clipboard;clipboard=undefined;return {png:png.toString('base64'),observation:{route,viewport,selection,focused,accessibility,logs:logs.slice(),...(copied!==undefined?{clipboard:copied}:{})}};
  },close);
}
let buffer = '', chain = Promise.resolve();
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  buffer += chunk;
  if (Buffer.byteLength(buffer) > 48 * 1024 * 1024) process.exit(65);
  let newline;
  while ((newline = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
    chain = chain.then(async () => {
      let request;
      try {
        request = JSON.parse(line);
        const result = request.command === 'open' ? await open(request.value) : request.command === 'update' ? await update(request.value) : request.command === 'check' && job?.purpose === 'semantic-typescript-v1' && !closed && Date.now() < job.expiresAt ? await require('/opt/wcb-runtime/typecheck.cjs')(job.snapshot) : request.command === 'sample' ? await sample() : request.command === 'input' ? await input(request.value) : request.command === 'close' ? await close() : (() => { throw Error('Unknown command'); })();
        send({ id: request.id, result: result ?? null });
      } catch (error) { send({ id: request?.id, error: deliveredSecrets.length ? 'Managed runtime operation failed.' : String(error.message).slice(0, 1000) }); }
    });
  }
});
