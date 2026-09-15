import fs from 'node:fs'
import {createHash} from 'node:crypto'
import semver from 'semver'
import {expect,it} from 'vitest'
import {parseBunBinary} from './runtime/bunBinaryAlternate'

const lockPath=process.env.WCB_TODO_BUN_LOCK
const packagePath=process.env.WCB_TODO_PACKAGE
const maybe=lockPath&&packagePath?it:it.skip

maybe('maps exact retained Todo Bun binary descriptors to one finite package identity',()=>{
  const bytes=fs.readFileSync(lockPath!),manifest=JSON.parse(fs.readFileSync(packagePath!,'utf8'))
  expect(createHash('sha256').update(bytes).digest('hex')).toBe('4a6802815bb395350e14d4bd5d2162157bc2a21de755ca72c82a09dc8808c143')
  const lock=parseBunBinary(bytes)
  expect(lock.root?.dependencies).toEqual(manifest.dependencies)
  expect(lock.root?.devDependencies).toEqual(manifest.devDependencies)
  for(const [name,requested] of Object.entries({...manifest.dependencies,...manifest.devDependencies})){
    const record=lock.resolve(name,String(requested))
    expect(record.name).toBe(name)
    expect(semver.satisfies(record.version,String(requested))).toBe(true)
    expect(record.integrity).toMatch(/^sha(?:1|256|384|512)-/)
  }
})
