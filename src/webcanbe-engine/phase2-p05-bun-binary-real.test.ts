import {createHash} from 'node:crypto'
import fs from 'node:fs'
import semver from 'semver'
import {expect,it} from 'vitest'
import {decodeBunBinaryLock} from './runtime/bunBinaryLock'

const lockPath=process.env.WCB_TODO_BUN_LOCK
const packagePath=process.env.WCB_TODO_PACKAGE
const maybe=lockPath&&packagePath?it:it.skip

maybe('decodes the exact retained Todo Bun 1.1.42 binary graph as bounded inert data',()=>{
  const bytes=fs.readFileSync(lockPath!),manifest=JSON.parse(fs.readFileSync(packagePath!,'utf8'))
  expect(bytes.length).toBe(262443)
  expect(createHash('sha256').update(bytes).digest('hex')).toBe('4a6802815bb395350e14d4bd5d2162157bc2a21de755ca72c82a09dc8808c143')
  expect(manifest.packageManager).toBe('bun@1.1.42')
  const graph=decodeBunBinaryLock(bytes)
  expect(graph.format).toBe('bun-lockfile-format-v0')
  expect(graph.serializerVersion).toBe(2)
  expect(graph.packages.length).toBeGreaterThan(50)
  expect(graph.root.dependencies).toEqual(manifest.dependencies)
  expect(graph.root.devDependencies).toEqual(manifest.devDependencies)
  expect(graph.root.optionalDependencies).toEqual(manifest.optionalDependencies??{})
  expect(graph.root.peerDependencies).toEqual(manifest.peerDependencies??{})
  for(const [name,requested] of Object.entries({...manifest.dependencies,...manifest.devDependencies})){
    const record=graph.descriptors.get(`${name}@${requested}`)
    expect(record,`${name}@${requested}`).toBeTruthy()
    expect(semver.satisfies(record!.version,String(requested))).toBe(true)
  }
  for(const record of graph.packages){
    expect(record.integrity).toMatch(/^(?:sha512-[A-Za-z0-9+/]{86}==|sha384-[A-Za-z0-9+/]{64}|sha256-[A-Za-z0-9+/]{43}=|sha1-[A-Za-z0-9+/]{27}=)$/)
    expect(record.resolved).toMatch(/^https:\/\/(?:registry\.npmjs\.org|registry\.yarnpkg\.com)\//)
    for(const edge of record.dependencies)if(edge.targetId!==null)expect(graph.byId.has(edge.targetId),`${record.name} -> ${edge.name}`).toBe(true)
  }
})
