// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { advanceOnboarding, appRoutes, dismissOnboarding, finishAuthIntent, onboardingState, viewForPath } from './shellState'
import { hostedProductClient } from './hostedProductClient'
vi.mock('./hostedProductClient', () => ({ productionAuthMode: () => true, hostedProductClient: { account: vi.fn() } }))
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks() })
describe('app route identity and first signup onboarding', () => {
  it('assigns a distinct refreshable path to every sidebar page', () => {
    const routes=Object.entries(appRoutes)
    expect(new Set(routes.map(([,value])=>value[0])).size).toBe(15)
    for(const [view,[path]] of routes) expect(viewForPath(path)).toBe(view)
  })
  it('sends sign-in to Dashboard while retaining an explicit protected return', async () => {
    vi.mocked(hostedProductClient.account).mockResolvedValue({ userId:'old', createdAt:'2020-01-01' } as never)
    expect(await finishAuthIntent(false, Date.now(), '/dashboard')).toBe('/dashboard')
    expect(await finishAuthIntent(false, Date.now(), '/checkout/release')).toBe('/checkout/release')
    expect(onboardingState()).toBeNull()
  })
  it('starts only a new signup and advances only through accepted project milestones', async () => {
    const now=Date.now();vi.mocked(hostedProductClient.account).mockResolvedValue({ userId:'new', createdAt:new Date(now).toISOString() } as never)
    expect(await finishAuthIntent(true, now, '/dashboard')).toBe('/marketplace')
    expect(onboardingState()?.step).toBe(0)
    advanceOnboarding(3,'p');expect(onboardingState()?.step).toBe(0)
    advanceOnboarding(1,'p');advanceOnboarding(2,'other');expect(onboardingState()?.step).toBe(1)
    advanceOnboarding(2,'p');advanceOnboarding(3,'p');expect(onboardingState()?.step).toBe(3)
    await finishAuthIntent(true,now,'/dashboard');expect(onboardingState()?.step).toBe(3)
  })
  it('does not onboard an existing account that chooses sign up', async () => {
    vi.mocked(hostedProductClient.account).mockResolvedValue({ userId:'old', createdAt:'2020-01-01' } as never)
    expect(await finishAuthIntent(true,Date.now(),'/dashboard')).toBe('/marketplace');expect(onboardingState()).toBeNull()
  })
  it('persists dismissal, and keeps progress separate between accounts', async () => {
    const now=Date.now();vi.mocked(hostedProductClient.account).mockResolvedValue({ userId:'new', createdAt:new Date(now).toISOString() } as never)
    await finishAuthIntent(true,now,'/dashboard');dismissOnboarding();expect(onboardingState()?.dismissed).toBe(true)
    await finishAuthIntent(false,now,'/dashboard');expect(onboardingState()?.dismissed).toBe(true)
    vi.mocked(hostedProductClient.account).mockResolvedValue({ userId:'other', createdAt:'2020-01-01' } as never)
    await finishAuthIntent(false,now,'/dashboard');expect(onboardingState()).toBeNull()
  })
})
