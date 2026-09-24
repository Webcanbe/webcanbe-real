import fs from 'node:fs'
import { JSDOM } from 'jsdom'
import { describe, expect, it } from 'vitest'

const source = fs.readFileSync('public/build-league/landing.js', 'utf8')
const styles = fs.readFileSync('public/build-league/landing.css', 'utf8')

describe('Build League landing introduction', () => {
  it('blocks the background until the introduction closes, then shows the campaign banner', () => {
    const dom = new JSDOM('<main id="page"><button id="background">Background</button></main>', {
      url: 'https://webcanbe.com/', runScripts: 'outside-only',
    })
    const { window } = dom
    window.fetch = async () => ({ ok: false })
    window.eval(source)
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'))

    const page = window.document.querySelector('#page')
    const dialog = window.document.querySelector('[role="dialog"]')
    expect(dialog?.getAttribute('aria-modal')).toBe('true')
    expect(page?.hasAttribute('inert')).toBe(true)
    expect(window.document.body.style.overflow).toBe('hidden')
    expect(styles).toMatch(/#bl-static-layer\{[^}]*backdrop-filter:blur\(5px\)/)

    window.document.querySelector('.bl-static-close').click()
    expect(page?.hasAttribute('inert')).toBe(false)
    expect(window.document.body.style.overflow).toBe('')
    expect(window.document.querySelector('#bl-static-banner')?.getAttribute('aria-label')).toBe('Build League campaign')
    expect(window.document.querySelector('#bl-static-layer')).toBeNull()
    dom.window.close()
  })
})
