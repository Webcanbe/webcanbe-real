// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { EditorView } from '@codemirror/view'
import { afterEach, expect, it, vi } from 'vitest'
import CompatibleWorkspace from './webcanbe-engine/visual-editor/CompatibleWorkspace'

afterEach(() => vi.unstubAllGlobals())

it.each(['after Code response', 'before Code response'])('keeps rendered Code rev_2 and Export rev_2 when delayed AI rev_1 arrives %s and follow-up reads fail', async order => {
  window.history.replaceState({}, '', '/workspace/northstar?mode=canvas')
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0))
  vi.stubGlobal('cancelAnimationFrame', clearTimeout)
  URL.createObjectURL = () => 'blob:test-preview'; URL.revokeObjectURL = () => {}
  const rect = () => ({ left: 0, top: 0, right: 300, bottom: 30, width: 300, height: 30, x: 0, y: 0, toJSON() {} })
  Range.prototype.getBoundingClientRect = rect
  Range.prototype.getClientRects = (() => []) as unknown as typeof Range.prototype.getClientRects
  let revision = 'rev_0', source = 'export default () => <main>Original</main>', exportRevision = '', failReads = false
  const transactions: Array<{ producer: string; revision: string }> = []
  const previews: string[] = []
  let releaseAi: (() => void) | undefined
  let releaseCode: (() => void) | undefined
  const answer = (data: unknown, status = 200) => Promise.resolve({ ok: status === 200, status, headers: new Headers({ 'content-type': 'application/json' }), json: async () => data } as Response)
  vi.stubGlobal('fetch', vi.fn((url: string, init: RequestInit) => {
    const action = url.split('/').at(-1), body = JSON.parse(String(init.body))
    if (action === 'session') return answer({ session: { previewId: 'preview', capability: 'capability' }, revision, project: { id: 'phase1-fixture', name: 'Race fixture', detection: { tailwind: false } } })
    if (action === 'compatibility') return failReads ? answer({ error: 'Injected read failure' }, 503) : answer({ revision, targets: [], breakpoints: [], summary: { score: 100, full: 1, partial: 0, codeOnly: 0 } })
    if (action === 'preview') { if (failReads) return answer({ error: 'Injected read failure' }, 503); previews.push(revision); return answer({ revision, transport: 'blob', generation: revision, html: '<main>preview</main>' }) }
    if (action === 'files') return answer({ revision, files: [{ file: 'src/App.tsx', hash: revision }], ...(body.file ? { source } : {}) })
    if (action === 'history') return answer({ revision, history: { transactions: [], revisions: [], past: [], future: [] } })
    if (action === 'drafts') return answer({ draftState: { version: 0, drafts: [] } })
    if (action === 'validate') return answer({ revision, validation: { passed: true, level: 'parse', diagnostics: [] } })
    if (action === 'ai') {
      const proposal = { summary: 'Update heading', operations: [{ kind: 'update', file: 'src/App.tsx', expectedHash: 'rev_0', content: 'export default () => <main>AI</main>' }] }
      if (!body.apply) return answer({ state: 'ready_to_review', cost: 1, contextFiles: ['src/App.tsx'], proposal, result: { applied: false, revision } })
      revision = 'rev_1'; source = proposal.operations[0].content; transactions.push({ producer: 'ai', revision })
      return new Promise<Response>(resolve => { releaseAi = () => { void answer({ state: 'done', cost: 1, contextFiles: ['src/App.tsx'], proposal, result: { applied: true, revision: 'rev_1' } }).then(resolve) } })
    }
    if (action === 'code') {
      expect(body.expectedRevision).toBe('rev_1')
      revision = 'rev_2'; source = body.operations[0].content; transactions.push({ producer: 'code', revision })
      const result = { revision, transaction: { success: true, versions: { 'src/App.tsx': { after: revision } } } }
      if (order === 'before Code response') return new Promise<Response>(resolve => { releaseCode = () => { void answer(result).then(resolve) } })
      return answer(result)
    }
    if (action === 'export') { exportRevision = body.expectedRevision; return answer({ revision, error: 'No archive needed for request assertion' }) }
    throw new Error(`Unexpected fixture request: ${action}`)
  }))
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host)
  const button = (text: string) => [...host.querySelectorAll('button')].find(element => element.textContent === text)!
  const click = async (text: string) => { expect(button(text)).toBeTruthy(); await act(async () => button(text).click()) }
  const flushUntil = async (check: () => void) => { await vi.waitFor(async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) }); check() }, { timeout: 5000 }) }
  try {
    await act(async () => root.render(<CompatibleWorkspace />));
    (host.querySelector('[aria-label="Local editor access key"]') as HTMLInputElement).value = 'fixture-key'
    await click('Connect / renew session')
    await flushUntil(() => expect(host.querySelector('iframe')?.getAttribute('srcdoc')).toBe('<main>preview</main>'))
    expect(host.querySelector('main')?.getAttribute('data-source-revision')).toBe('rev_0')
    expect(host.querySelector('iframe')?.getAttribute('sandbox')).toBe('allow-scripts')
    expect(host.querySelector('iframe')?.getAttribute('srcdoc')).toBe('<main>preview</main>')
    await click('Canvas')
    await click('Code')
    await flushUntil(() => expect(host.querySelector('.cm-content')?.textContent).toContain('Original'))
    await click('Agent')
    await act(async () => {
      const prompt = host.querySelector('.ai-prompt textarea') as HTMLTextAreaElement
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(prompt, 'Change heading')
      prompt.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await click('Generate proposal')
    await flushUntil(() => expect(button('Apply to source')).toBeTruthy())
    await click('Apply to source')
    expect(revision).toBe('rev_1')
    await click('Refresh accepted')
    await flushUntil(() => expect(host.querySelector('.cm-content')?.textContent).toContain('>AI<'))
    await act(async () => {
      const view = EditorView.findFromDOM(host.querySelector('.cm-editor') as HTMLElement)!
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: 'export default () => <main>Code rev_2</main>' } })
    })
    await click('Save source')
    if (order === 'after Code response') await flushUntil(() => { expect(previews).toContain('rev_2'); expect(host.querySelector('main')?.getAttribute('data-source-revision')).toBe('rev_2') })
    failReads = true
    await act(async () => releaseAi!())
    await flushUntil(() => expect(host.querySelector('.ai-phase')?.textContent).toBe('Done'))
    if (releaseCode) await act(async () => releaseCode!())
    await flushUntil(() => expect(host.querySelector('main')?.getAttribute('data-source-revision')).toBe('rev_2'))
    expect(host.querySelector('.cm-content')?.textContent).toContain('Code rev_2')
    expect(host.querySelector('main')?.getAttribute('data-source-revision')).toBe('rev_2')
    await click('Export')
    await click('Download ZIP')
    expect(exportRevision).toBe('rev_2')
    expect(transactions).toEqual([{ producer: 'ai', revision: 'rev_1' }, { producer: 'code', revision: 'rev_2' }])
  } finally { await act(async () => root.unmount()); host.remove() }
})
