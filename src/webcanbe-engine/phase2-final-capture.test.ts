import { createRequire } from "node:module"
import { deflateSync } from "node:zlib"
import fs from "node:fs"
import { randomUUID } from "node:crypto"
import { afterEach, describe, expect, it, vi } from "vitest"
import { LocalLimaRunnerProvider } from "./runtime/localLimaRunner"
import { snapshotPreview } from "./runtime/controlledPreview"
const {CAPTURE_DEADLINE_MS,crc32,validateRasterPng,boundedRaster,captureRaster}=createRequire(import.meta.url)("../../scripts/runner/raster-capture.cjs")
function png(width=320,height=240) {
  const chunk=(type:string,data:Buffer)=>{const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(type,4);data.copy(b,8);b.writeUInt32BE(crc32(b.subarray(4,b.length-4)),b.length-4);return b}
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=2
  return Buffer.concat([Buffer.from("89504e470d0a1a0a","hex"),chunk("IHDR",header),chunk("IDAT",deflateSync(Buffer.alloc((width*3+1)*height))),chunk("IEND",Buffer.alloc(0))])
}
afterEach(()=>vi.useRealTimers())
it("captures only the fixed bounded PNG command and validates exact viewport and raster integrity",async()=>{
  const bytes=png(),send=vi.fn(async()=>({data:bytes.toString("base64")}))
  expect(await captureRaster({send},{width:320,height:240})).toEqual(bytes)
  expect(send).toHaveBeenCalledExactlyOnceWith("Page.captureScreenshot",{format:"png",fromSurface:true,captureBeyondViewport:false,optimizeForSpeed:true})
  expect(CAPTURE_DEADLINE_MS).toBe(4000)
})
it.each(["dimensions","checksum","truncated","trailing","missing-end","oversize","signature"])("rejects captured %s corruption",kind=>{
  let bytes=png()
  if(kind==="dimensions")bytes=png(321)
  if(kind==="checksum")bytes[bytes.length-1]^=1
  if(kind==="truncated")bytes=bytes.subarray(0,20)
  if(kind==="trailing")bytes=Buffer.concat([bytes,Buffer.from([1])])
  if(kind==="missing-end")bytes=bytes.subarray(0,bytes.length-12)
  if(kind==="oversize")bytes=Buffer.alloc(9*1024*1024+1)
  if(kind==="signature")bytes[0]=0
  expect(()=>validateRasterPng(bytes,{width:320,height:240})).toThrow()
})
it("closes once at the unchanged deadline and never returns a late raster",async()=>{
  vi.useFakeTimers();let release!:(value:string)=>void;const close=vi.fn(),pending=boundedRaster(()=>new Promise(r=>{release=r}),close)
  const result=expect(pending).rejects.toThrow("4000ms")
  await vi.advanceTimersByTimeAsync(3999);expect(close).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1);await result;expect(close).toHaveBeenCalledOnce()
  release("late raster");await vi.runAllTimersAsync();expect(close).toHaveBeenCalledOnce()
})
it("rejects malformed protocol encoding and clears a successful deadline",async()=>{
  for(const data of [null,"", "A===", "YWJj\n", "a".repeat(12*1024*1024+4)])await expect(captureRaster({send:async()=>({data})},{width:320,height:240})).rejects.toThrow()
  vi.useFakeTimers();const close=vi.fn();expect(await boundedRaster(async()=>"raster",close)).toBe("raster");await vi.advanceTimersByTimeAsync(4001);expect(close).not.toHaveBeenCalled()
})
;(process.env.WCB_CAPTURE_TEST==="1"?describe:describe.skip)("production fixed capture in actual no-egress native-sandbox Linux",()=>{
  it.each(["dom","webgl"])("captures %s, input and viewport changes within 4000 ms",async kind=>{
    const html=kind==="dom"?'<body style="margin:0;background:#123456"><button style="width:300px;height:80px" onclick="this.textContent=\'Clicked\';console.log(\'clicked\')">Native DOM capture</button></body>':`<body style="margin:0"><canvas width="1280" height="900"></canvas><button style="position:absolute;top:0;left:0;width:300px;height:80px" onclick="console.log('clicked')">WebGL capture</button><script>const gl=document.querySelector('canvas').getContext('webgl');if(!gl)throw Error('No WebGL');function draw(){gl.clearColor(0.2,0.6,0.8,1);gl.clear(gl.COLOR_BUFFER_BIT);requestAnimationFrame(draw)}draw();console.log('webgl-ready');</script></body>`
    const generation=randomUUID(),runner=new LocalLimaRunnerProvider(process.cwd()),snapshot=snapshotPreview({html,files:new Map()}),execution=await runner.open({generation,origin:'http://wcb-'+generation+'.preview.invalid',expiresAt:Date.now()+60000,revision:'rev_'+randomUUID(),route:'/',network:{external:'deny'},snapshot},new AbortController().signal)
    try{
      const began=performance.now(),frame=await execution.sample!(),elapsed=performance.now()-began;expect(elapsed).toBeLessThan(4000);validateRasterPng(Buffer.from(frame.bytes),{width:1280,height:900})
      fs.mkdirSync('.webcanbe/final-internal-capture',{recursive:true});fs.writeFileSync('.webcanbe/final-internal-capture/'+kind+'.png',frame.bytes)
      if(kind==='webgl')expect((frame.observation as any).logs).toContain('log: webgl-ready')
      await execution.input({type:'pointer',action:'click',x:80,y:40});expect((await execution.sample!()).observation).toMatchObject({logs:expect.arrayContaining(['log: clicked'])})
      await execution.input({type:'viewport',width:390,height:844});const mobile=await execution.sample!();validateRasterPng(Buffer.from(mobile.bytes),{width:390,height:844})
      fs.writeFileSync('.webcanbe/final-internal-capture/'+kind+'-metrics.json',JSON.stringify({scope:'Actual local TEST production worker; no deployed capacity claim',captureMs:elapsed,ordinaryDeadlineMs:4000,interaction:true,viewport:true}))
    }finally{await execution.close()}
  },20000)
})
