import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import closure from './closure.js'

const env = {
  ASSETS: {
    async fetch(request) {
      const pathname = new URL(request.url).pathname
      const filename = pathname === '/' ? 'index.html' : pathname.slice(1)
      return new Response(readFileSync(new URL(`../dist/${filename}`, import.meta.url)), { status: 200 })
    },
  },
}

const request = (path, method = 'GET') => new Request(`https://webcanbe.com${path}`, { method })

describe('service closure', () => {
  it('keeps one branded home without a banner, footer, or contact details', async () => {
    const response = await closure.fetch(request('/'), env)
    const body = await response.text()
    expect(response.status).toBe(200)
    expect(body).toContain('Webcanbe has ended service.')
    expect(body).not.toContain('msihu.com')
    expect(body).not.toContain('<footer')
    expect(body).not.toContain('banner')
  })

  it.each(['/login', '/signup', '/admin', '/dashboard', '/browse', '/project/stillform', '/checkout/order', '/contact', '/assets/old-app.js'])(
    'replaces %s with the service notice', async path => {
      const response = await closure.fetch(request(path), env)
      const body = await response.text()
      expect(response.status).toBe(410)
      expect(body).toContain('Webcanbe has ended service.')
      expect(body).toContain('For inquiries:')
      expect(body).toContain('https://msihu.com')
      expect(response.headers.get('cache-control')).toContain('no-store')
    },
  )

  it('blocks checkout and other API calls at the Worker boundary', async () => {
    for (const path of ['/__webcanbe/api/payments/orders/create', '/__webcanbe/api/payments/orders/capture', '/__webcanbe/auth/start']) {
      const response = await closure.fetch(request(path, 'POST'), env)
      expect(response.status).toBe(410)
      expect(await response.json()).toEqual({ error: 'Webcanbe has ended service.' })
    }
  })

  it('returns an empty HEAD response for removed pages', async () => {
    const response = await closure.fetch(request('/login', 'HEAD'), env)
    expect(response.status).toBe(410)
    expect(await response.text()).toBe('')
  })
})
