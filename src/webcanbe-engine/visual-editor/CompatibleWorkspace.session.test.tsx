// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import CompatibleWorkspace from './CompatibleWorkspace'

vi.mock('../../app-shell', () => ({ OnboardingStrip: () => null }))
vi.mock('./EditorChrome', () => ({ EditorToolbar: () => null, EditorNavigation: () => null }))
vi.mock('./AiWorkspacePanel', () => ({ default: () => null }))
vi.mock('./AiListbox', () => ({ default: () => null }))
vi.mock('./SourceGestures', () => ({ default: () => null }))

afterEach(() => { vi.unstubAllGlobals() })

it('does not show a stale session failure after a newer connection attempt', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const pending: Array<(response: Response) => void> = []
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => pending.push(resolve))))
  window.history.replaceState({}, '', '/workspace/project-a')
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const connect = async (key: string) => {
    await act(async () => {
      const input = host.querySelector<HTMLInputElement>('input[aria-label="Local editor access key"]')!
      input.value = key
      host.querySelector<HTMLButtonElement>('.project-settings-connect')!.click()
    })
  }
  try {
    await act(async () => root.render(<CompatibleWorkspace />))
    await connect('first-key')
    expect(pending).toHaveLength(1)
    await connect('second-key')
    expect(pending).toHaveLength(2)
    await act(async () => pending[1](new Response(JSON.stringify({ error: 'Current project error' }), { status: 403, headers: { 'content-type': 'application/json' } })))
    expect(host.querySelector('[role="status"]')?.textContent).toBe('Current project error')
    await act(async () => pending[0](new Response(JSON.stringify({ error: 'Old project error' }), { status: 403, headers: { 'content-type': 'application/json' } })))
    expect(host.querySelector('[role="status"]')?.textContent).toBe('Current project error')
  } finally {
    await act(async () => root.unmount())
    host.remove()
  }
})
