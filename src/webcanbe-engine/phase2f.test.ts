import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { afterEach, describe, expect, it } from "vitest"
import { createServer, type ViteDevServer } from "vite"
import { analyzeProjectStyles, breakpointRegistry } from "./adapters/react/projectStyles"
import { patchProjectStyle, patchSiblingReorder, undoTransaction, type SourceStore } from "./mutations/sourceMutations"
import { ProjectRegistry } from "./runtime/projectRegistry"
import { webCanBeFixturePlugin } from "./runtime/viteFixturePlugin"
import { contentHash } from "./mutations/durableSource"
import type { StyleProperty, ViewportPreset } from "./core/types"

function setup(jsx = '<main className="flex flex-row gap-4 md:gap-8 lg:gap-12 items-center custom-brand"><p>One</p>\n<p>Two</p></main>', css = '') {
  const files = new Map([['src/App.tsx', `import './app.css'; export default function App(){return ${jsx}}`], ['src/app.css', css]])
  const store: SourceStore = { tailwind: true, read: file => files.get(file), write: (file, code, expected) => { expect(files.get(file)).toBe(expected); files.set(file, code) } }
  const analysis = (width = 1280) => analyzeProjectStyles(files, true, width)
  const target = analysis().targets.find(item => item.elementName === 'main')!
  return { files, store, analysis, target }
}
const directories: string[] = [], servers: ViteDevServer[] = []
afterEach(async () => { for (const server of servers.splice(0)) await server.close(); for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true }) })

