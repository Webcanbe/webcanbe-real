(() => {
  const key = 'wcb-event-banner-dismissed-v1'

  function mount() {
    if (location.pathname !== '/' || document.getElementById('bl-static-banner')) return
    try { if (localStorage.getItem(key) === 'yes') return } catch { /* Storage is optional. */ }
    const banner = document.createElement('div')
    banner.id = 'bl-static-banner'
    banner.setAttribute('role', 'region')
    banner.setAttribute('aria-label', 'Webcanbe event')
    banner.innerHTML = '<strong>Webcanbe Event</strong><span>Build something real and share the project you made.</span><a href="/event">View event <span aria-hidden="true">↗</span></a><button type="button" aria-label="Dismiss event banner">×</button>'
    banner.querySelector('button').addEventListener('click', () => {
      try { localStorage.setItem(key, 'yes') } catch { /* Storage is optional. */ }
      banner.remove()
    })
    document.body.prepend(banner)
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true })
  else mount()
})()
