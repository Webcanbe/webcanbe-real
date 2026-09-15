import semver from "semver"
import type { AlternateLock } from "./alternateLockfiles"

const HEADER = Buffer.from("#!/usr/bin/env bun\nbun-lockfile-format-v0\n")
const MAX_BYTES = 2 * 1024 * 1024
const MAX_RECORDS = 12_000
const PACKAGE_FIELDS = Object.freeze([
  ["name", 8], ["nameHash", 8], ["resolution", 64], ["dependencies", 8],
  // Package.Scripts is an extern struct with six 8-byte strings plus a bool.
  ["resolutions", 8], ["meta", 88], ["bin", 20], ["scripts", 49],
] as const)
const BUFFER_FIELDS = Object.freeze([
  ["trees", 20], ["hoistedDependencies", 4], ["resolutions", 4],
  ["dependencies", 26], ["externStrings", 1], ["stringBytes", 1],
] as const)
const packageName = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i

type Span = { start: number; end: number; label: string }
type RawPackage = Record<(typeof PACKAGE_FIELDS)[number][0], Buffer>

function safeNumber(value: bigint, label: string) {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`Bun ${label} exceeds the safe integer bound.`)
  return Number(value)
}

/** Decode only Bun v1.1.42's format-2 serializer. The lock is immutable data;
 * this parser never invokes Bun, configuration, scripts, plugins, or networking. */
