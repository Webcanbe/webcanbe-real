import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { closedPage, homePage } from '../site/closure-pages.mjs'

rmSync('dist', { recursive: true, force: true })
mkdirSync('dist', { recursive: true })
writeFileSync('dist/index.html', homePage)
writeFileSync('dist/closed.html', closedPage)
writeFileSync('dist/robots.txt', 'User-agent: *\nDisallow: /\n')
console.log('Built the Webcanbe service notice. Only the home and closure documents are deployed.')
