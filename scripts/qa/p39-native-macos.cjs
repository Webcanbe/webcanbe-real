// P39 macOS-only proof. Text and VoiceOver commands must arrive through the OS.
// This harness never calls page.keyboard, insertText, imeSetComposition or dispatchEvent.
const fs = require("node:fs")
const path = require("node:path")
const assert = require("node:assert/strict")
const { execFileSync } = require("node:child_process")
const { X509Certificate, createHash } = require("node:crypto")
const yazl = require("yazl")
const { setup } = require("./common-hosted.cjs")
const { chromium } = require(process.env.WCB_PLAYWRIGHT_MODULE || "playwright")

const expectedInputSource = "com.apple.inputmethod.Korean.2SetKorean"
const phrase = "한글"
const root = path.resolve(__dirname, "../..")
const saved = path.resolve(process.env.WCB_P39_NATIVE_STATE || path.join(root, ".webcanbe/runner/qa-p39-native"))
const checkpointPath = path.join(saved, "checkpoint.json")
const receiptPath = path.join(saved, "receipt.json")
const inputSourceProbe = process.env.WCB_P39_INPUT_SOURCE_PROBE
const interactionTimeoutMs = Number(process.env.WCB_P39_NATIVE_TIMEOUT_MS || 600000)
const mode = process.env.WCB_P39_NATIVE_MODE || "both"

fs.mkdirSync(saved, { recursive: true, mode: 0o700 })
assert(Number.isSafeInteger(interactionTimeoutMs) && interactionTimeoutMs >= 60000 && interactionTimeoutMs <= 900000, "Invalid native interaction timeout")
assert(["both", "ime", "voiceover"].includes(mode), "Invalid WCB_P39_NATIVE_MODE")

function timestamp() { return new Date().toISOString() }
function writeJson(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 }) }
function checkpoint(phase, details = {}) {
  writeJson(checkpointPath, { phase, timestamp: timestamp(), ...details })
  console.log(`P39_CHECKPOINT=${phase}`)
}
function currentInputSource() {
  assert(inputSourceProbe, "WCB_P39_INPUT_SOURCE_PROBE is required")
  return execFileSync(inputSourceProbe, [], { encoding: "utf8", timeout: 5000 }).trim()
}
function voiceOverProcess() {
  try {
    const pids = execFileSync("/usr/bin/pgrep", ["-x", "VoiceOver"], { encoding: "utf8", timeout: 2000 }).trim().split(/\s+/).filter(Boolean)
    if (!pids.length) return null
    return {
      pids,
      processes: pids.map(pid => execFileSync("/bin/ps", ["-p", pid, "-o", "pid=,lstart=,comm="], { encoding: "utf8", timeout: 2000 }).trim()),
    }
  } catch { return null }
}
function sourceState(row) {
  return {
    revision: row.revision,
    filesSha256: createHash("sha256").update(JSON.stringify(row.files)).digest("hex"),
    historySha256: createHash("sha256").update(JSON.stringify(row.history)).digest("hex"),
  }
}
function axNode(node) {
  return {
    role: node?.role?.value ?? null,
    name: node?.name?.value ?? null,
    value: node?.value?.value ?? null,
    focused: Boolean(node?.properties?.some(item => item.name === "focused" && item.value?.value === true)),
    states: Object.fromEntries((node?.properties || []).filter(item => ["disabled", "expanded", "selected", "checked", "pressed", "required", "readonly", "invalid", "level", "live", "modal", "multiline", "focusable"].includes(item.name)).map(item => [item.name, item.value?.value])),
  }
}

