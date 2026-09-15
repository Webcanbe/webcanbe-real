import {expect,it} from 'vitest'
import {decodeBunBinaryLock} from './runtime/bunBinaryLock'

const header=Buffer.from('#!/usr/bin/env bun\nbun-lockfile-format-v0\n')
const widths=[8,8,64,8,8,88,20,48]
const u32=(n:number)=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b}
const u64=(n:number)=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(n));return b}
const inline=(value:string)=>{const b=Buffer.alloc(8);Buffer.from(value).copy(b);return b}
const external=(offset:number,length:number)=>{const b=Buffer.alloc(8);b.writeUInt32LE(offset,0);b.writeUInt32LE(length+0x80000000,4);return b}
const slice=(offset:number,length:number)=>Buffer.concat([u32(offset),u32(length)])

function fixture(options:{behavior?:number;resolutionTag?:number;target?:number}={}){
  const url=Buffer.from('https://registry.npmjs.org/react/-/react-19.0.0.tgz')
  const stringBytes=url
  const begin=header.length+4+32+8+8+8+8+8+8
  const packageTableBytes=2*widths.reduce((a,b)=>a+b,0),end=begin+packageTableBytes
  const dep=Buffer.alloc(26);inline('react').copy(dep,0);dep[16]=options.behavior??2;dep[17]=0;inline('^19.0.0').copy(dep,18)
  const buffers=[Buffer.alloc(0),Buffer.alloc(0),u32(options.target??1),dep,Buffer.alloc(0),stringBytes]
  const serialized:Buffer[]=[];let cursor=end
  for(const b of buffers){const start=cursor+16,finish=start+b.length;serialized.push(u64(start),u64(finish),b);cursor=finish}
  const serializedEnd=cursor

  const rootName=inline('app'),pkgName=inline('react')
  const rootResolution=Buffer.alloc(64);rootResolution[0]=1
  const pkgResolution=Buffer.alloc(64);pkgResolution[0]=options.resolutionTag??2;external(0,url.length).copy(pkgResolution,8);pkgResolution.writeUInt32LE(19,16)
  const rootMeta=Buffer.alloc(88),pkgMeta=Buffer.alloc(88);pkgMeta[20]=4;for(let i=0;i<64;i++)pkgMeta[21+i]=i+1
  const values=[
    [rootName,pkgName],
    [Buffer.alloc(8),Buffer.alloc(8)],
    [rootResolution,pkgResolution],
    [slice(0,1),slice(1,0)],
    [slice(0,1),slice(1,0)],
    [rootMeta,pkgMeta],
    [Buffer.alloc(20),Buffer.alloc(20)],
    [Buffer.alloc(48),Buffer.alloc(48)],
  ]
  const packageTable=Buffer.concat(values.flat())
  expect(packageTable.length).toBe(packageTableBytes)
  return Buffer.concat([
    header,u32(2),Buffer.alloc(32,7),u64(serializedEnd),u64(2),u64(8),u64(8),u64(begin),u64(end),
    packageTable,...serialized,
  ])
}

it('decodes a bounded Bun format-v0 npm graph without executing Bun',()=>{
  const lock=fixture(),decoded=decodeBunBinaryLock(lock),react=decoded.byId.get(1)!
  expect(decoded.serializerVersion).toBe(2)
  expect(decoded.root.dependencies).toEqual({react:'^19.0.0'})
  expect(react.name).toBe('react');expect(react.version).toBe('19.0.0')
  expect(react.resolved).toBe('https://registry.npmjs.org/react/-/react-19.0.0.tgz')
  expect(react.integrity).toBe('sha512-'+Buffer.from(Array.from({length:64},(_,i)=>i+1)).toString('base64'))
  expect(decoded.descriptors.get('react@^19.0.0')).toBe(react)
})

it('fails closed on truncation, unsupported resolutions, workspace behavior and escaped targets',()=>{
  expect(()=>decodeBunBinaryLock(fixture().subarray(0,-1))).toThrow()
  expect(()=>decodeBunBinaryLock(fixture({resolutionTag:32}))).toThrow('Only Bun npm package resolutions')
  expect(()=>decodeBunBinaryLock(fixture({behavior:32}))).toThrow('workspace dependency')
  expect(()=>decodeBunBinaryLock(fixture({target:9}))).toThrow('outside the package table')
})
