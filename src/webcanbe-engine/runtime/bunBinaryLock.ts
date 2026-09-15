import semver from 'semver'

const HEADER = Buffer.from('#!/usr/bin/env bun\nbun-lockfile-format-v0\n', 'utf8')
const MAX_LOCK_BYTES = 2 * 1024 * 1024
const MAX_PACKAGES = 12_000
const DEPENDENCY_BYTES = 26
const RESOLUTION_BYTES = 4
const PACKAGE_FIELD_BYTES = Object.freeze({
  name: 8,
  nameHash: 8,
  resolution: 64,
  dependencies: 8,
  resolutions: 8,
  meta: 88,
  bin: 20,
  scripts: 48,
})
const packageName = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i

export type BunBinaryDependency = Readonly<{
  name: string
  requested: string
  targetId: number
  normal: boolean
  optional: boolean
  dev: boolean
  peer: boolean
}>

export type BunBinaryPackage = Readonly<{
  id: number
  name: string
  version: string
  integrity: string
  resolved: string
  requests: readonly string[]
  dependencies: readonly BunBinaryDependency[]
}>

export type BunBinaryRoot = Readonly<{
  dependencies: Readonly<Record<string, string>>
  devDependencies: Readonly<Record<string, string>>
  optionalDependencies: Readonly<Record<string, string>>
  peerDependencies: Readonly<Record<string, string>>
}>

export type BunBinaryGraph = Readonly<{
  format: 'bun-lockfile-format-v0'
  serializerVersion: 2
  metaHash: string
  root: BunBinaryRoot
  packages: readonly BunBinaryPackage[]
  byId: ReadonlyMap<number, BunBinaryPackage>
  /** Exact descriptor lookup. Ambiguous descriptors are intentionally absent. */
  descriptors: ReadonlyMap<string, BunBinaryPackage>
}>

class Reader {
  readonly view: DataView
  pos = 0
  constructor(readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }
  seek(position: number) {
    if (!Number.isSafeInteger(position) || position < 0 || position > this.bytes.byteLength) throw new Error('Invalid Bun lock offset.')
    this.pos = position
  }
  read(length: number) {
    if (!Number.isSafeInteger(length) || length < 0 || this.pos + length > this.bytes.byteLength) throw new Error('Truncated Bun lock data.')
    const result = new Uint8Array(this.bytes.buffer, this.bytes.byteOffset + this.pos, length)
    this.pos += length
    return result
  }
  u32() {
    if (this.pos + 4 > this.bytes.byteLength) throw new Error('Truncated Bun lock integer.')
    const result = this.view.getUint32(this.pos, true)
    this.pos += 4
    return result
  }
  u64() {
    if (this.pos + 8 > this.bytes.byteLength) throw new Error('Truncated Bun lock integer.')
    const low = this.view.getUint32(this.pos, true)
    const high = this.view.getUint32(this.pos + 4, true)
    this.pos += 8
    const result = low + high * 2 ** 32
    if (!Number.isSafeInteger(result)) throw new Error('Unsafe Bun lock integer.')
    return result
  }
}

function equalBytes(a: Uint8Array, b: Uint8Array) {
  if (a.byteLength !== b.byteLength) return false
  for (let i = 0; i < a.byteLength; i++) if (a[i] !== b[i]) return false
  return true
}

function pair(bytes: Uint8Array) {
  if (bytes.byteLength !== 8) throw new Error('Invalid Bun lock slice reference.')
  const view = new DataView(bytes.buffer, bytes.byteOffset, 8)
  return [view.getUint32(0, true), view.getUint32(4, true)] as const
}

function safeSlice(data: Uint8Array, reference: Uint8Array, width: number) {
  const [offset, length] = pair(reference)
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || width <= 0 || (offset + length) * width > data.byteLength) throw new Error('Bun lock slice escapes its bounded buffer.')
  return Array.from({ length }, (_, index) => data.subarray((offset + index) * width, (offset + index + 1) * width))
}

function safeU32Array(bytes: Uint8Array) {
  if (bytes.byteLength % 4) throw new Error('Misaligned Bun lock resolution buffer.')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return Array.from({ length: bytes.byteLength / 4 }, (_, index) => view.getUint32(index * 4, true))
}

function strictDecoder() {
  return new TextDecoder('utf-8', { fatal: true })
}

function stringReader(stringBytes: Uint8Array) {
  const decoder = strictDecoder()
  return (reference: Uint8Array) => {
    if (reference.byteLength !== 8) throw new Error('Invalid Bun lock string reference.')
    let bytes: Uint8Array
    if ((reference[7] & 0x80) === 0) {
      const zero = reference.indexOf(0)
      bytes = zero < 0 ? reference : reference.subarray(0, zero)
    } else {
      const view = new DataView(reference.buffer, reference.byteOffset, 8)
      const offset = view.getUint32(0, true)
      const rawLength = view.getUint32(4, true)
      const length = rawLength & 0x7fffffff
      if (offset + length > stringBytes.byteLength || length > 64 * 1024) throw new Error('Bun lock string escapes its pool.')
      bytes = stringBytes.subarray(offset, offset + length)
    }
    const value = decoder.decode(bytes)
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) throw new Error('Bun lock contains control characters.')
    return value
  }
}

