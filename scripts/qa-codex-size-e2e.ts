#!/usr/bin/env node
import { generateImage } from '../src/lib/providers/god-tibo-provider';
import { writeFileSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const SIZE = process.argv[2] ?? '1536x1024';
const PROMPT = process.argv[3] ?? 'A simple flat banana sticker on a white background.';

async function main() {
  const tmpDir = mkdtempSync(join(tmpdir(), 'bananatape-codex-qa-'));
  console.log(`Probing BananaTape's god-tibo-provider with size=${SIZE}...`);

  const start = Date.now();
  const dataUrl = await generateImage({ prompt: PROMPT, size: SIZE });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  const b64 = dataUrl.split(',')[1];
  const buf = Buffer.from(b64, 'base64');
  const sig = buf.subarray(0, 8).toString('hex');
  if (sig !== '89504e470d0a1a0a') {
    console.error('FAIL: returned data is not a PNG');
    process.exit(1);
  }
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  const outPath = join(tmpDir, `output-${SIZE}.png`);
  writeFileSync(outPath, buf);

  console.log(`  responded in ${elapsed}s`);
  console.log(`  dimensions: ${w}x${h}`);
  console.log(`  bytes: ${buf.length}`);
  console.log(`  saved: ${outPath}`);

  if (`${w}x${h}` !== SIZE) {
    console.error(`\n❌ FAIL: dims ${w}x${h} != requested ${SIZE}`);
    process.exit(1);
  }
  console.log(`\n✅ PASS — codex provider in BananaTape returned ${SIZE} as requested`);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(2); });
