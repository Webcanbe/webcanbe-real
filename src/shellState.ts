import { hostedProductClient, productionAuthMode } from './hostedProductClient'

export const appRoutes = {
  overview: ['/dashboard', 'Dashboard'], projects: ['/projects', 'My projects'],
  marketplace: ['/marketplace', 'Marketplace'], purchases: ['/purchases', 'Purchases'],
  'source-visual': ['/editor/visual', 'Visual editor'], 'source-code': ['/editor/code', 'Code editor'],
  'source-split': ['/editor/split', 'Split view'],
  workspace: ['/workspace', 'Workspace'], docs: ['/app/docs', 'Documentation'],
  settings: ['/profile', 'Profile'], account: ['/account', 'Account'], billing: ['/billing', 'Billing'],
  notifications: ['/notifications', 'Notifications'], help: ['/help', 'Help Center'],
} as const
export type DashboardView = keyof typeof appRoutes
export function viewForPath(path: string): DashboardView {
  return (Object.keys(appRoutes) as DashboardView[]).find(key => appRoutes[key][0] === path) ?? (path === '/settings' ? 'settings' : 'overview')
}
export function readLocal<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback } catch { return fallback }
}
export function writeLocal(key: string, value: unknown) { localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new Event('wcb:shell-state')) }
export type Onboarding = { step: 0 | 1 | 2 | 3; dismissed?: boolean; projectId?: string }
function onboardingKey() { try { const user = sessionStorage.getItem('wcb-onboarding-user'); return user ? `wcb-onboarding:${user}` : '' } catch { return '' } }
export function onboardingState(): Onboarding | null { const key = onboardingKey(); return key ? readLocal<Onboarding | null>(key, null) : null }
export function advanceOnboarding(step: 1 | 2 | 3, projectId: string) {
  const state = onboardingState(), key = onboardingKey()
  if (!state || !key || state.step >= step || (step > 1 && state.projectId !== projectId)) return
  // Opening a working copy, accepting an edit, and exporting are distinct milestones.
  if (step > state.step + 1) return
  try { writeLocal(key, { ...state, step, projectId }) } catch { /* Browser preference only. */ }
}
export function dismissOnboarding() { const key = onboardingKey(), state = onboardingState(); if (key && state) { try { writeLocal(key, { ...state, dismissed: true }) } catch {} } }
export async function finishAuthIntent(signup: boolean, startedAt: number, next: string) {
  try {
    const account = productionAuthMode() ? await hostedProductClient.account() : { userId: 'demo', createdAt: new Date(startedAt).toISOString() }
    sessionStorage.setItem('wcb-onboarding-user', account.userId)
    const key = `wcb-onboarding:${account.userId}`
    if (signup && Date.parse(account.createdAt) >= startedAt - 10000 && !readLocal(key, null)) writeLocal(key, { step: 0 })
  } catch { /* Auth success does not depend on onboarding preference storage. */ }
  return signup ? '/marketplace' : next === '/' || next === '/browse' || next === '/templates' ? '/dashboard' : next
}
export function workspaceLabel(id: string, index: number, projectName?: string) { return projectName?.trim() || (id === "personal" ? "Personal workspace" : `Workspace ${index + 1}`) }
