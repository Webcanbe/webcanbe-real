import { afterEach, expect, it } from 'vitest'
import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { cssCompiler, cssData, inspectCssPlan, type CssPlan } from './runtime/staticCss'
import { CSS_WORKER_SOURCE } from './runtime/cssWorkerSource'
import { inspectRuntime } from './runtime/runtimeCompatibility'
import { buildIsolatedHttpPreview } from './runtime/isolatedPreview'
import { exportProjectZip } from './runtime/projectExport'
import { detectProject, extractSafeZip, type ProjectRecord } from './runtime/projectRegistry'
import { MutationHistory } from './mutations/sourceMutations'
import { normalizeAlternateLock, parseYarnClassic } from './runtime/alternateLockfiles'

const roots: string[] = []
const temporary = (name: string) => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `wcb-forms-${name}-`)))
  roots.push(root)
  return root
}
afterEach(() => { while (roots.length) fs.rmSync(roots.pop()!, { recursive: true, force: true }) })

const formsPlan: CssPlan = {
  kind: 'unocss',
  files: ['uno.config.ts'],
  config: {
    presets: [
      { adapter: 'presetUno', options: { dark: 'media' } },
      { adapter: 'presetAttributify', options: {} },
      { adapter: 'presetForms', options: {} },
    ],
    transformers: [
      { adapter: 'transformerDirectives', options: {} },
      { adapter: 'transformerVariantGroup', options: {} },
    ],
  },
}

async function generatedFormsCss(classes = '') {
  const root = temporary('semantic')
  fs.mkdirSync(path.join(root, 'src'))
  fs.writeFileSync(path.join(root, 'index.html'), `<input class="form-input form-checkbox form-radio" type="text"><textarea></textarea><select><option>one</option></select><input type="file"><div class="${classes}"></div>`)
  fs.writeFileSync(path.join(root, 'src/main.ts'), 'export const finite = true')
  fs.writeFileSync(path.join(root, 'uno.config.ts'), 'operator parsed data')
  const compile = await cssCompiler(root, path.join(process.cwd(), 'runtime-profiles/react19-vite6-uno-v1'), formsPlan)
  return compile('/* webcanbe uno entry */')
}

it('reproduces the forms1 input, textarea, select and placeholder preflight semantics under UnoCSS 66', async () => {
  const css = await generatedFormsCss('form-input form-textarea form-select form-multiselect')
  expect(css).toContain("[type='text'], input:where(:not([type]))")
  expect(css).toContain('textarea, select { appearance: none;')
  expect(css).toContain('padding-top: 0.5rem;')
  expect(css).toContain('padding-right: 0.75rem;')
  expect(css).toContain('input::placeholder, textarea::placeholder { color: #6b7280;')
  expect(css).toContain('select { background-image: url("data:image/svg+xml')
  expect(css).toContain('background-position: right 0.5rem center;')
  expect(css).toContain('padding-right: 2.5rem;')
  expect(css).toContain('.form-select{appearance:none')
})

it('reproduces the forms1 checkbox, radio and file-input semantics under UnoCSS 66', async () => {
  const css = await generatedFormsCss('form-checkbox form-radio')
  expect(css).toContain("[type='checkbox'], [type='radio'] { appearance: none;")
  expect(css).toContain('height: 1rem;')
  expect(css).toContain("[type='checkbox']:checked { background-image: url(")
  expect(css).toContain("[type='radio']:checked { background-image: url(")
  expect(css).toContain("[type='checkbox']:indeterminate")
  expect(css).toContain("[type='file'] { background: unset;")
  expect(css).toContain('outline: 1px solid ButtonText , 1px auto -webkit-focus-ring-color;')
  expect(css).toContain('.form-checkbox{appearance:none')
  expect(css).toContain('.form-radio{appearance:none')
})

it('accepts only zero-argument presetForms and contains no third-party forms import in the worker', () => {
  const valid = `import {defineConfig,presetUno} from 'unocss';import {presetForms} from '@julr/unocss-preset-forms';export default defineConfig({presets:[presetUno(),presetForms()]})`
  expect(cssData(valid, 'unocss').presets[1]).toEqual({ adapter: 'presetForms', options: {} })
  for (const argument of ['{}', "{strategy:'base'}", 'undefined', '()=>({})']) {
    expect(() => cssData(valid.replace('presetForms()', `presetForms(${argument})`), 'unocss')).toThrow('zero-argument')
  }
  expect(CSS_WORKER_SOURCE).toContain('fixedUnoFormsV1Preset()')
  expect(CSS_WORKER_SOURCE).not.toContain("trusted('@julr/unocss-preset-forms')")
  expect(CSS_WORKER_SOURCE).not.toContain('forms.presetForms')
})

