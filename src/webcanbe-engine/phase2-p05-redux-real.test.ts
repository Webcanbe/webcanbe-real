import fs from 'node:fs'
import {expect,it} from 'vitest'
import {parseYarnClassic} from './runtime/alternateLockfiles'

const lockPath=process.env.WCB_REDUX_BERRY_LOCK
const packagePath=process.env.WCB_REDUX_PACKAGE
const maybe=lockPath&&packagePath?it:it.skip

maybe('parses the exact frozen reduxjs Yarn 4.2.2 lock without executing package-manager code',()=>{
  const source=fs.readFileSync(lockPath!,'utf8'),manifest=JSON.parse(fs.readFileSync(packagePath!,'utf8'))
  expect(manifest.packageManager).toBe('yarn@4.2.2')
  const lock=parseYarnClassic(source)
  expect(lock.format).toBe('yarn-berry-v8')
  expect(lock.cacheKey).toBe('10c0')
  expect(lock.resolve('react',manifest.dependencies.react).version).toMatch(/^18\./)
  expect(lock.resolve('react-dom',manifest.dependencies['react-dom']).version).toMatch(/^18\./)
  expect(lock.resolve('vite',manifest.devDependencies.vite).version).toMatch(/^5\./)
  const typescript=lock.resolve('typescript',manifest.devDependencies.typescript)
  expect(typescript.version).toBe('5.4.5')
  expect(typescript.berryLocator).toContain('builtin<compat/typescript>')
  expect(lock.resolve('node-gyp','npm:latest').version).toBe('10.1.0')
  const fsevents=lock.resolve('fsevents','npm:~2.3.2')
  expect(fsevents.version).toBe('2.3.3')
  expect(fsevents.conditions).toBe('os=darwin')
})
