import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Archive, FolderKanban, Store, ShoppingBag, Sparkles, PanelsTopLeft, Columns2, FileCode2, BookOpen, Settings2, UserCircle2, CreditCard, Bell, CircleHelp, ChevronsUpDown, Plus, Search, X, LogOut, Check, ArrowRight, Grid2X2 } from 'lucide-react'
import { hostedProductClient, productionAuthMode, type AccountData } from './hostedProductClient'
import { appRoutes, type DashboardView, readLocal, writeLocal, onboardingState, dismissOnboarding, workspaceLabel } from './shellState'
import { analytics } from './analytics'

type Navigate = (path: string) => void
export function AppLink({ to, navigate, children, className }: { to: string; navigate: Navigate; children: ReactNode; className?: string }) {
  return <a href={to} className={className} onClick={event => { if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); navigate(to) }}>{children}</a>
}
export function useAccount() {
  const [account, setAccount] = useState<Partial<AccountData>>(() => productionAuthMode() ? {} : readLocal('wcb-demo-profile', { displayName: 'Your account', email: '' }))
  const [error, setError] = useState('')
  useEffect(() => {
    let current = true
    const refresh = () => {
      if (!productionAuthMode()) { setAccount(readLocal('wcb-demo-profile', { displayName: 'Your account' })); return }
      void hostedProductClient.account().then(value => { if (current) { setAccount(value); setError(''); analytics.identify(value.userId, { account_creation_state: 'complete', auth_provider_names: value.providers }); try { sessionStorage.setItem('wcb-onboarding-user', value.userId); window.dispatchEvent(new Event('wcb:shell-state')) } catch {} } }, reason => { if (current) setError(reason instanceof Error ? reason.message : 'Account unavailable') })
    }
    refresh(); window.addEventListener('wcb:profile-updated', refresh)
    return () => { current = false; window.removeEventListener('wcb:profile-updated', refresh) }
  }, [])
  return { account, error, setAccount }
}
export function Avatar({ account }: { account: Partial<AccountData> }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [account.picture])
  const initials = (account.displayName || 'Your account').split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase()
  const safePicture = account.picture?.startsWith('https://') ? account.picture : undefined
  return <span className="rd-avatar">{safePicture && !failed ? <img src={safePicture} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)}/> : initials}</span>
}
export function OnboardingStrip({ navigate }: { navigate: Navigate }) {
  const [state, setState] = useState(onboardingState)
  useEffect(() => { const update = () => setState(onboardingState()); window.addEventListener('wcb:shell-state', update); return () => window.removeEventListener('wcb:shell-state', update) }, [])
  if (!state || state.dismissed) return null
  if (state.step === 3) return <section className="wcb-onboarding ready" aria-label="Onboarding completed"><Check/><div><b>Your project is ready.</b><p>You’ve chosen a template, edited its source, and downloaded your project.</p></div><button onClick={dismissOnboarding} aria-label="Dismiss completed onboarding"><X/></button></section>
  const labels = ['Choose a template', 'Edit', 'Download'], descriptions = ['Find a starting point for your idea.', 'Make it yours in Visual or Code.', 'Export the source you own.']
  return <nav className="wcb-onboarding" aria-label="Getting started">{labels.map((label, index) => <button key={label} className={state.step === index ? 'current' : ''} aria-current={state.step === index ? 'step' : undefined} disabled={index > state.step} onClick={() => navigate(index === 0 ? '/marketplace' : state.projectId ? `/workspace/${state.projectId}` : '/projects')}><span>{state.step > index ? <Check/> : index + 1}</span><div><b>{label}</b><small>{descriptions[index]}</small></div></button>)}<button className="wcb-onboarding-dismiss" onClick={dismissOnboarding} aria-label="Dismiss onboarding"><X/></button></nav>
}
export function useWorkspaces() {
  const [ids, setIds] = useState<string[]>([]), [error, setError] = useState(''), [loading, setLoading] = useState(true)
  const [labels, setLabels] = useState<Record<string,string>>({})
  const [selected, setSelected] = useState('')
  useEffect(() => {
    let current = true
    const refresh = async () => {
      try {
        const [next, projects] = productionAuthMode() ? await Promise.all([hostedProductClient.workspaces(), hostedProductClient.workspaceProjects()]) : [readLocal<string[]>('wcb-demo-workspaces', ['personal']), []]
        if (!current) return
        setLabels(Object.fromEntries(projects.map(project => [project.workspaceId, project.name || ''])))
        setIds(next); setError(''); const saved = readLocal<string>('wcb-selected-workspace', '')
        setSelected(next.includes(saved) ? saved : next[0] || '')
      } catch (reason) { if (current) setError(reason instanceof Error ? reason.message : 'Workspaces unavailable') }
      finally { if (current) setLoading(false) }
    }
    void refresh(); window.addEventListener('wcb:workspaces-updated', refresh)
    return () => { current = false; window.removeEventListener('wcb:workspaces-updated', refresh) }
  }, [])
  const select = (id: string) => { try { writeLocal('wcb-selected-workspace', id) } catch {} setSelected(id); window.dispatchEvent(new Event('wcb:workspaces-updated')) }
  return { ids, labels, error, loading, selected, select }
}
export function CreateWorkspaceDialog({ onClose, navigate }: { onClose: () => void; navigate: Navigate }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const id = useRef(crypto.randomUUID())
  const create = async () => {
    if (busy) return
    setBusy(true); setError('')
    try {
      const workspaceId = productionAuthMode() ? await hostedProductClient.createWorkspace(id.current) : id.current
      if (!productionAuthMode()) writeLocal('wcb-demo-workspaces', [...readLocal<string[]>('wcb-demo-workspaces', ['personal']), workspaceId])
      try { writeLocal('wcb-selected-workspace', workspaceId) } catch {}
      window.dispatchEvent(new Event('wcb:workspaces-updated')); onClose(); navigate('/workspace')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create workspace.'); setBusy(false) }
  }
  return <Modal title="Add workspace" onClose={onClose}><p>Create a separate space for your next project. You will be its owner and can create working copies here from Purchases.</p>{error && <p role="alert">{error}</p>}<div className="wcb-form-actions"><button onClick={onClose} disabled={busy}>Cancel</button><button className="rd-primary-action" disabled={busy} onClick={() => void create()}>{busy ? 'Creating workspace…' : 'Create workspace'}</button></div></Modal>
}
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { const previous = document.activeElement as HTMLElement; (ref.current?.querySelector<HTMLElement>('input') || ref.current?.querySelector<HTMLElement>('button'))?.focus(); return () => previous?.focus() }, [])
  return <div className="rd-search-backdrop" onMouseDown={onClose}><div ref={ref} className="wcb-dialog" role="dialog" aria-modal="true" aria-label={title} onMouseDown={event => event.stopPropagation()} onKeyDown={event => {
    if (event.key === 'Escape') onClose()
    if (event.key === 'Tab') { const nodes = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,a[href]'); if (!nodes?.length) return; const first = nodes[0], last = nodes[nodes.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() } }
  }}><header><h2>{title}</h2><button onClick={onClose} aria-label={`Close ${title}`}><X/></button></header>{children}</div></div>
}
export function ProductShell({ children, view, navigate, signOut }: { children: ReactNode; view: DashboardView; navigate: Navigate; signOut: () => Promise<void> }) {
  const { account } = useAccount(), workspaces = useWorkspaces()
  const archiveSelected = view === 'projects' && new URLSearchParams(window.location.search).get('view') === 'archive'
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 760), [menu, setMenu] = useState(''), [search, setSearch] = useState(false), [query, setQuery] = useState(''), [create, setCreate] = useState(false)
  const results = (Object.keys(appRoutes) as DashboardView[]).filter(key => appRoutes[key][1].toLowerCase().includes(query.trim().toLowerCase()))
  const choose = (path: string) => { setMenu(''); setSearch(false); if (window.innerWidth <= 760) setSidebarOpen(false); navigate(path) }
  useEffect(() => { const resize = () => { if (window.innerWidth <= 760) setSidebarOpen(false) }; window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize) }, [])
  useEffect(() => { const listener = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenu(''); setSearch(false) } if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearch(true) } }; window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener) }, [])
  useEffect(() => { const close = (event: MouseEvent) => { if (!(event.target as Element).closest('.rd-menu-anchor')) setMenu('') }; document.addEventListener('click', close); return () => document.removeEventListener('click', close) }, [])
  const accountMenu = (top: boolean) => <div className={'rd-dropdown ' + (top ? 'rd-profile-dropdown' : 'rd-account-dropdown')}><div className="rd-dropdown-user"><Avatar account={account}/><span><b>{account.displayName || 'Your account'}</b><small>{account.email || 'Account settings'}</small></span></div><AppLink to="/plans" navigate={choose} className="rd-dropdown-item"><Sparkles/>Upgrade to Pro</AppLink>{(['settings', 'account', 'billing', 'notifications'] as DashboardView[]).map(key => <AppLink key={key} to={appRoutes[key][0]} navigate={choose} className="rd-dropdown-item">{appRoutes[key][1]}</AppLink>)}<button className="rd-dropdown-item" onClick={() => { setMenu(''); setCreate(true) }}><Plus/>New workspace</button><button className="rd-dropdown-item destructive" onClick={() => void signOut()}><LogOut/>Sign out</button></div>
  return <div className={'rd-shell' + (sidebarOpen ? '' : ' rd-sidebar-collapsed')}>
    {sidebarOpen && <button className="wcb-sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}/>}
    <aside className="rd-sidebar"><div className="rd-sidebar-header"><div className="rd-menu-anchor"><button className="rd-team-switcher" aria-expanded={menu === 'team'} onClick={() => setMenu(menu === 'team' ? '' : 'team')}><span className="rd-team-logo"><img src="/brand/webcanbe-mark.svg" alt=""/></span><span className="rd-team-copy"><b>{workspaces.loading ? 'Loading workspace…' : workspaces.selected ? workspaceLabel(workspaces.selected, workspaces.ids.indexOf(workspaces.selected), workspaces.labels[workspaces.selected]) : 'Your workspace'}</b></span><ChevronsUpDown/></button>{menu === 'team' && <div className="rd-dropdown rd-team-dropdown"><AppLink to="/workspace" navigate={choose} className="rd-dropdown-item"><Grid2X2/>All workspaces</AppLink><button className="rd-dropdown-item" onClick={() => { setMenu(''); setCreate(true) }}><Plus/>Add workspace</button><div className="rd-dropdown-divider"/>{workspaces.ids.map((id, index) => <button key={id} className="rd-dropdown-item" onClick={() => { workspaces.select(id); setMenu('') }}>{workspaceLabel(id, index, workspaces.labels[id])}{id === workspaces.selected && <Check/>}</button>)}<div className="rd-dropdown-divider"/><AppLink to="/marketplace" navigate={choose} className="rd-dropdown-item"><Store/>Marketplace</AppLink><AppLink to="/purchases" navigate={choose} className="rd-dropdown-item"><ShoppingBag/>Purchases</AppLink><AppLink to="/profile" navigate={choose} className="rd-dropdown-item"><Settings2/>Settings</AppLink><AppLink to="/help" navigate={choose} className="rd-dropdown-item"><CircleHelp/>Support</AppLink><button className="rd-dropdown-item destructive" onClick={() => void signOut()}><LogOut/>Sign out</button></div>}</div><button className="rd-sidebar-search" onClick={() => { setQuery(''); setSearch(true) }}><Search/><span>Search…</span><kbd>⌘K</kbd></button></div>
      <div className="rd-sidebar-content"><section className="rd-nav-group"><span className="rd-nav-label">Projects</span><AppLink to="/dashboard" navigate={choose} className={'rd-nav-button'+((view==='overview'||view==='projects')&&!archiveSelected?' active':'')}><Grid2X2/><span>All</span></AppLink><AppLink to="/projects?view=archive" navigate={choose} className={'rd-nav-button'+(archiveSelected?' active':'')}><Archive/><span>Archive</span></AppLink><button className="rd-nav-button" onClick={() => setCreate(true)}><Plus/><span>New workspace…</span></button></section></div>
      <div className="rd-sidebar-footer rd-menu-anchor"><button className="rd-account-trigger" aria-label="Account menu" aria-expanded={menu === 'account'} onClick={() => setMenu(menu === 'account' ? '' : 'account')}><Avatar account={account}/><span><b>{account.displayName || 'Your account'}</b><small>{account.email || 'Manage your account'}</small></span><ChevronsUpDown/></button>{menu === 'account' && accountMenu(false)}</div>
    </aside><div className="rd-content"><button className="rd-sidebar-trigger rd-floating-sidebar-trigger" aria-label="Toggle sidebar" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(!sidebarOpen)}><PanelsTopLeft/></button>{children}</div>
    {search && <Modal title="Search Webcanbe" onClose={() => setSearch(false)}><input aria-label="Search pages" autoFocus placeholder="Search pages and actions" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && results[0]) choose(appRoutes[results[0]][0]) }}/><div className="wcb-search-results">{results.map(key => <AppLink key={key} to={appRoutes[key][0]} navigate={choose}>{appRoutes[key][1]}<ArrowRight/></AppLink>)}{!results.length && <p>No pages match “{query}”. Try “projects” or “billing”.</p>}</div></Modal>}
    {create && <CreateWorkspaceDialog onClose={() => setCreate(false)} navigate={navigate}/>}
  </div>
}
