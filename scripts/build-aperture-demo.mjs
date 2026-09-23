import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

// These two first-party templates are also source-backed working-copy inputs.
// The server verifies the immutable file digest before copying a template into
// the authenticated user's own workspace. This path does not grant seller status.
for (const slug of ['aperture-north', 'stillform']) {
  const fixture = `fixtures/${slug}`
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-b', fixture], { stdio: 'inherit' })
  execFileSync(process.execPath, [
    'node_modules/vite/bin/vite.js', 'build', fixture,
    '--base', `/demo/${slug}/`, '--outDir', `../../public/demo/${slug}`,
    '--emptyOutDir',
  ], { stdio: 'inherit' })
  const files = {}
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) walk(absolute)
      else if (entry.isFile()) {
        const relative = path.relative(fixture, absolute).split(path.sep).join('/')
        if (relative === 'tsconfig.tsbuildinfo' || relative === 'README.md') continue
        files[relative] = fs.readFileSync(absolute).toString('base64')
      }
    }
  }
  walk(fixture)
  const sorted = Object.entries(files).sort(([a], [b]) => a.localeCompare(b))
  const digest = createHash('sha256').update(JSON.stringify(sorted)).digest('hex')
  fs.mkdirSync('public/template-source', { recursive: true })
  fs.writeFileSync(`public/template-source/${slug}.json`, JSON.stringify({ slug, digest, files: Object.fromEntries(sorted) }))
}
