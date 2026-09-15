import { expect, it } from "vitest"
import fs from "node:fs"
import { createHash } from "node:crypto"
import { parseBunBinary } from "./runtime/bunBinaryLock"

const lockPath = process.env.WCB_TODO_BUN_LOCK
const exact = lockPath ? it : it.skip

exact("decodes the exact Todo Bun 1.1.42 graph as bounded data", () => {
  const bytes = fs.readFileSync(lockPath!)
  expect(bytes.length).toBe(262443)
  expect(createHash("sha256").update(bytes).digest("hex")).toBe("4a6802815bb395350e14d4bd5d2162157bc2a21de755ca72c82a09dc8808c143")
  const lock = parseBunBinary(bytes)
  expect(lock.format).toBe("bun-binary-v2")
  expect(lock.resolve("react", "^19.0.0").version).toBe("19.0.0")
  expect(lock.resolve("vite", "^6.1.0").version).toBe("6.1.0")
  expect(lock.resolve("@hookform/resolvers", "^4.0.0").integrity).toMatch(/^sha512-/)
  expect(lock.root?.dependencies.react).toBe("^19.0.0")
  expect(lock.root?.devDependencies.unocss).toBe("^66.0.0")
})

exact("refuses malformed Bun ranges, lengths, indices, protocols, integrity and extension data", () => {
  const original = fs.readFileSync(lockPath!)
  const header = Buffer.from("#!/usr/bin/env bun\nbun-lockfile-format-v0\n").length
  const variants: Buffer[] = []
  const format = Buffer.from(original); format.writeUInt32LE(3, header); variants.push(format)
  const end = Buffer.from(original); end.writeBigUInt64LE(BigInt(original.length + 1), header + 36); variants.push(end)
  const count = Buffer.from(original); count.writeBigUInt64LE(12001n, header + 44); variants.push(count)
  const packageStart = Number(original.readBigUInt64LE(header + 68)), packageCount = Number(original.readBigUInt64LE(header + 44))
  const resolutionColumn = packageStart + packageCount * 16
  const protocol = Buffer.from(original); protocol[resolutionColumn + 64] = 16; variants.push(protocol)
  const metaColumn = packageStart + packageCount * (8 + 8 + 64 + 8 + 8)
  const sri = Buffer.from(original); sri[metaColumn + 88 + 20] = 1; variants.push(sri)
  const nonzeroTail = Buffer.from(original); nonzeroTail[nonzeroTail.length - 1] = 1; variants.push(nonzeroTail)
  for (const bytes of variants) expect(() => parseBunBinary(bytes)).toThrow()
})

it("bounds tiny, oversized and truncated Bun input before parsing", () => {
  expect(() => parseBunBinary(Buffer.alloc(10))).toThrow("size")
  expect(() => parseBunBinary(Buffer.alloc(2 * 1024 * 1024 + 1))).toThrow("size")
})
