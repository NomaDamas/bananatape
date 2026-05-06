#!/usr/bin/env node
import OpenAI from 'openai';
import { writeFileSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import zlib from 'zlib';

const SOURCE_SIZE = process.argv[2] ?? '1024x1024';
const OUTPUT_SIZE = process.argv[3] ?? '1536x1024';
const PROMPT = process.argv[4] ?? 'Place a yellow banana inside the central transparent area. Keep the four colored corner markers untouched.';

if (!process.env.OPENAI_API_KEY) {
  console.error('FAIL: OPENAI_API_KEY is not set');
  process.exit(1);
}

const [SW, SH] = SOURCE_SIZE.split('x').map(Number);
const [OW, OH] = OUTPUT_SIZE.split('x').map(Number);
if (![SW, SH, OW, OH].every(Number.isFinite)) {
  console.error(`FAIL: invalid sizes '${SOURCE_SIZE}' / '${OUTPUT_SIZE}'`);
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

function encodePng(width, height, pixels) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

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
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colorType: buf[25] };
}

function fillRect(pixels, width, x, y, w, h, rgba) {
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      const idx = (py * width + px) * 4;
      pixels[idx] = rgba[0];
      pixels[idx + 1] = rgba[1];
      pixels[idx + 2] = rgba[2];
      pixels[idx + 3] = rgba[3];
    }
  }
}

function buildSource(width, height) {
  const pixels = Buffer.alloc(width * height * 4);
  fillRect(pixels, width, 0, 0, width, height, [240, 240, 240, 255]);
  const marker = Math.round(Math.min(width, height) * 0.12);
  fillRect(pixels, width, 0, 0, marker, marker, [255, 0, 0, 255]);
  fillRect(pixels, width, width - marker, 0, marker, marker, [0, 200, 0, 255]);
  fillRect(pixels, width, 0, height - marker, marker, marker, [0, 80, 255, 255]);
  fillRect(pixels, width, width - marker, height - marker, marker, marker, [255, 200, 0, 255]);
  return { png: encodePng(width, height, pixels), markerSize: marker };
}

function buildMask(width, height) {
  const pixels = Buffer.alloc(width * height * 4);
  fillRect(pixels, width, 0, 0, width, height, [255, 255, 255, 255]);
  const rectW = Math.round(width * 0.4);
  const rectH = Math.round(height * 0.4);
  const rectX = Math.round((width - rectW) / 2);
  const rectY = Math.round((height - rectH) / 2);
  fillRect(pixels, width, rectX, rectY, rectW, rectH, [0, 0, 0, 0]);
  return { png: encodePng(width, height, pixels), rect: { x: rectX, y: rectY, w: rectW, h: rectH } };
}

const tmpDir = mkdtempSync(join(tmpdir(), 'bananatape-qa-aspect-'));
const sourcePath = join(tmpDir, 'source.png');
const maskPath = join(tmpDir, 'mask.png');

console.log(`Source:  ${SOURCE_SIZE} with 4 corner markers (red/green/blue/yellow)`);
console.log(`Output:  ${OUTPUT_SIZE} (different aspect → previous code would have cropped corners)`);
const { png: sourcePng, markerSize } = buildSource(SW, SH);
const { png: maskPng, rect } = buildMask(SW, SH);
writeFileSync(sourcePath, sourcePng);
writeFileSync(maskPath, maskPng);

console.log(`  source corner marker size: ${markerSize}px`);
console.log(`  mask transparent rect:     ${rect.w}x${rect.h} at (${rect.x},${rect.y})`);
console.log(`  source: ${sourcePath}`);
console.log(`  mask:   ${maskPath}`);

const openai = new OpenAI();
const { toFile } = await import('openai');

console.log(`\nCalling openai.images.edit({ size: '${OUTPUT_SIZE}', quality: 'low' })...`);
const start = Date.now();

let response;
try {
  response = await openai.images.edit({
    model: 'gpt-image-2',
    image: await toFile(sourcePng, 'source.png', { type: 'image/png' }),
    mask: await toFile(maskPng, 'mask.png', { type: 'image/png' }),
    prompt: PROMPT,
    n: 1,
    size: OUTPUT_SIZE,
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
  process.exit(1);
}

const outBuf = Buffer.from(b64, 'base64');
const outPath = join(tmpDir, `output-${SOURCE_SIZE}-to-${OUTPUT_SIZE}.png`);
writeFileSync(outPath, outBuf);

const outDims = readPngDims(outBuf);
if (!outDims) {
  console.error('FAIL: Output is not a valid PNG');
  process.exit(1);
}

console.log(`\nOUTPUT:`);
console.log(`  path:       ${outPath}`);
console.log(`  bytes:      ${outBuf.length}`);
console.log(`  dimensions: ${outDims.width}x${outDims.height}`);

if (`${outDims.width}x${outDims.height}` !== OUTPUT_SIZE) {
  console.error(`FAIL: Output dimensions do not match requested ${OUTPUT_SIZE}`);
  process.exit(1);
}

console.log(`\n✅ Server returned a ${OUTPUT_SIZE} PNG without rejecting a ${SOURCE_SIZE} input.`);
console.log(`\nMANUAL CHECK:`);
console.log(`  open ${outPath}`);
console.log(`  → All four corner markers should still be present (red TL, green TR, blue BL, yellow BR).`);
console.log(`  → A banana should appear in the center where the mask was transparent.`);
console.log(`  → If a corner is missing or warped, the input was cropped before reaching OpenAI.`);