describe('Phase 2F responsive style origins', () => {
  it('mutates exactly one base token and preserves unknown utilities, whitespace and inverse', () => {
    const { files, store, target } = setup(), before = files.get('src/App.tsx')!
    const result = patchProjectStyle(store, files, target.identity, 'gap', '24px')
    expect(result.success).toBe(true); expect(result.patches[0].before).toBe('gap-4'); expect(result.patches[0].after).toBe('gap-6')
    expect(files.get('src/App.tsx')).toBe(before.replace('gap-4', 'gap-6'))
    expect(undoTransaction(store, result)).toBe(true); expect(files.get('src/App.tsx')).toBe(before)
  })
  it.each(['phone', '__proto__'])('rejects unknown viewport %s instead of selecting a fallback breakpoint', viewport => {
    const { files, store, target, analysis } = setup(), before = new Map(files)
    expect(patchProjectStyle(store, files, target.identity, 'gap', '24px', { viewport: viewport as ViewportPreset }).success).toBe(false)
    expect(patchSiblingReorder(store, files, analysis().targets[1].identity, 'next', viewport as ViewportPreset).success).toBe(false)
    expect(files).toEqual(before)
  })
  it('changes only the explicit responsive token, with distinct effective viewport values', () => {
    const { files, store, target, analysis } = setup()
    expect(patchProjectStyle(store, files, target.identity, 'gap', '40px', { breakpoint: 'tw:md' }).success).toBe(true)
    expect(files.get('src/App.tsx')).toContain('gap-4 md:gap-10 lg:gap-12')
    expect([390, 768, 1280].map(width => analysis(width).targets[0].styleOrigins.find(item => item.property === 'gap' && item.effective)?.value)).toEqual(['gap-4', 'md:gap-10', 'lg:gap-12'])
  })
  it('derives static theme breakpoints instead of inventing preset widths', () => {
    const { files, store, target, analysis } = setup(undefined, '@theme { --breakpoint-md: 55rem; --breakpoint-lg: 75rem; }')
    expect(analysis(768).targets[0].styleOrigins.find(item => item.property === 'gap' && item.effective)?.value).toBe('gap-4')
    expect(analysis(900).targets[0].styleOrigins.find(item => item.property === 'gap' && item.effective)?.value).toBe('md:gap-8')
    expect(patchProjectStyle(store, files, target.identity, 'gap', 'md:gap-10', { breakpoint: 'tw:md' }).success).toBe(true)
  })
  it('fails closed for dynamic config and unsupported media conditions', () => {
    const { files, store, target } = setup(undefined, '@config "../tailwind.config.js";')
    expect(breakpointRegistry(files, true).breakpoints.some(item => item.id === 'tw:md')).toBe(false)
    expect(patchProjectStyle(store, files, target.identity, 'gap', '24px', { breakpoint: 'tw:md' }).success).toBe(false)
    files.set('src/app.css', '.card { padding: 16px; } @media (orientation: portrait) {.card {padding:32px}}')
    files.set('src/App.tsx', 'import "./app.css"; export default () => <main className="card" />')
    expect(analyzeProjectStyles(files, false).targets[0].styleOrigins.every(item => !item.editable)).toBe(true)
  })
  it('patches an existing CSS media value without changing base or another query', () => {
    const { files, store, target, analysis } = setup('<main className="card" />', '.card { padding: 16px; }\n@media (max-width: 620px) { .card { padding: 8px; } }\n@media (min-width: 900px) { .card { padding: 32px; } }')
    expect(analysis(390).targets[0].styleOrigins.find(item => item.effective)?.value).toBe('8px')
    const before = files.get('src/app.css')!
    expect(patchProjectStyle(store, files, target.identity, 'padding', '12px', { breakpoint: 'css:(max-width: 620px)', scope: 'source' }).success).toBe(true)
    expect(files.get('src/app.css')).toBe(before.replace('8px', '12px'))
  })
  it('reports shared CSS scope and rejects an instance-only request', () => {
    const { files, store, target, analysis } = setup('<main className="card"><p className="card">One</p></main>', '.card {padding:16px}')
    const origin = analysis().targets[0].styleOrigins[0]
    expect(origin.usageCount).toBe(2); expect(origin.shared).toBe(true); expect(origin.scope).toContain('Global')
    expect(patchProjectStyle(store, files, target.identity, 'padding', '24px').success).toBe(false)
    expect(patchProjectStyle(store, files, target.identity, 'padding', '24px', { scope: 'source' }).success).toBe(true)
  })
  it('patches CSS Modules at their real source declaration', () => {
    const { files, store } = setup()
    files.set('src/App.tsx', 'import styles from "./card.module.css"; export default () => <main className={styles.card} />')
    files.set('src/card.module.css', '/* retained */ .card { padding: 16px; color: red }')
    const target = analyzeProjectStyles(files, true).targets[0]
    expect(target.styleOrigins[0].kind).toBe('css-module')
    const result = patchProjectStyle(store, files, target.identity, 'padding', '24px')
    expect(result.success).toBe(true); expect(result.file).toBe('src/card.module.css'); expect(files.get(result.file)).toContain('/* retained */ .card { padding: 24px; color: red }')
  })
  it('recognizes a simple class outranks an ordinary tag selector', () => {
    const { files, store, target } = setup('<main className="card" />', 'main {padding:8px} .card {padding:16px}')
    expect(patchProjectStyle(store, files, target.identity, 'padding', '24px', { scope: 'source' }).success).toBe(true)
  })
  it('patches only a literal inline value and handles inline precedence conservatively', () => {
    const { files, store, target } = setup('<main style={{ padding: 16, width: "100%" }} />')
    expect(patchProjectStyle(store, files, target.identity, 'padding', '24').success).toBe(true)
    expect(files.get('src/App.tsx')).toContain('style={{ padding: 24, width: "100%" }}')
  })
  it.each(['runtimeClass', 'flag ? "gap-4" : "gap-8"', 'getClasses()'])('does not guess dynamic class %s', value => {
    const { files, store, target } = setup(`<main className={${value}} />`), before = new Map(files)
    expect(patchProjectStyle(store, files, target.identity, 'gap', '24px').success).toBe(false); expect(files).toEqual(before)
  })
  it.each(['.card.active {padding:32px}', '.card {padding:32px!important}', '@supports (display:grid) {.card {padding:32px}}', '@supports (display:grid) {@media (min-width:1px) {.card {padding:32px}}}', '.card {padding-left:32px}'])('refuses overridden/ambiguous CSS: %s', override => {
    const { files, store, target } = setup('<main className="card" />', `.card {padding:16px} ${override}`)
    expect(patchProjectStyle(store, files, target.identity, 'padding', '24px', { scope: 'source' }).success).toBe(false)
  })
  it('traces local const object/array literals to exact tokens with shared scope', () => {
    const { files, store } = setup()
    files.set('src/App.tsx', 'const values = { space: ["gap-4"] }; export default () => <main><div className={values.space[0]}/><div className={values.space[0]}/></main>')
    const target = analyzeProjectStyles(files, true).targets[1]
    expect(target.styleOrigins[0].usageCount).toBe(2)
    expect(patchProjectStyle(store, files, target.identity, 'gap', '24px').success).toBe(false)
    const result = patchProjectStyle(store, files, target.identity, 'gap', '24px', { scope: 'source' })
    expect(result.success).toBe(true); expect(files.get('src/App.tsx')).toContain('const values = { space: ["gap-6"] }')
  })
  it('does not trace mutable, shadowed, cyclic or mutated object values', () => {
    for (const code of ['let spacing="gap-4";', 'const spacing=spacing;', 'const spacing={gap:"gap-4"}; spacing.gap="gap-8";', 'const spacing="gap-4"; function X(spacing:string){}']) {
      const { files } = setup(); files.set('src/App.tsx', `${code} export default ()=><main className={spacing}/>`)
      expect(analyzeProjectStyles(files, true).targets.find(item => item.elementName === 'main')?.styleOrigins).toHaveLength(0)
    }
  })
  it.each([
    'const spacing={gap:"gap-4"}; spacing.gap="gap-8";',
    'const spacing={gap:"gap-4"}; const alias=spacing; alias.gap="gap-8";',
    'const spacing={gap:"gap-4"}; delete spacing.gap;',
    'export const spacing={gap:"gap-4"};',
    'const spacing={gap:"gap-4"}; mutate(spacing);',
  ])('refuses mutable object property origins: %s', declaration => {
    const { files } = setup(); files.set('src/App.tsx', `${declaration} export default ()=><main className={spacing.gap}/>`)
    expect(analyzeProjectStyles(files, true).targets.find(item => item.elementName === 'main')?.styleOrigins).toHaveLength(0)
  })
  it('retains unknown/arbitrary/state tokens without claiming they can be directly edited', () => {
    const { files, store, target, analysis } = setup('<main className="gap-4 hover:gap-8 p-[17px] brand-card"/>')
    expect(analysis().targets[0].styleOrigins.find(item => item.prefix === 'hover:')?.editable).toBe(false)
    const before = new Map(files); expect(patchProjectStyle(store, files, target.identity, 'gap', '24px').success).toBe(false); expect(files).toEqual(before)
  })
  it.each([['gap-4 gap-x-8', 'gap'], ['p-4 pl-8', 'padding'], ['m-4 mx-8', 'margin']])('refuses unsupported overlapping utilities %s', (classes, property) => {
    const { files, store, target } = setup(`<main className="${classes}"/>`)
    expect(patchProjectStyle(store, files, target.identity, property as StyleProperty, '24px').success).toBe(false)
  })
  it.each([['gap:16px; column-gap:32px', 'gap'], ['border:1px solid red; border-color:blue', 'border']])('refuses overlapping CSS longhands %s', (declarations, property) => {
    const { files, store, target } = setup('<main className="card"/>', `.card {${declarations}}`)
    expect(patchProjectStyle(store, files, target.identity, property as StyleProperty, '24px', { scope: 'source' }).success).toBe(false)
  })
  it('keeps independent border radius editable beside border width/style', () => {
    const { files, store, target } = setup('<main className="card"/>', '.card {border:1px solid red; border-radius:8px}')
    expect(patchProjectStyle(store, files, target.identity, 'border', '2px solid red', { scope: 'source' }).success).toBe(true)
  })
  it('does not select a matching declaration in an unimported stylesheet', () => {
    const { files, store, target } = setup('<main className="orphan"/>')
    files.set('src/unused.css', '.orphan {padding:16px}')
    expect(patchProjectStyle(store, files, target.identity, 'padding', '24px', { scope: 'source' }).success).toBe(false)
  })
  it('distinguishes root render calls from runtime repeating callbacks', () => {
    const { files } = setup()
    files.set('src/App.tsx', 'export function App(){return <main className="p-4"/>} render(<App/>);')
    expect(analyzeProjectStyles(files, true).targets[0].repeated).toBe(false)
    files.set('src/App.tsx', 'export function App(){return <main className="p-4"/>} items.map(item=><App/>);')
    expect(analyzeProjectStyles(files, true).targets[0].repeated).toBe(true)
  })
  it('exposes known inherited typography without mutating the child', () => {
    const { files, store, analysis } = setup('<main style={{ color: "red" }}><p>Child</p></main>')
    const child = analysis().targets[1]
    expect(child.styleOrigins.find(item => item.property === 'color')?.kind).toBe('inherited')
    expect(patchProjectStyle(store, files, child.identity, 'color', 'blue').success).toBe(false)
  })
  it('invalidates dependency content and never returns mutable cached analysis', () => {
    const { files, analysis } = setup('<main className="card"/>', '.card {padding:16px}')
    analysis().targets[0].styleOrigins[0].value = 'poison'
    expect(analysis().targets[0].styleOrigins[0].value).toBe('16px')
    files.set('src/app.css', '.card {padding:32px}')
    expect(analysis().targets[0].styleOrigins[0].value).toBe('32px')
  })
})

