(() => {
  const key = 'wcb-build-league-intro-v1'
  const image = '/build-league/campaign.webp'
  let unlockPage = () => {}

  function lockPage(layer) {
    const body = document.body
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const oldOverflow = body.style.overflow
    const oldPadding = body.style.paddingRight
    const gap = window.innerWidth - document.documentElement.clientWidth
    body.style.overflow = 'hidden'
    if (gap > 0) body.style.paddingRight = `${parseFloat(getComputedStyle(body).paddingRight) + gap}px`
    const controls = () => [...layer.querySelectorAll('button:not(:disabled),a[href]')]
    controls()[0]?.focus()
    const trap = event => {
      if (event.key !== 'Tab') return
      const items = controls()
      if (!items.length) return
      const first = items[0], last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      else if (!layer.contains(document.activeElement)) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', trap)
    unlockPage = () => {
      document.removeEventListener('keydown', trap)
      body.style.overflow = oldOverflow
      body.style.paddingRight = oldPadding
      previous?.focus()
    }
  }

  function nextAction(progress) {
    const counts = progress.counts || {}
    if (!counts.working_copy_created) return 'Create a working copy'
    if (!counts.source_saved) return 'Save a real edit'
    if (!counts.ai_edit_applied) return 'Apply an AI edit'
    if (counts.ai_edit_applied < 3) return 'Apply AI to another section'
    if (!counts.export_completed) return 'Export your source'
    return progress.entry ? 'Invite another builder' : 'Submit your build'
  }

  async function updateBanner(banner) {
    try {
      const session = await fetch('/__webcanbe/auth/session', { credentials: 'same-origin' })
      if (!session.ok) return
      const { csrf } = await session.json()
      if (typeof csrf !== 'string') return
      const response = await fetch('/__webcanbe/api/build-league/state', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-WCB-CSRF': csrf }, body: '{}',
      })
      if (!response.ok) return
      const { progress } = await response.json()
      if (!progress || !Number.isInteger(progress.stage) || !Number.isInteger(progress.points)) return
      banner.querySelector('[data-bl-stage]').textContent = `Stage ${progress.stage} · Build something real`
      banner.querySelector('[data-bl-detail]').textContent = `${progress.points} pts · ${nextAction(progress)}`
    } catch { /* Keep public campaign copy when a session is unavailable. */ }
  }

  function showBanner() {
    if (document.getElementById('bl-static-banner')) return
    const banner = document.createElement('div')
    banner.id = 'bl-static-banner'
    banner.setAttribute('role', 'region')
    banner.setAttribute('aria-label', 'Build League campaign')
    banner.innerHTML = '<strong>BUILD LEAGUE</strong><span data-bl-stage>Stage 1 · Build something real</span><span data-bl-detail>Grand reward: may.cx</span><a href="/event">View <span aria-hidden="true">↗</span></a>'
    document.body.append(banner)
    document.body.classList.add('bl-static-banner-visible')
    void updateBanner(banner)
  }

  function closeCard(card) {
    try { localStorage.setItem(key, 'closed') } catch { /* Private browsing may reject storage. */ }
    unlockPage()
    card.remove()
    showBanner()
  }

  function showCard() {
    const layer = document.createElement('div')
    layer.id = 'bl-static-layer'
    layer.innerHTML = `<section class="bl-static-card" role="dialog" aria-modal="true" aria-labelledby="bl-static-title"><button class="bl-static-close" type="button" aria-label="Close campaign introduction">×</button><small>BUILD LEAGUE — STAGE 1</small><h2 id="bl-static-title">Build something real.</h2><img src="${image}" alt="An architectural portal built from stone, brushed metal, and violet glass"><div class="bl-static-footer"><p>Complete actions. Earn pts.<br><strong>Grand reward: may.cx</strong></p><a href="/event">Start Building <span aria-hidden="true">↗</span></a></div></section>`
    document.body.append(layer)
    lockPage(layer)
    layer.querySelector('.bl-static-close').addEventListener('click', () => closeCard(layer))
    layer.querySelector('.bl-static-footer a').addEventListener('click', () => closeCard(layer))
  }

  function mount() {
    if (location.pathname !== '/') return
    try { if (localStorage.getItem(key) === 'closed') return showBanner() } catch { /* Show the introduction. */ }
    showCard()
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true })
  else mount()
})()
