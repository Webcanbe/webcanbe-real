import { paypalWebhook } from './payment-routes.js'

const WEBHOOK = '/__webcanbe/api/payments/webhooks/paypal'
const headers = {
  'Cache-Control': 'no-store, max-age=0',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  'Referrer-Policy': 'no-referrer',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-Robots-Tag': 'noindex, nofollow',
}

function responseWithHeaders(response, status, method) {
  const outputHeaders = new Headers(response.headers)
  for (const [name, value] of Object.entries(headers)) outputHeaders.set(name, value)
  outputHeaders.set('Content-Type', 'text/html; charset=utf-8')
  return new Response(method === 'HEAD' ? null : response.body, { status, headers: outputHeaders })
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname
    // Keep signed PayPal notifications for orders made before closure. This
    // does not expose checkout, capture, billing, or any user-facing route.
    if (path === WEBHOOK) return paypalWebhook(request, env)

    if (path === '/robots.txt' && (request.method === 'GET' || request.method === 'HEAD')) {
      const response = await env.ASSETS.fetch(new Request(new URL('/robots.txt', request.url)))
      return new Response(request.method === 'HEAD' ? null : response.body, {
        status: 200,
        headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(JSON.stringify({ error: 'Webcanbe has ended service.' }), {
        status: 410,
        headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
      })
    }

    if (path.startsWith('/__webcanbe/') || path.startsWith('/__wcb')) {
      return new Response(request.method === 'HEAD' ? null : JSON.stringify({ error: 'Webcanbe has ended service.' }), {
        status: 410,
        headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
      })
    }

    const home = path === '/'
    const asset = await env.ASSETS.fetch(new Request(new URL(home ? '/' : '/closed.html', request.url)))
    return responseWithHeaders(asset, home ? 200 : 410, request.method)
  },
}
