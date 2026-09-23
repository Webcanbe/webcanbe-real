import { execFileSync } from 'node:child_process'

// Publish the actual owned fixture as a browseable source demo. It is not a
// marketplace release and never grants an entitlement or seller approval.
execFileSync(process.execPath, [
  'node_modules/typescript/bin/tsc', '-b', 'fixtures/aperture-north',
], { stdio: 'inherit' })
execFileSync(process.execPath, [
  'node_modules/vite/bin/vite.js', 'build', 'fixtures/aperture-north',
  '--base', '/demo/aperture-north/',
  '--outDir', '../../public/demo/aperture-north',
  '--emptyOutDir',
], { stdio: 'inherit' })
