#!/usr/bin/env node
import OpenAI from 'openai';
import { writeFileSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import zlib from 'zlib';

const SIZE = process.argv[2] ?? '1536x1024';
const PROMPT = process.argv[3] ?? 'Place a small red ball in the transparent area of the mask.';

if (!process.env.OPENAI_API_KEY) {
  console.error('FAIL: OPENAI_API_KEY is not set');
  process.exit(1);
}

const [W, H] = SIZE.split('x').map(Number);
if (!Number.isFinite(W) || !Number.isFinite(H)) {
  console.error(`FAIL: invalid size '${SIZE}'`);
  process.exit(1);
}

function crc32(buf) {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = table[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function buildPng(width, height, fillRgba, transparentRect = null) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const pixels = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    pixels[i * 4] = fillRgba[0];
    pixels[i * 4 + 1] = fillRgba[1];
    pixels[i * 4 + 2] = fillRgba[2];
    pixels[i * 4 + 3] = fillRgba[3];
  }
  if (transparentRect) {
    const { x, y, w, h } = transparentRect;
    for (let py = y; py < y + h && py < height; py++) {
      for (let px = x; px < x + w && px < width; px++) {
        pixels[(py * width + px) * 4 + 3] = 0;
      }
    }
  }

  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    pixels.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw);

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function readPngDims(buf) {
  if (buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  const colorType = buf[25];
  return { width: w, height: h, colorType };
}

const tmpDir = mkdtempSync(join(tmpdir(), 'bananatape-qa-'));
const sourcePath = join(tmpDir, 'source.png');
const maskPath = join(tmpDir, 'mask.png');

console.log(`Generating synthetic ${SIZE} fixture...`);
const sourcePng = buildPng(W, H, [200, 230, 255, 255]);
writeFileSync(sourcePath, sourcePng);

const rectW = Math.round(W * 0.2);
const rectH = Math.round(H * 0.2);
const rectX = Math.round((W - rectW) / 2);
const rectY = Math.round((H - rectH) / 2);
const maskPng = buildPng(W, H, [255, 255, 255, 255], { x: rectX, y: rectY, w: rectW, h: rectH });
writeFileSync(maskPath, maskPng);

const sourceDims = readPngDims(sourcePng);
const maskDims = readPngDims(maskPng);
console.log(`  source: ${sourcePath} (${sourceDims.width}x${sourceDims.height} colorType=${sourceDims.colorType})`);
console.log(`  mask:   ${maskPath} (${maskDims.width}x${maskDims.height} colorType=${maskDims.colorType}) transparent rect ${rectW}x${rectH} at (${rectX},${rectY})`);

const openai = new OpenAI();

console.log(`\nCalling openai.images.edit({ model: 'gpt-image-2', size: '${SIZE}', quality: 'low' })...`);
const start = Date.now();

let response;
try {
  const { toFile } = await import('openai');
  response = await openai.images.edit({
    model: 'gpt-image-2',
    image: await toFile(sourcePng, 'source.png', { type: 'image/png' }),
    mask: await toFile(maskPng, 'mask.png', { type: 'image/png' }),
    prompt: PROMPT,
    n: 1,
    size: SIZE,
    quality: 'low',
  });
} catch (e) {
  console.error(`FAIL: OpenAI API error: ${e.message}`);
  if (e.response) console.error(JSON.stringify(e.response, null, 2));
  process.exit(1);
}

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log(`  responded in ${elapsed}s`);

const b64 = response.data?.[0]?.b64_json;
if (!b64) {
  console.error('FAIL: No b64_json in response');
  console.error(JSON.stringify(response, null, 2));
  process.exit(1);
}

const outBuf = Buffer.from(b64, 'base64');
const outPath = join(tmpDir, `output-${Date.now()}.png`);
writeFileSync(outPath, outBuf);

const outDims = readPngDims(outBuf);
if (!outDims) {
  console.error('FAIL: Output is not a valid PNG');
  process.exit(1);
}

console.log(`\nOUTPUT:`);
console.log(`  path:       ${outPath}`);
console.log(`  size:       ${outBuf.length} bytes`);
console.log(`  dimensions: ${outDims.width}x${outDims.height}`);
console.log(`  colorType:  ${outDims.colorType}`);

const expectedDims = `${outDims.width}x${outDims.height}`;
if (expectedDims !== SIZE) {
  console.error(`\nFAIL: Output dimensions ${expectedDims} do not match requested size ${SIZE}`);
  process.exit(1);
}

console.log(`\n✅ PASS — output is a valid ${SIZE} PNG`);
console.log(`Open it with: open ${outPath}`);
