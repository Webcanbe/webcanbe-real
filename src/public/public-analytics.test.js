import fs from 'node:fs'
import { expect, it } from 'vitest'

it('loads privacy-safe link analytics on static public pages without double-loading the plans SPA', () => {
  const github = fs.readFileSync('.public-site/__public/github.html', 'utf8')
  const landing = fs.readFileSync('.public-site/__public/home.html', 'utf8')
  const plans = fs.readFileSync('dist/__public/plans.html', 'utf8')
  expect(github).toContain('src="/public-analytics.js"')
  expect(landing).toContain('src="/public-analytics.js"')
  expect(plans).not.toContain('src="/public-analytics.js"')
  expect(fs.statSync('dist/public-analytics.js').size).toBeLessThan(10_000)
})
