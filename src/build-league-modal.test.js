import fs from 'node:fs'
import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'

const source = fs.readFileSync('public/build-league/landing.js', 'utf8')
const styles = fs.readFileSync('public/build-league/landing.css', 'utf8')

describe('Webcanbe event landing banner', () => {
  it('shows on the first visit without blocking the landing page and can be dismissed', () => {
    const dom = new JSDOM('<main id="page"><button id="background">Background</button></main>', {
      url: 'https://webcanbe.com/', runScripts: 'outside-only',
    })
    const { window } = dom
    window.fetch = async () => ({ ok: false })
    window.eval(source)
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'))

    const page = window.document.querySelector('#page')
    const banner = window.document.querySelector('#bl-static-banner')
    expect(page?.hasAttribute('inert')).toBe(false)
    expect(window.document.body.style.overflow).toBe('')
    expect(banner?.getAttribute('aria-label')).toBe('Webcanbe event')
    expect(banner?.textContent).toContain('Webcanbe Event')
    expect(window.document.querySelector('[role="dialog"]')).toBeNull()
    expect(styles).toMatch(/#bl-static-banner\{/)
    window.document.querySelector('#bl-static-banner button').click()
    expect(window.document.querySelector('#bl-static-banner')).toBeNull()
    dom.window.close()
  })
})