describe('Phase 2F semantic source operations', () => {
  it('reorders literal Flex children in JSX, preserves separators, and inverses exact bytes', () => {
    const { files, store, analysis } = setup(), before = files.get('src/App.tsx')!, child = analysis().targets[1]
    const result = patchSiblingReorder(store, files, child.identity, 'next')
    expect(result.success).toBe(true); expect(files.get('src/App.tsx')).toContain('<p>Two</p>\n<p>One</p>')
    expect(undoTransaction(store, result)).toBe(true); expect(files.get('src/App.tsx')).toBe(before)
  })
  it.each([['flexDirection', 'column', 'flex-col'], ['alignItems', 'stretch', 'items-stretch'], ['gap', '24px', 'gap-6']] as const)('edits Flex %s as a semantic utility', (property, value, token) => {
    const { files, store, target } = setup()
    expect(patchProjectStyle(store, files, target.identity, property, value, { semantic: true }).success).toBe(true); expect(files.get('src/App.tsx')).toContain(token)
  })
  it.each([
    ['display', 'block', 'flex', 'block'],
    ['minWidth', '32px', 'min-w-4', 'min-w-8'],
    ['lineHeight', '1.5', 'leading-tight', 'leading-normal'],
    ['letterSpacing', '0.05em', 'tracking-tight', 'tracking-wider'],
    ['border', '2px', 'border', 'border-2'],
  ])('mutates supported %s without rewriting other tokens', (property, value, token, replacement) => {
    const { files, store, target } = setup(`<main className="${token} brand-card"/>`)
    expect(patchProjectStyle(store, files, target.identity, property as StyleProperty, value).success).toBe(true)
    expect(files.get('src/App.tsx')).toContain(`className="${replacement} brand-card"`)
  })
  it('edits Grid tracks and placement and supports adjacent source order', () => {
    const { files, store, target, analysis } = setup('<main className="grid grid-cols-2 grid-rows-2 gap-4"><p className="col-start-1">One</p><p>Two</p></main>')
    expect(patchProjectStyle(store, files, target.identity, 'gridTemplateColumns', '3', { semantic: true }).success).toBe(true)
    const child = analysis().targets[1]
    expect(patchProjectStyle(store, files, child.identity, 'gridColumn', '2', { semantic: true }).success).toBe(true)
    expect(patchSiblingReorder(store, files, analysis().targets[1].identity, 'next').success).toBe(true)
    expect(files.get('src/App.tsx')).toContain('grid-cols-3')
  })
  it.each(['<main><p>One</p><p>Two</p></main>', '<main className="flex"><p>One</p>{/* keep with next */}<p>Two</p></main>', '<main className="flex">{items.map(x=><p>{x}</p>)}</main>'])('refuses unsafe reorder without coordinates or guessed layout', jsx => {
    const { files, store, analysis } = setup(jsx), before = new Map(files), target = analysis().targets.find(item => item.elementName === 'p')!
    expect(patchSiblingReorder(store, files, target.identity, 'next').success).toBe(false); expect(files).toEqual(before)
  })
})

