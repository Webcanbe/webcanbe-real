// Diagnostic only. Real received bytes falsify zero-egress; silence never proves it.
// No external hosts, credentials, browser API patches or request interception.
// Exit 2 = boundary NOT YET, exit 1 = broken/inconclusive harness. Never emits PASS.
const assert = require('node:assert/strict');
const http = require('node:http'), dgram = require('node:dgram');
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require(process.env.WCB_PLAYWRIGHT_MODULE || 'playwright');
const output = process.argv[2];
if (!output) throw Error('Usage: node scripts/verify-phase2c1-network.cjs OUTPUT_DIRECTORY');
const servers = [], sockets = [], received = [], packets = [];
let previewReceivedParentCookie = false;
async function listen(handler) {
  const server = http.createServer(handler); servers.push(server);
  server.on('upgrade', (req, socket) => { received.push(req.url); socket.destroy(); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return 'http://127.0.0.1:' + server.address().port;
}
async function udp(probe) {
  const socket = dgram.createSocket('udp4'); sockets.push(socket);
  socket.on('message', bytes => packets.push({ probe, bytes: bytes.length, stunMagic: bytes.length >= 8 && bytes.readUInt32BE(4) === 0x2112a442 }));
  await new Promise(resolve => socket.bind(0, '127.0.0.1', resolve));
  return socket.address().port;
}
const policy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; font-src 'none'; media-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none';";
// Runs identically in the positive control and each opaque restricted document.
async function probe({ collector, stunPort, turnPort, remotePort, marker }) {
  const denied = fn => { try { fn(); return false; } catch { return true; } };
  const result = {
    origin: self.origin, parentDOMDenied: denied(() => top.document.body),
    parentStorageDenied: denied(() => top.localStorage.getItem('synthetic')),
    parentCookieDenied: denied(() => top.document.cookie),
    ownStorageDenied: denied(() => localStorage.setItem('synthetic', 'only')),
    ownCookieDenied: denied(() => document.cookie),
    cameraDenied: document.featurePolicy ? !document.featurePolicy.allowsFeature('camera') : null,
    microphoneDenied: document.featurePolicy ? !document.featurePolicy.allowsFeature('microphone') : null,
    supportedPolicyFeatures: document.featurePolicy?.features().filter(x => /rtc|camera|microphone/.test(x)) ?? [],
  };
  const endpoint = name => collector + '/' + marker + '/' + name;
  await Promise.all([
    fetch(endpoint('fetch'), { mode: 'no-cors' }).then(() => result.fetch = 'resolved', () => result.fetch = 'rejected'),
    new Promise(resolve => { try { const ws = new WebSocket(endpoint('websocket').replace('http:', 'ws:')); ws.onerror = () => { ws.close(); resolve(); }; setTimeout(() => { ws.close(); resolve(); }, 500); } catch { resolve(); } }),
    new Promise(resolve => { try { const es = new EventSource(endpoint('eventsource')); es.onerror = () => { es.close(); resolve(); }; setTimeout(() => { es.close(); resolve(); }, 500); } catch { resolve(); } }),
  ]);
  try { navigator.sendBeacon(endpoint('beacon'), 'synthetic'); } catch {}
  const img = new Image(); img.src = endpoint('image'); document.body.append(img);
  const child = document.createElement('iframe'); child.src = endpoint('child-frame'); document.body.append(child);
  // No receiver response or ICE candidates are needed to observe STUN/TURN traffic.
  window.probePeers = [];
  for (const [name, urls] of [['stun', 'stun:127.0.0.1:' + stunPort], ['turn', 'turn:127.0.0.1:' + turnPort + '?transport=udp']]) {
    try {
      const pc = new RTCPeerConnection({ iceServers: [{ urls, username: 'synthetic', credential: 'not-a-secret' }] });
      window.probePeers.push(pc); pc.createDataChannel('synthetic-' + name);
      await pc.setLocalDescription(await pc.createOffer()); result[name] = 'offer-created';
    } catch (error) { result[name] = error.name; }
  }
  // A supplied ICE candidate is another path; no fetch/signaling request from the
  // restricted page is necessary. The receiver intentionally needs no response.
  try {
    const pc = new RTCPeerConnection({ iceServers: [] }); window.probePeers.push(pc);
    pc.createDataChannel('synthetic-remote-candidate');
    const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
    // Valid session setup with a synthetic peer fingerprint and loopback candidate.
    const answer = offer.sdp.replace('a=setup:actpass', 'a=setup:active')
      .replace(/a=ice-ufrag:[^\r\n]+/, 'a=ice-ufrag:synthetic')
      .replace(/a=ice-pwd:[^\r\n]+/, 'a=ice-pwd:syntheticpassword1234567890');
    await pc.setRemoteDescription({ type: 'answer', sdp: answer });
    await pc.addIceCandidate({ candidate: 'candidate:1 1 udp 2130706431 127.0.0.1 ' + remotePort + ' typ host', sdpMid: '0', sdpMLineIndex: 0 });
    result.remoteCandidate = 'accepted';
  } catch (error) { result.remoteCandidate = error.name; }
  window.probeResult = result;
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const stunPort = await udp('stun'), turnPort = await udp('turn'), remotePort = await udp('remoteCandidate');
  const collector = await listen((req, res) => { received.push(req.url); res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' }); res.end('synthetic-only'); });
  let selected = 'control', preview;
  preview = await listen((req, res) => {
    if ((req.headers.cookie || '').includes('synthetic=parent-only')) previewReceivedParentCookie = true;
    const headers = { 'Content-Type': 'text/html', 'Cache-Control': 'no-store', 'X-DNS-Prefetch-Control': 'off' };
    if (selected !== 'control') headers['Content-Security-Policy'] = policy + " sandbox allow-scripts;" + (selected === 'draft-webrtc' ? " webrtc 'block';" : '');
    if (['permissions', 'draft-webrtc', 'envelope'].includes(selected)) headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=(), display-capture=(), webrtc=()';
    res.writeHead(200, headers);
    res.end('<!doctype html><h1>Network probe</h1><script>(' + probe.toString() + ')(' + JSON.stringify({ collector, stunPort, turnPort, remotePort, marker: selected }) + ')</script>');
  });
  preview = preview.replace('127.0.0.1', 'wcb-probe.localhost');
  const editor = await listen((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<h1>Synthetic parent</h1>'); });
  let browser;
  const report = { browser: null, nativeChromiumSandbox: true, requestInterception: false, syntheticLoopbackCollectors: true, results: [], networkIsolationProven: false, httpEnabled: false };
  try {
    if (process.env.WCB_BROWSER_CHANNEL && process.env.WCB_BROWSER_CHANNEL !== 'chrome') throw Error('Only the installed chrome channel is supported by this diagnostic.');
    browser = await chromium.launch({ headless: true, chromiumSandbox: true, ...(process.env.WCB_BROWSER_CHANNEL ? { channel: 'chrome' } : {}) }); report.browser = browser.version();
    for (selected of ['control', 'csp', 'permissions', 'draft-webrtc', 'envelope']) {
      const page = await browser.newPage(), warnings = [];
      page.on('console', message => { if (/Unrecognized|unrecognized feature/.test(message.text())) warnings.push(message.text()); });
      await page.goto(editor);
      const beforeRequests = received.length, beforePackets = packets.length;
      await page.evaluate(({ preview, selected }) => {
        localStorage.setItem('synthetic', 'parent-only'); document.cookie = 'synthetic=parent-only';
        const f = document.createElement('iframe');
        if (selected !== 'control') f.sandbox = 'allow-scripts';
        if (selected === 'envelope') {
          f.srcdoc = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; frame-src ' + preview + ';"><iframe sandbox="allow-scripts" allow="camera \'none\'; microphone \'none\'" src="' + preview + '"></iframe>';
        } else { f.src = preview; if (selected !== 'control') f.allow = "camera 'none'; microphone 'none'"; }
        document.body.append(f);
      }, { preview, selected });
      const matches = frame => frame.url().startsWith(preview);
      const deadline = Date.now() + 10000;
      let frame;
      while (!(frame = page.frames().find(matches))) {
        if (Date.now() >= deadline) throw Error('Preview frame did not navigate within 10 seconds');
        await page.waitForTimeout(50);
      }
      await frame.waitForFunction(() => window.probeResult, null, { timeout: 10000 });
      await page.waitForTimeout(1500);
      const observations = await frame.evaluate(() => { window.probePeers.forEach(pc => pc.close()); return window.probeResult; });
      const requests = received.slice(beforeRequests).map(url => url.split('/').at(-1));
      const receivedPackets = packets.slice(beforePackets);
      const udpPackets = receivedPackets.length;
      const udpPacketsByProbe = Object.fromEntries(['stun', 'turn', 'remoteCandidate'].map(probe => [probe, receivedPackets.filter(packet => packet.probe === probe && packet.stunMagic).length]));
      const entry = { mode: selected, ...observations, origin: observations.origin === 'null' ? 'null' : 'separate-preview-origin', requests, udpPackets, udpPacketsByProbe, warnings: [...new Set(warnings)], dataChannelPayloadDelivery: 'not-tested; receiver records ICE/STUN/TURN packets only' };
      report.results.push(entry);
      assert(observations.parentDOMDenied && observations.parentCookieDenied && observations.parentStorageDenied);
      if (selected === 'control') {
        for (const name of ['fetch', 'websocket', 'eventsource', 'beacon', 'image', 'child-frame']) assert(requests.includes(name), 'Collector positive control missing: ' + name);
        assert.equal(observations.remoteCandidate, 'accepted', 'Remote ICE candidate positive control failed');
        for (const name of ['stun', 'turn', 'remoteCandidate']) assert(udpPacketsByProbe[name] > 0, 'UDP positive control failed: ' + name);
      } else {
        assert(observations.ownStorageDenied && observations.ownCookieDenied);
        assert.equal(requests.length, 0, 'CSP resource regression');
        assert.equal(observations.fetch, 'rejected');
      }
      await page.close();
    }
    report.previewReceivedParentCookie = previewReceivedParentCookie;
    assert.equal(previewReceivedParentCookie, false, 'Parent host-only cookie reached separate preview hostname');
    report.webrtcEgressReproduced = report.results.some(row => row.mode !== 'control' && row.udpPackets > 0);
    report.harness = 'completed';
    // Even no packets on one browser is insufficient to certify arbitrary browsers.
    process.exitCode = 2;
  } catch (error) { report.harness = 'failed'; report.error = error.message; process.exitCode = 1; }
  finally {
    if (browser) await browser.close();
    for (const socket of sockets) socket.close();
    for (const server of servers) { server.closeAllConnections(); server.close(); }
    fs.writeFileSync(path.join(output, 'network-results.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
