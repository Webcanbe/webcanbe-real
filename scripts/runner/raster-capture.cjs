// Trusted fixed raster implementation, shared by production worker and isolated QA.
// No imported source, DOM or caller-selected CDP method becomes authority here.
const CAPTURE_DEADLINE_MS = 4000;
const MAX_PNG_BYTES = 9 * 1024 * 1024;
const signature = Buffer.from('89504e470d0a1a0a', 'hex');
const crcTable = Array.from({length:256}, (_, n) => {
  for (let i=0;i<8;i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function validateRasterPng(png, viewport) {
  if (!Buffer.isBuffer(png) || png.length < 57 || png.length > MAX_PNG_BYTES || !png.subarray(0,8).equals(signature)) throw Error('Invalid captured PNG');
  let offset=8, first=true, data=false, end=false;
  while (offset < png.length) {
    if (offset+12 > png.length) throw Error('Truncated captured PNG');
    const size=png.readUInt32BE(offset), next=offset+12+size;
    if (size > MAX_PNG_BYTES || next > png.length) throw Error('Invalid captured PNG length');
    const type=png.toString('ascii',offset+4,offset+8);
    if (png.readUInt32BE(next-4) !== crc32(png.subarray(offset+4,next-4))) throw Error('Captured PNG checksum mismatch');
    if (first) {
      if (type !== 'IHDR' || size !== 13 || png.readUInt32BE(offset+8) !== viewport.width || png.readUInt32BE(offset+12) !== viewport.height) throw Error('Captured PNG viewport mismatch');
      first=false;
    } else if (type === 'IHDR') throw Error('Duplicate captured PNG header');
    if (type === 'IDAT') data=true;
    if (type === 'IEND') {
      if (size !== 0 || next !== png.length || !data) throw Error('Invalid captured PNG end');
      end=true;
    }
    offset=next;
  }
  if (!end) throw Error('Incomplete captured PNG');
  return png;
}
async function boundedRaster(operation, onTimeout) {
  let timer, expired=false;
  const deadline=new Promise((_,reject)=>{
    timer=setTimeout(()=>{
      expired=true;
      reject(Error('Raster capture exceeded 4000ms deadline'));
      // Closing the browser retires outstanding protocol work. Provider cleanup
      // still verifies the entire cgroup before capacity can be reused.
      try { Promise.resolve(onTimeout()).catch(()=>{}); } catch {}
    },CAPTURE_DEADLINE_MS);
  });
  try {
    const result=await Promise.race([Promise.resolve().then(operation),deadline]);
    if (expired) throw Error('Expired raster capture');
    return result;
  } finally { clearTimeout(timer); }
}
async function captureRaster(cdp, viewport) {
  const result=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false,optimizeForSpeed:true});
  if (typeof result?.data !== 'string' || result.data.length > Math.ceil(MAX_PNG_BYTES/3)*4 || result.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(result.data)) throw Error('Invalid captured raster encoding');
  const png=Buffer.from(result.data,'base64');
  if (png.toString('base64') !== result.data) throw Error('Noncanonical captured raster encoding');
  return validateRasterPng(png,viewport);
}
module.exports={CAPTURE_DEADLINE_MS,MAX_PNG_BYTES,crc32,validateRasterPng,boundedRaster,captureRaster};