async function apiSetup() {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'wcb-2f-test-'))); directories.push(directory)
  fs.cpSync(path.join(process.cwd(), 'fixtures/compatible-react-vite'), path.join(directory, 'fixtures/compatible-react-vite'), { recursive: true })
  const registry = new ProjectRegistry(directory), durable = registry.durable('phase1-fixture'), session = registry.createSession('phase1-fixture')!
  const server = await createServer({ configFile: false, root: process.cwd(), cacheDir: path.join(directory, 'cache'), plugins: [webCanBeFixturePlugin(process.cwd(), { registry, editorKey: 'synthetic-2f-key' })], server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' }); servers.push(server); await server.listen()
  const origin = `http://127.0.0.1:${(server.httpServer!.address() as { port: number }).port}`
  const request = async (action: string, body: Record<string, unknown> = {}) => { const response = await fetch(`${origin}/__webcanbe/api/projects/phase1-fixture/${action}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'X-WCB-Editor-Key': 'synthetic-2f-key' }, body: JSON.stringify({ ...session, ...body }) }); return { status: response.status, data: await response.json() } }
  return { directory, registry, durable, request }
}
describe('Phase 2F authorized Code / Visual / durable revision integration', () => {
  it('reanalyzes Code responsive source, rejects stale anchors, and persists responsive history/undo across restart', async () => {
    const { directory, durable, request } = await apiSetup(), file = 'src/App.tsx'
    const code = 'export function App(){return <main className="flex gap-4 md:gap-8 lg:gap-12"><p>One</p><p>Two</p></main>}'
    const saved = await request('code', { expectedRevision: durable.revision(), idempotencyKey: randomUUID(), operations: [{ kind: 'update', file, content: code, expectedHash: contentHash(durable.files().get(file)!) }] })
    expect(saved.status, JSON.stringify(saved.data)).toBe(200)
    const analyzed = await request('compatibility', { viewport: 'tablet' }), target = analyzed.data.targets.find((item: { elementName: string }) => item.elementName === 'main')
    expect(target.styleOrigins.find((item: { property: StyleProperty; effective: boolean }) => item.property === 'gap' && item.effective).value).toBe('md:gap-8')
    const edit = { identity: target.identity, expectedRevision: durable.revision(), idempotencyKey: randomUUID(), edit: { type: 'responsive', property: 'gap', value: '40px', breakpoint: 'tw:md', viewport: 'tablet' } }
    const result = await request('mutate', edit); expect(result.status, JSON.stringify(result.data)).toBe(200)
    expect((await request('mutate', edit)).data.replayed).toBe(true)
    expect((await request('files', { file })).data.source).toContain('gap-4 md:gap-10 lg:gap-12')
    const stale = await request('mutate', { ...edit, expectedRevision: durable.revision(), idempotencyKey: randomUUID() }); expect(stale.status).toBe(409)
    const reopened = new ProjectRegistry(directory).durable('phase1-fixture')
    expect(reopened.revision()).toBe(result.data.revision); expect(reopened.history().transactions.at(-1)?.editType).toBe('responsive')
    const undo = await request('undo', { expectedRevision: durable.revision(), idempotencyKey: randomUUID() }); expect(undo.status).toBe(200)
    expect(new ProjectRegistry(directory).durable('phase1-fixture').files().get(file)).toBe(code)
    const next = await request('compatibility'), child = next.data.targets.find((item: { text: string }) => item.text === 'One')
    const reorder = await request('mutate', { identity: child.identity, expectedRevision: durable.revision(), idempotencyKey: randomUUID(), edit: { type: 'reorder', value: 'next', scope: 'source' } }); expect(reorder.status, JSON.stringify(reorder.data)).toBe(200)
    expect(new ProjectRegistry(directory).durable('phase1-fixture').files().get(file)).toContain('<p>Two</p><p>One</p>')
    expect((await request('undo', { expectedRevision: durable.revision(), idempotencyKey: randomUUID() })).status).toBe(200)
    expect(durable.files().get(file)).toBe(code)
    const exported = await request('export', { expectedRevision: durable.revision() }); expect(exported.status).toBe(200); expect(exported.data.archive).toBeTruthy()
  }, 15000)
})