function shaIntegrity(meta: Uint8Array) {
  if (meta.byteLength !== PACKAGE_FIELD_BYTES.meta) throw new Error('Invalid Bun package metadata size.')
  const tag = meta[20]
  const sizes: Record<number, [string, number]> = {
    1: ['sha1', 20],
    2: ['sha256', 32],
    3: ['sha384', 48],
    4: ['sha512', 64],
  }
  const selected = sizes[tag]
  if (!selected) throw new Error('Bun npm package lacks a supported integrity hash.')
  const [algorithm, length] = selected
  const digest = meta.subarray(21, 21 + length)
  if (digest.byteLength !== length || digest.every(value => value === 0)) throw new Error('Invalid Bun package integrity digest.')
  return `${algorithm}-${Buffer.from(digest).toString('base64')}`
}

function npmResolution(resolution: Uint8Array, readString: (reference: Uint8Array) => string) {
  if (resolution.byteLength !== PACKAGE_FIELD_BYTES.resolution || resolution[0] !== 2) throw new Error('Only Bun npm package resolutions are admitted by this decoder.')
  const resolved = readString(resolution.subarray(8, 16))
  const url = new URL(resolved)
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || !['registry.npmjs.org', 'registry.yarnpkg.com'].includes(url.hostname) || url.hash && !/^#[a-f0-9]{40}$/i.test(url.hash)) throw new Error('Bun package resolution is not an immutable public npm registry URL.')
  const view = new DataView(resolution.buffer, resolution.byteOffset, resolution.byteLength)
  const major = view.getUint32(16, true), minor = view.getUint32(20, true), patch = view.getUint32(24, true)
  const prerelease = readString(resolution.subarray(32, 40)), build = readString(resolution.subarray(48, 56))
  let version = `${major}.${minor}.${patch}`
  if (prerelease) version += `-${prerelease}`
  if (build) version += `+${build}`
  if (!semver.valid(version)) throw new Error('Invalid Bun npm package version.')
  return { version, resolved }
}

function classifyDependency(record: Uint8Array, targetId: number, readString: (reference: Uint8Array) => string): BunBinaryDependency {
  if (record.byteLength !== DEPENDENCY_BYTES) throw new Error('Invalid Bun dependency record.')
  const name = readString(record.subarray(0, 8)), requested = readString(record.subarray(18, 26)), behavior = record[16]
  if (!packageName.test(name) || !requested || requested.length > 512) throw new Error('Invalid Bun dependency identity.')
  // Bun behavior bits: normal=2, optional=4, dev=8, peer=16, workspace=32.
  if (behavior & 0b0010_0000) throw new Error('Bun workspace dependency requires a separate confined-workspace adapter.')
  if (behavior & ~0b0011_1110) throw new Error('Unknown Bun dependency behavior.')
  return Object.freeze({ name, requested, targetId, normal: Boolean(behavior & 2), optional: Boolean(behavior & 4), dev: Boolean(behavior & 8), peer: Boolean(behavior & 16) })
}

/**
 * Decode the bounded Bun binary lock format used by the retained Bun 1.1.x corpus.
 *
 * This is data parsing only. It never invokes Bun, package scripts, bunfig, network
 * resolution, package installation or host node_modules. Field sizes/tags are
 * checked against Bun's versioned serializer (`bun-lockfile-format-v0`, format 2).
 * Unknown resolution forms fail closed instead of being guessed.
 */