export function parseBunBinary(bytes: Buffer): AlternateLock {
  if (!Buffer.isBuffer(bytes) || bytes.length < 160 || bytes.length > MAX_BYTES) throw new Error("Bun binary lock size is outside the supported bound.")
  let position = 0
  const spans: Span[] = []
  const take = (length: number, label: string) => {
    if (!Number.isSafeInteger(length) || length < 0 || position > bytes.length - length) throw new Error(`Truncated Bun ${label}.`)
    const value = bytes.subarray(position, position + length); position += length; return value
  }
  const u32 = (label: string) => take(4, label).readUInt32LE(0)
  const u64 = (label: string) => safeNumber(take(8, label).readBigUInt64LE(0), label)
  if (!take(HEADER.length, "header").equals(HEADER)) throw new Error("Invalid Bun binary lock header.")
  if (u32("format") !== 2) throw new Error("Only Bun v1.1.42 binary lock format 2 is supported.")
  take(32, "meta hash")
  const serializedEnd = u64("serialized length")
  if (serializedEnd < position || serializedEnd > bytes.length) throw new Error("Invalid Bun serialized length.")

  const packageCount = u64("package count")
  if (packageCount < 1 || packageCount > MAX_RECORDS) throw new Error("Bun package count exceeds the supported bound.")
  if (u64("package alignment") !== 8 || u64("package field count") !== PACKAGE_FIELDS.length) throw new Error("Unsupported Bun package layout.")
  const packageStart = u64("package range start"), packageEnd = u64("package range end")
  const packageBytes = PACKAGE_FIELDS.reduce((sum, [, size]) => sum + size, 0) * packageCount
  if (packageStart < position || packageEnd !== packageStart + packageBytes || packageEnd > serializedEnd) throw new Error("Invalid Bun package range.")
  spans.push({ start: packageStart, end: packageEnd, label: "packages" })
  position = packageStart
  const packages = Array.from({ length: packageCount }, () => Object.create(null) as RawPackage)
  for (const [field, size] of PACKAGE_FIELDS) {
    const column = take(size * packageCount, `package ${field}`)
    for (let index = 0; index < packageCount; index++) packages[index][field] = column.subarray(index * size, (index + 1) * size)
  }
  if (position !== packageEnd) throw new Error("Bun package range length mismatch.")

  position = packageEnd
  const buffers: Record<string, Buffer> = Object.create(null)
  for (const [field, itemSize] of BUFFER_FIELDS) {
    const headerPosition = position, start = u64(`${field} start`), end = u64(`${field} end`)
    if (start < headerPosition + 16 || start > end || end > serializedEnd || (end - start) % itemSize !== 0) throw new Error(`Invalid Bun ${field} range.`)
    spans.push({ start, end, label: field })
    buffers[field] = bytes.subarray(start, end)
    position = end
  }
  const ordered = [...spans].sort((a, b) => a.start - b.start || a.end - b.end)
  for (let index = 1; index < ordered.length; index++) if (ordered[index].start < ordered[index - 1].end) throw new Error(`Overlapping Bun ${ordered[index - 1].label}/${ordered[index].label} ranges.`)
  if (buffers.resolutions.length / 4 !== buffers.dependencies.length / 26) throw new Error("Bun dependency and resolution counts differ.")
  if (u64("graph terminator") !== 0) throw new Error("Invalid Bun graph terminator.")

  // Todo's retained lock has no workspaces, overrides, trusted-script list, or
  // patches. Refuse extension bytes rather than guessing their graph effects.
  if (position !== serializedEnd) throw new Error("Unsupported Bun workspace/trust/override/patch section.")
  for (const byte of bytes.subarray(serializedEnd)) if (byte !== 0) throw new Error("Non-zero data follows the Bun serialized payload.")

  const decode = new TextDecoder("utf-8", { fatal: true })
  const string = (raw: Buffer, label: string) => {
    if (raw.length !== 8) throw new Error(`Invalid Bun ${label} string field.`)
    let data: Buffer
    if ((raw[7] & 0x80) === 0) {
      const zero = raw.indexOf(0); data = zero < 0 ? raw : raw.subarray(0, zero)
      if (zero >= 0 && raw.subarray(zero).some(value => value !== 0)) throw new Error(`Invalid Bun inline ${label} padding.`)
    } else {
      const offset = raw.readUInt32LE(0), encodedLength = raw.readUInt32LE(4), length = encodedLength & 0x7fffffff
      if ((encodedLength & 0x80000000) === 0 || offset > buffers.stringBytes.length || length > buffers.stringBytes.length - offset) throw new Error(`Out-of-range Bun ${label} string.`)
      data = buffers.stringBytes.subarray(offset, offset + length)
    }
    let value: string
    try { value = decode.decode(data) } catch { throw new Error(`Invalid UTF-8 in Bun ${label}.`) }
    if (value.includes("\0") || value.length > 2048) throw new Error(`Invalid Bun ${label} string.`)
    return value
  }
  const slice = (raw: Buffer, itemSize: number, count: number, label: string) => {
    if (raw.length !== 8) throw new Error(`Invalid Bun ${label} slice.`)
    const offset = raw.readUInt32LE(0), length = raw.readUInt32LE(4)
    if (offset > count || length > count - offset || length > MAX_RECORDS) throw new Error(`Out-of-range Bun ${label} slice.`)
    return { offset, length, start: offset * itemSize, end: (offset + length) * itemSize }
  }
  const npmResolution = (raw: Buffer, label: string) => {
    if (raw.length !== 64 || raw[0] !== 2 || raw.subarray(1, 8).some(Boolean)) throw new Error(`Unsupported Bun ${label} resolution; only npm packages are admitted.`)
    const url = string(raw.subarray(8, 16), `${label} URL`)
    let parsed: URL
    try { parsed = new URL(url) } catch { throw new Error(`Invalid Bun ${label} registry URL.`) }
    if (parsed.protocol !== "https:" || parsed.hostname !== "registry.npmjs.org" || parsed.username || parsed.password || parsed.port || parsed.search || parsed.hash) throw new Error(`Unsupported Bun ${label} registry URL.`)
    const major = raw.readUInt32LE(16), minor = raw.readUInt32LE(20), patch = raw.readUInt32LE(24)
    if (raw.subarray(28, 32).some(Boolean)) throw new Error(`Invalid Bun ${label} version padding.`)
    const prerelease = string(raw.subarray(32, 40), `${label} prerelease`), build = string(raw.subarray(48, 56), `${label} build`)
    const version = `${major}.${minor}.${patch}${prerelease ? `-${prerelease}` : ""}${build ? `+${build}` : ""}`
    if (!semver.valid(version)) throw new Error(`Invalid Bun ${label} npm version.`)
    return { version, url }
  }
  const integrity = (raw: Buffer, label: string) => {
    if (raw.length !== 88 || raw[20] !== 4) throw new Error(`Bun ${label} requires SHA-512 integrity.`)
    return `sha512-${raw.subarray(21, 85).toString("base64")}`
  }

  const records = packages.map((raw, index) => {
    const name = string(raw.name, `package ${index} name`)
    if (!packageName.test(name)) throw new Error(`Invalid Bun package name at index ${index}.`)
    const resolution = index === 0 ? undefined : npmResolution(raw.resolution, `package ${name}`)
    const dependencySlice = slice(raw.dependencies, 26, buffers.dependencies.length / 26, `${name} dependencies`)
    const resolutionSlice = slice(raw.resolutions, 4, buffers.resolutions.length / 4, `${name} resolutions`)
    if (dependencySlice.offset !== resolutionSlice.offset || dependencySlice.length !== resolutionSlice.length) throw new Error(`Bun package ${name} dependency/resolution slices differ.`)
    return { name, version: resolution?.version, resolved: resolution?.url, integrity: index === 0 ? undefined : integrity(raw.meta, name), dependencySlice, targets: new Map<string, any>(), dependencies: Object.create(null), optionalDependencies: Object.create(null), peerDependencies: Object.create(null), peerDependenciesMeta: Object.create(null), unresolvedOptionalDependencies: [] as string[], unresolvedOptionalPeers: [] as string[] } as any
  })
  for (let packageIndex = 0; packageIndex < records.length; packageIndex++) {
    const record = records[packageIndex]
    for (let offset = 0; offset < record.dependencySlice.length; offset++) {
      const dependencyIndex = record.dependencySlice.offset + offset
      const raw = buffers.dependencies.subarray(dependencyIndex * 26, dependencyIndex * 26 + 26)
      const name = string(raw.subarray(0, 8), `dependency ${dependencyIndex} name`), requested = string(raw.subarray(18, 26), `dependency ${dependencyIndex} range`)
      if (!packageName.test(name) || requested.length > 256 || !semver.validRange(requested)) throw new Error(`Unsupported Bun dependency descriptor ${name}@${requested}.`)
      const behavior = raw[16], tag = raw[17]
      if (tag !== 1 || behavior & ~0x3e || !(behavior & (0x02 | 0x04 | 0x08 | 0x10))) throw new Error(`Unsupported Bun dependency metadata for ${name}.`)
      const targetIndex = buffers.resolutions.readUInt32LE(dependencyIndex * 4)
      if (targetIndex === 0xffffffff || targetIndex >= records.length) {
        if (behavior & 0x04) {
          if (behavior & 0x10) {
            record.peerDependencies[name] = requested
            record.peerDependenciesMeta[name] = { optional: true }
            record.unresolvedOptionalPeers.push(name)
          } else {
            record.optionalDependencies[name] = requested
            record.unresolvedOptionalDependencies.push(name)
          }
          continue
        }
        throw new Error(`Missing Bun resolution for ${name}.`)
      }
      const target = records[targetIndex]
      if (target.name !== name || !semver.satisfies(target.version, requested)) throw new Error(`Bun dependency identity/version mismatch for ${name}.`)
      const key = `${name}@${requested}`, previous = record.targets.get(key)
      if (previous && previous !== target) throw new Error(`Ambiguous Bun descriptor ${key}.`)
      record.targets.set(key, target)
      if (behavior & 0x10) {
        record.peerDependencies[name] = requested
        if (behavior & 0x04) record.peerDependenciesMeta[name] = { optional: true }
      } else if (behavior & 0x04) record.optionalDependencies[name] = requested
      else if (behavior & 0x08) record.devDependencies = { ...(record.devDependencies ?? {}), [name]: requested }
      else record.dependencies[name] = requested
    }
  }
  const rootRecord = records[0]
  const root = { dependencies: rootRecord.dependencies, devDependencies: rootRecord.devDependencies, optionalDependencies: rootRecord.optionalDependencies, peerDependencies: rootRecord.peerDependencies }
  const locations = new Map<string, any>()
  return { format: "bun-binary-v2", packages: Object.create(null), root, resolve: (name, requested, from = "", location = "") => {
    if (!packageName.test(name) || typeof requested !== "string") throw new Error("Invalid Bun binary lookup.")
    const parent = from ? locations.get(from) : rootRecord
    if (!parent) throw new Error(`Missing Bun binary parent context: ${from}`)
    const exact = parent.targets.get(`${name}@${requested}`)
    if (!exact) throw new Error(`Exact Bun binary descriptor is missing: ${name}@${requested} from ${from || "root"}`)
    if (location) {
      const previous = locations.get(location)
      if (previous && previous !== exact) throw new Error(`Conflicting Bun package identity at ${location}.`)
      locations.set(location, exact)
    }
    return exact
  } }
}