(async () => {
  const receipt = {
    schema: "webcanbe-p39-native-macos-v1",
    startedAt: timestamp(),
    platform: `${process.platform}-${process.arch}`,
    boundary: "Packaged hosted editor / isolated Linux project / headed macOS Chromium / OS keyboard and VoiceOver",
    prohibitedInjection: { javascriptCompositionEvents: false, cdpCompositionEvents: false, playwrightInsertText: false, pasteAsIme: false },
    mode,
    nativeIME: { status: mode === "voiceover" ? "NOT_RUN" : "FAIL", exactPhrase: phrase, expectedInputSource, physicalTwoSetKeys: ["g", "k", "s", "r", "m", "f"] },
    voiceOver: { status: mode === "ime" ? "NOT_RUN" : "FAIL" },
    checks: [],
    consoleErrors: [],
  }
  const check = name => receipt.checks.push({ timestamp: timestamp(), name, status: "PASS" })
  const pending = new Set()
  let harness, browser, page, viewer, latest, project, user

  try {
    assert.equal(process.platform, "darwin")
    harness = await setup()
    user = await harness.login("p39-native-macos")
    const files = {
      "package.json": fs.readFileSync(path.join(root, "fixtures/compatible-react-vite/package.json")),
      "index.html": fs.readFileSync(path.join(root, "fixtures/compatible-react-vite/index.html")),
      "src/main.tsx": "import {createRoot} from 'react-dom/client';import {App} from './App';createRoot(document.getElementById('root')!).render(<App/>);",
      "src/App.tsx": "import {useState} from 'react';import './App.css';export function App(){const [value,setValue]=useState('');return <main><label>Name<input aria-label=\"Name\" value={value} onChange={e=>setValue(e.target.value)}/></label><button onClick={()=>history.replaceState(null,'','/#'+encodeURIComponent(value))}>Save input</button><p aria-live=\"polite\">{value}</p></main>}",
      "src/App.css": "body{margin:0;font:18px sans-serif}main{padding:40px}input{display:block;width:280px;height:40px;margin:6px 0 20px}button{height:40px}",
    }
    const zip = new yazl.ZipFile()
    for (const [name, bytes] of Object.entries(files)) zip.addBuffer(Buffer.from(bytes), name)
    zip.end()
    const chunks = []
    for await (const chunk of zip.outputStream) chunks.push(chunk)
    const imported = await harness.call(user, "/__webcanbe/api/projects/import", { workspaceId: user.workspace, name: "AUTHORED P39 native macOS evidence", archive: Buffer.concat(chunks).toString("base64") })
    assert.equal(imported.status, 201, JSON.stringify(imported.body))
    project = await harness.session(user, imported.body.project.id)
    harness.projects.push({ ...project, user })
    const db = async () => (await harness.pool.query("SELECT files,history,revision FROM wcb_projects WHERE project_id=$1", [project.id])).rows[0]

    const pin = createHash("sha256").update(new X509Certificate(harness.ca).publicKey.export({ format: "der", type: "spki" })).digest("base64")
    browser = await chromium.launch({
      headless: false,
      chromiumSandbox: true,
      args: [
        "--host-resolver-rules=MAP app.wcb-app.test 127.0.0.1, MAP viewer.wcb-preview.test 127.0.0.1",
        `--ignore-certificate-errors-spki-list=${pin}`,
        "--no-proxy-server",
        "--window-position=30,30",
        "--window-size=1600,1100",
      ],
    })
    const context = await browser.newContext({ viewport: { width: 1600, height: 1100 } })
    await context.addCookies([{ name: "__Host-wcb-session", value: user.cookie.split("=")[1], domain: "app.wcb-app.test", path: "/", secure: true, httpOnly: true, sameSite: "Strict" }])
    page = await context.newPage()
    page.setDefaultTimeout(15000)
    page.on("pageerror", error => receipt.consoleErrors.push(error.message))
    page.on("request", request => {
      if (request.url().endsWith("/preview") && request.method() === "POST" && ["capture", "input"].includes(request.postDataJSON()?.command)) pending.add(request)
    })
    page.on("requestfinished", request => pending.delete(request))
    page.on("requestfailed", request => pending.delete(request))
    page.on("response", async response => {
      if (response.url().endsWith("/preview")) try {
        const data = await response.json()
        if (data.png) latest = data
      } catch {}
    })

    const until = async (predicate, label, timeoutMs = 30000) => {
      const end = Date.now() + timeoutMs
      while (Date.now() < end) {
        if (await predicate()) return
        await new Promise(resolve => setTimeout(resolve, 60))
      }
      throw new Error(`Timed out ${label}`)
    }
    const image = () => page.frameLocator('iframe[title="Running imported React/Vite project"]').locator("img")
    const sink = () => page.frameLocator('iframe[title="Running imported React/Vite project"]').locator("textarea")
    const clickRemote = async (x, y) => {
      const previous = latest
      await until(() => latest && latest !== previous, "fresh raster before pointer")
      await until(() => pending.size === 0, "idle before pointer")
      const box = await image().boundingBox()
      await image().click({ position: { x: x * box.width / latest.observation.viewport.width, y: y * box.height / latest.observation.viewport.height } })
      await until(() => pending.size === 0, "remote pointer response")
    }

    await page.goto(`${harness.origin}/workspace/${project.id}`)
    await until(() => Boolean(latest?.png), "first frame")
    assert.equal(await page.title(), "WebCanBe")
    await page.getByRole("button", { name: "Interact with preview", exact: true }).click()
    await clickRemote(180, 90)
    await until(() => latest.observation.focused?.role === "textbox", "remote textbox focus")
    assert.equal(latest.observation.focused.name, "Name")
    viewer = page.frames().find(frame => frame.parentFrame() === page.mainFrame())
    assert(viewer, "trusted viewer frame")
    await viewer.evaluate(() => {
      globalThis.qaNativeEvents = []
      let sequence = 0
      const record = event => globalThis.qaNativeEvents.push({
        sequence: ++sequence,
        timestamp: new Date().toISOString(),
        performanceMs: performance.now(),
        type: event.type,
        trusted: event.isTrusted,
        target: event.target?.tagName,
        data: event.data ?? null,
        inputType: event.inputType ?? null,
        isComposing: event.isComposing ?? null,
        key: event.key ?? null,
        code: event.code ?? null,
        altKey: Boolean(event.altKey),
        ctrlKey: Boolean(event.ctrlKey),
        metaKey: Boolean(event.metaKey),
        shiftKey: Boolean(event.shiftKey),
        value: typeof event.target?.value === "string" ? event.target.value : null,
      })
      for (const type of ["keydown", "keyup", "compositionstart", "compositionupdate", "compositionend", "beforeinput", "input"]) addEventListener(type, record, true)
    })
    const initialRow = sourceState(await db())
    if (mode !== "voiceover") {
    await sink().focus()
    receipt.nativeIME.before = {
      timestamp: timestamp(),
      inputSource: currentInputSource(),
      route: latest.observation.route,
      focused: latest.observation.focused,
      canonical: initialRow,
    }
    assert.equal(receipt.nativeIME.before.inputSource, expectedInputSource)
    await page.screenshot({ path: path.join(saved, "ime-before.png") })
    checkpoint("IME_READY", {
      application: "Google Chrome for Testing",
      title: await page.title(),
      url: page.url(),
      inputSource: receipt.nativeIME.before.inputSource,
      exactPhrase: phrase,
      fixedCommands: ["press g", "press k", "press s", "press r", "press m", "press f", "press Return to complete composition", "press Tab", "press Return to invoke Save input"],
    })

    await until(async () => (await viewer.evaluate(() => globalThis.qaNativeEvents)).some(event => event.type === "compositionend" && event.trusted && event.data === "한글"), "trusted native Korean composition completion", interactionTimeoutMs)
    await until(() => latest?.observation?.route === "/#" + encodeURIComponent(phrase), "native IME product effect", 30000)
    await until(() => latest?.observation?.accessibility?.some(node => node.name === phrase), "native IME final remote text", 30000)
    await until(() => pending.size === 0, "native IME requests complete")
    const imeEvents = await viewer.evaluate(() => globalThis.qaNativeEvents)
    for (const required of ["compositionstart", "compositionupdate", "compositionend", "beforeinput", "input"]) {
      assert(imeEvents.some(event => event.type === required && event.trusted), `missing trusted ${required}`)
    }
    assert(imeEvents.some(event => event.type === "keydown" && event.trusted), "missing trusted native key event")
    const afterImeRow = sourceState(await db())
    assert.deepEqual(afterImeRow, initialRow)
    receipt.nativeIME.events = imeEvents
    receipt.nativeIME.after = {
      timestamp: timestamp(),
      inputSource: currentInputSource(),
      route: latest.observation.route,
      finalText: phrase,
      remoteAccessibility: latest.observation.accessibility.filter(node => node.role === "textbox" || node.name === phrase),
      canonical: afterImeRow,
    }
    assert.equal(receipt.nativeIME.after.inputSource, expectedInputSource)
    receipt.nativeIME.status = "PASS"
    await page.screenshot({ path: path.join(saved, "ime-after.png") })
    check("actual Korean 2-Set composition lifecycle completed through OS key events")
    check("native IME final text and product route effect are exact")
    check("native interaction leaves canonical source, revision and history unchanged")
    }

    if (mode !== "ime") {
    const cdp = await context.newCDPSession(page)
    const editorAX = async () => {
      const tree = await cdp.send("Accessibility.getFullAXTree")
      return ["Canvas", "Code", "History"].map(name => axNode(tree.nodes.find(node => node.name?.value === name && node.role?.value === "button")))
    }
    const frameTree = (await cdp.send("Page.getFrameTree")).frameTree
    const findFrame = tree => tree.frame.url === viewer.url() ? tree : (tree.childFrames || []).map(findFrame).find(Boolean)
    const viewerFrame = findFrame(frameTree)
    const viewerAX = async () => {
      const tree = await cdp.send("Accessibility.getFullAXTree", viewerFrame ? { frameId: viewerFrame.frame.id } : {})
      return tree.nodes.filter(node => node.name?.value === "Project accessibility snapshot" || String(node.name?.value).includes("textbox. Name")).map(axNode)
    }

    await page.getByRole("button", { name: "Code", exact: true }).click()
    await until(() => page.getByRole("button", { name: "Code", exact: true }).getAttribute("aria-pressed").then(value => value === "true"), "Code surface setup")
    await page.getByRole("button", { name: "Code", exact: true }).focus()
    await page.evaluate(() => {
      globalThis.qaVoiceOverEvents = []
      const record = event => globalThis.qaVoiceOverEvents.push({ timestamp: new Date().toISOString(), type: event.type, trusted: event.isTrusted, role: event.target?.getAttribute?.("role") || event.target?.tagName || null, name: event.target?.getAttribute?.("aria-label") || event.target?.textContent?.trim()?.slice(0, 120) || null, pressed: event.target?.getAttribute?.("aria-pressed") ?? null })
      document.addEventListener("focusin", record, true)
      document.addEventListener("click", record, true)
    })
    const voiceOverInitially = voiceOverProcess()
    receipt.voiceOver.before = {
      timestamp: timestamp(),
      process: voiceOverInitially,
      editorAX: await editorAX(),
      viewerAX: await viewerAX(),
      productState: {
        canvasPressed: await page.getByRole("button", { name: "Canvas", exact: true }).getAttribute("aria-pressed"),
        codePressed: await page.getByRole("button", { name: "Code", exact: true }).getAttribute("aria-pressed"),
        activeElement: await page.evaluate(() => ({ role: document.activeElement?.getAttribute("role") || document.activeElement?.tagName, name: document.activeElement?.getAttribute("aria-label") || document.activeElement?.textContent?.trim()?.slice(0, 120) })),
      },
      canonical: sourceState(await db()),
    }
    checkpoint("VOICEOVER_READY", {
      application: "Google Chrome for Testing",
      title: await page.title(),
      url: page.url(),
      voiceOverInitiallyRunning: Boolean(voiceOverInitially),
      fixedCommands: [...(!voiceOverInitially ? ["press Command-F5 to start VoiceOver"] : []), "press Control-Option-Left to move from Code to Canvas", "press Control-Option-Space to invoke Canvas"],
      expectedChange: "Code aria-pressed true -> Canvas aria-pressed true",
    })

    await until(async () => {
      const events = await page.evaluate(() => globalThis.qaVoiceOverEvents)
      return events.some(event => event.type === "focusin" && event.name === "Canvas") && events.some(event => event.type === "click" && event.name === "Canvas" && event.trusted)
    }, "VoiceOver focus navigation and trusted Canvas activation", interactionTimeoutMs)
    await until(() => page.getByRole("button", { name: "Canvas", exact: true }).getAttribute("aria-pressed").then(value => value === "true"), "VoiceOver Canvas product state")
    const voiceOverAtActivation = voiceOverProcess()
    assert(voiceOverAtActivation, "VoiceOver was not running at activation")
    const afterVoiceOverRow = sourceState(await db())
    assert.deepEqual(afterVoiceOverRow, initialRow)
    receipt.voiceOver.events = await page.evaluate(() => globalThis.qaVoiceOverEvents)
    receipt.voiceOver.after = {
      timestamp: timestamp(),
      process: voiceOverAtActivation,
      editorAX: await editorAX(),
      viewerAX: await viewerAX(),
      productState: {
        canvasPressed: await page.getByRole("button", { name: "Canvas", exact: true }).getAttribute("aria-pressed"),
        codePressed: await page.getByRole("button", { name: "Code", exact: true }).getAttribute("aria-pressed"),
        activeElement: await page.evaluate(() => ({ role: document.activeElement?.getAttribute("role") || document.activeElement?.tagName, name: document.activeElement?.getAttribute("aria-label") || document.activeElement?.textContent?.trim()?.slice(0, 120) })),
      },
      canonical: afterVoiceOverRow,
    }
    receipt.voiceOver.status = "PASS"
    await page.screenshot({ path: path.join(saved, "voiceover-after.png") })
    check("actual VoiceOver process participated while product focus moved from Code to Canvas")
    check("VoiceOver invoked Canvas with a trusted activation and observable pressed-state change")
    check("VoiceOver interaction preserved canonical source, revision and history")
    checkpoint("VOICEOVER_CAPTURED", { restoreVoiceOverOff: !voiceOverInitially })
    if (!voiceOverInitially) await until(() => !voiceOverProcess(), "VoiceOver restored to its initial off state", 60000)
    receipt.voiceOver.restoredProcess = voiceOverProcess()
    }

    assert.deepEqual(receipt.consoleErrors, [])
    receipt.status = "PASS"
    receipt.completedAt = timestamp()
    checkpoint("COMPLETE", { status: receipt.status, receipt: receiptPath })
  } catch (error) {
    receipt.status = "FAIL"
    receipt.failure = error.stack || error.message
    receipt.failedAt = timestamp()
    if (viewer) {
      try { receipt.nativeIME.events = await viewer.evaluate(() => globalThis.qaNativeEvents || []) } catch {}
    }
    if (page) {
      try { receipt.voiceOver.events = await page.evaluate(() => globalThis.qaVoiceOverEvents || []) } catch {}
    }
    checkpoint("FAILED", { failure: error.message, receipt: receiptPath })
    process.exitCode = 1
    if (page) try { await page.screenshot({ path: path.join(saved, "failure.png") }) } catch {}
  } finally {
    if (browser) await browser.close()
    if (harness) await harness.close()
    writeJson(receiptPath, receipt)
    const runs = path.join(saved, "runs")
    fs.mkdirSync(runs, { recursive: true, mode: 0o700 })
    writeJson(path.join(runs, `${Date.now()}-${mode}.json`), receipt)
    console.log(JSON.stringify({ receipt: receiptPath, status: receipt.status, nativeIME: receipt.nativeIME.status, voiceOver: receipt.voiceOver.status }))
  }
})().catch(error => {
  console.error(error)
  process.exitCode = 1
})