export function decodeBunBinaryLock(input: Uint8Array): BunBinaryGraph {
  const bytes = input instanceof Buffer ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength) : input
  if (!bytes.byteLength || bytes.byteLength > MAX_LOCK_BYTES) throw new Error('Bun binary lock exceeds its bounded input size.')
  const reader = new Reader(bytes)
  if (!equalBytes(reader.read(HEADER.byteLength), HEADER)) throw new Error('Invalid Bun binary lock header.')
  if (reader.u32() !== 2) throw new Error('Unsupported Bun binary serializer version.')
  const metaHash = Buffer.from(reader.read(32)).toString('hex')
  const serializedEnd = reader.u64()
  if (serializedEnd > bytes.byteLength || serializedEnd < reader.pos) throw new Error('Invalid Bun serialized length.')
  const count = reader.u64()
  if (count < 1 || count > MAX_PACKAGES) throw new Error('Bun package-count bound exceeded.')
  if (reader.u64() !== 8 || reader.u64() !== 8) throw new Error('Unexpected Bun package serializer layout.')
  const packageBegin = reader.u64(), packageEnd = reader.u64()
  if (packageBegin < reader.pos || packageBegin > packageEnd || packageEnd > serializedEnd) throw new Error('Invalid Bun package table range.')

  reader.seek(packageBegin)
  const packages = Array.from({ length: count }, () => Object.create(null) as Record<string, Uint8Array>)
  for (const [field, width] of Object.entries(PACKAGE_FIELD_BYTES)) {
    const size = width * count
    if (!Number.isSafeInteger(size) || reader.pos + size > packageEnd) throw new Error('Bun package table exceeds its range.')
    const column = reader.read(size)
    for (let index = 0; index < count; index++) packages[index][field] = column.subarray(index * width, (index + 1) * width)
  }
  if (reader.pos > packageEnd) throw new Error('Invalid Bun package table size.')

  reader.seek(packageEnd)
  const buffers: Record<string, Uint8Array> = Object.create(null)
  const ranges: Array<{ start: number; end: number }> = []
  for (const name of ['trees', 'hoistedDependencies', 'resolutions', 'dependencies', 'externalStrings', 'stringBytes']) {
    const start = reader.u64(), end = reader.u64()
    if (start < packageEnd || start > end || end > serializedEnd) throw new Error('Invalid Bun buffer range.')
    ranges.push({ start, end })
    const saved = reader.pos
    reader.seek(start); buffers[name] = reader.read(end - start); reader.seek(saved)
  }
  const occupied = ranges.filter(range => range.end > range.start).sort((a, b) => a.start - b.start)
  for (let index = 1; index < occupied.length; index++) if (occupied[index - 1].end > occupied[index].start) throw new Error('Overlapping Bun serialized buffers.')
  if (buffers.dependencies.byteLength % DEPENDENCY_BYTES || buffers.resolutions.byteLength % RESOLUTION_BYTES) throw new Error('Misaligned Bun dependency buffers.')
  const allResolutions = safeU32Array(buffers.resolutions)
  if (allResolutions.length !== buffers.dependencies.byteLength / DEPENDENCY_BYTES) throw new Error('Bun dependency/resolution buffers disagree.')

  const readString = stringReader(buffers.stringBytes)
  const incoming = Array.from({ length: count }, () => [] as string[])
  for (let index = 0; index < allResolutions.length; index++) {
    const target = allResolutions[index]
    if (!Number.isSafeInteger(target) || target < 0 || target >= count) throw new Error('Bun dependency resolution points outside the package table.')
    incoming[target].push(readString(buffers.dependencies.subarray(index * DEPENDENCY_BYTES + 18, index * DEPENDENCY_BYTES + 26)))
  }

  const decoded: BunBinaryPackage[] = []
  const byId = new Map<number, BunBinaryPackage>()
  const rootGroups = {
    dependencies: Object.create(null) as Record<string, string>,
    devDependencies: Object.create(null) as Record<string, string>,
    optionalDependencies: Object.create(null) as Record<string, string>,
    peerDependencies: Object.create(null) as Record<string, string>,
  }

  for (let id = 0; id < count; id++) {
    const source = packages[id]
    const dependencyRows = safeSlice(buffers.dependencies, source.dependencies, DEPENDENCY_BYTES)
    const resolutionRows = safeSlice(buffers.resolutions, source.resolutions, RESOLUTION_BYTES)
    if (dependencyRows.length !== resolutionRows.length) throw new Error('Bun package dependency slices disagree.')
    const edges = dependencyRows.map((record, index) => {
      const target = new DataView(resolutionRows[index].buffer, resolutionRows[index].byteOffset, 4).getUint32(0, true)
      if (target >= count) throw new Error('Bun package dependency target is invalid.')
      return classifyDependency(record, target, readString)
    })
    if (id === 0) {
      if (source.resolution[0] !== 1) throw new Error('Bun package zero is not the root resolution.')
      for (const edge of edges) {
        const group = edge.peer ? rootGroups.peerDependencies : edge.optional ? rootGroups.optionalDependencies : edge.dev ? rootGroups.devDependencies : edge.normal ? rootGroups.dependencies : undefined
        if (!group || Object.prototype.hasOwnProperty.call(group, edge.name)) throw new Error('Ambiguous Bun root dependency behavior.')
        group[edge.name] = edge.requested
      }
      continue
    }
    const name = readString(source.name)
    if (!packageName.test(name)) throw new Error('Invalid Bun package name.')
    const { version, resolved } = npmResolution(source.resolution, readString)
    const record = Object.freeze({ id, name, version, resolved, integrity: shaIntegrity(source.meta), requests: Object.freeze([...new Set(incoming[id])].sort()), dependencies: Object.freeze(edges) })
    decoded.push(record); byId.set(id, record)
  }

  const descriptorCandidates = new Map<string, BunBinaryPackage[]>()
  for (const record of decoded) for (const requested of record.requests.length ? record.requests : [record.version]) {
    const key = `${record.name}@${requested}`
    const list = descriptorCandidates.get(key) ?? []
    list.push(record); descriptorCandidates.set(key, list)
  }
  const descriptors = new Map<string, BunBinaryPackage>()
  for (const [key, records] of descriptorCandidates) {
    const unique = [...new Map(records.map(record => [`${record.name}@${record.version}:${record.integrity}`, record])).values()]
    if (unique.length === 1) descriptors.set(key, unique[0])
  }

  return Object.freeze({ format: 'bun-lockfile-format-v0' as const, serializerVersion: 2 as const, metaHash, root: Object.freeze(rootGroups), packages: Object.freeze(decoded), byId, descriptors })
}