it('requires the declared forms marker and a supported pinned Uno operator profile', () => {
  const root = temporary('plan')
  fs.writeFileSync(path.join(root, 'uno.config.ts'), `import {defineConfig,presetUno} from 'unocss';import {presetForms} from '@julr/unocss-preset-forms';export default defineConfig({presets:[presetUno(),presetForms()]})`)
  expect(() => inspectCssPlan(root, { unocss: '^66.0.0' }, 'react19-vite6-uno-v1')).toThrow('declared forms1 marker')
  expect(() => inspectCssPlan(root, { unocss: '^66.0.0', '@julr/unocss-preset-forms': '^1.0.0' }, 'react19-vite6')).toThrow('pinned UnoCSS')
})

it('keeps peer validation strict for packages that remain executable', () => {
  const integrity = 'sha512-' + Buffer.alloc(64, 7).toString('base64')
  const lock = parseYarnClassic(`# yarn lockfile v1
"plugin@1.0.0":
  version "1.0.0"
  resolved "https://registry.npmjs.org/plugin/-/plugin-1.0.0.tgz"
  integrity ${integrity}
"host@2.0.0":
  version "2.0.0"
  resolved "https://registry.npmjs.org/host/-/host-2.0.0.tgz"
  integrity ${integrity}
`)
  const manifest = { dependencies: { plugin: '1.0.0', host: '2.0.0' } }
  const profile = { packages: {
    'node_modules/plugin': { version: '1.0.0', integrity, peerDependencies: { host: '1.0.0' } },
    'node_modules/host': { version: '2.0.0', integrity },
  } }
  expect(() => normalizeAlternateLock(lock, manifest, profile, ['plugin', 'host'])).toThrow()
})

const todo = process.env.WCB_P05_TODO ? it : it.skip
function todoProject(root: string): ProjectRecord {
  const detection = detectProject(root, process.cwd())
  return { id: randomUUID(), name: 'Todo exact', root: fs.realpathSync(root), sourceRoot: path.join(root, detection.sourceDirectory ?? 'src'), imported: true, detection, history: new MutationHistory() }
}
function treeDigest(root: string) {
  const hash = createHash('sha256')
  const walk = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name), relative = path.relative(root, absolute).split(path.sep).join('/')
      if (entry.isDirectory()) walk(absolute)
      else { hash.update(relative); hash.update('\0'); hash.update(fs.readFileSync(absolute)); hash.update('\0') }
    }
  }
  walk(root)
  return hash.digest('hex')
}

todo('admits, compiles and byte-preserves the exact frozen Todo app without running preinstall', async () => {
  const root = fs.realpathSync(process.env.WCB_P05_TODO!), before = treeDigest(root)
  const publicValues = { VITE_API_URL: 'https://api.todo.example' }
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  expect(manifest.scripts.preinstall).toBe('npx only-allow bun')
  const report = inspectRuntime(todoProject(root), process.cwd(), publicValues)
  expect({ profile: report.profile, issues: report.issues }).toEqual({ profile: 'react19-vite6-uno66-forms-v1', issues: [] })
  expect(report.dependencies.find(item => item.name === '@julr/unocss-preset-forms')).toMatchObject({ declared: '^1.0.0' })
  expect(report.notes.some(note => note.includes('configuration marker only'))).toBe(true)
  const preview = await buildIsolatedHttpPreview(todoProject(root), process.cwd(), undefined, publicValues)
  expect(preview.files.has('/_wcb/app.js')).toBe(true)
  const css = preview.files.get('/_wcb/app.css')!.body.toString()
  expect(css).toContain('[type=checkbox]')
  expect(css).toContain('[type=file]')
  expect(treeDigest(root)).toBe(before)
  expect(fs.existsSync(path.join(root, 'node_modules'))).toBe(false)
  const exported = path.join(os.tmpdir(), `wcb-forms-export-${randomUUID()}`)
  roots.push(exported)
  await extractSafeZip(await exportProjectZip(todoProject(root)), exported)
  expect(treeDigest(exported)).toBe(before)
  expect(fs.readFileSync(path.join(exported, 'bun.lockb'))).toEqual(fs.readFileSync(path.join(root, 'bun.lockb')))
  expect(fs.readFileSync(path.join(exported, 'package.json'))).toEqual(fs.readFileSync(path.join(root, 'package.json')))
  expect(fs.readFileSync(path.join(exported, 'uno.config.ts'))).toEqual(fs.readFileSync(path.join(root, 'uno.config.ts')))
}, 35_000)

todo('refuses missing, substituted and unsupported-version forms markers', () => {
  const exact = fs.realpathSync(process.env.WCB_P05_TODO!)
  for (const value of [undefined, 'npm:other-package@1.0.0', '^2.0.0']) {
    const root = temporary('marker')
    fs.cpSync(exact, root, { recursive: true })
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
    if (value === undefined) delete manifest.devDependencies['@julr/unocss-preset-forms']
    else manifest.devDependencies['@julr/unocss-preset-forms'] = value
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(manifest, null, 2) + '\n')
    const report = inspectRuntime(todoProject(root), process.cwd())
    expect(report.issues.some(issue => issue.code === 'css-config' || issue.code === 'lock-conflict')).toBe(true)
  }
})
