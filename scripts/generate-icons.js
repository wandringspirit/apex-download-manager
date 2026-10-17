import fs from 'fs';
import path from 'path';

// Minimal valid 1x1 or small PNG buffer generator for Chrome extension placeholder
// Chrome accepts standard PNG chunks: IHDR, IDAT, IEND
function createSolidPng(width, height, r, g, b) {
  // A simple 1-pixel transparent/colored PNG header
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type);
    const crcBuf = Buffer.alloc(4);
    // Simple mock crc/structure
    let crc = 0xFFFFFFFF;
    const combined = Buffer.concat([typeBuf, data]);
    for (let i = 0; i < combined.length; i++) {
      crc ^= combined[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (-(crc & 1) & 0xEDB88320);
      }
    }
    crc = (crc ^ 0xFFFFFFFF) >>> 0;
    crcBuf.writeUInt32BE(crc, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Raw scanlines with filter byte 0
  const scanlineLen = 1 + width * 3;
  const rawData = Buffer.alloc(scanlineLen * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLen;
    rawData[rowOffset] = 0; // filter none
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 3;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
    }
  }

  import('zlib').then(zlib => {
    const compressed = zlib.deflateSync(rawData);
    const png = Buffer.concat([
      signature,
      chunk('IHDR', ihdr),
      chunk('IDAT', compressed),
      chunk('IEND', Buffer.alloc(0))
    ]);

    const outDir = path.join(process.cwd(), 'extension', 'icons');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    fs.writeFileSync(path.join(outDir, `icon${width}.png`), png);
  });
}

createSolidPng(16, 16, 14, 165, 233);
createSolidPng(48, 48, 14, 165, 233);
createSolidPng(128, 128, 14, 165, 233);
