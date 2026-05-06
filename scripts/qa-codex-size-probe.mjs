#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import crypto from 'node:crypto';

const SIZES = process.argv.slice(2);
const TARGET_SIZES = SIZES.length > 0 ? SIZES : ['1536x1024', '1024x1536', '1024x1024'];

async function loadAuth() {
  const data = await readFile(join(homedir(), '.codex', 'auth.json'), 'utf-8');
  const auth = JSON.parse(data);
  const token = auth?.tokens?.access_token;
  const accountId = auth?.tokens?.account_id;
  if (!token || !accountId) throw new Error('Missing access_token or account_id in ~/.codex/auth.json');
  return { token, accountId };
}

function parseSseText(text) {
  const normalized = text.replace(/\r\n/g, '\n');
  const chunks = normalized.split(/\n\n+/).map((v) => v.trim()).filter(Boolean);
  const events = [];
  for (const block of chunks) {
    let evType = 'message';
    const dataLines = [];
    for (const line of block.split('\n')) {
      if (!line || line.startsWith(':')) continue;
      if (line.startsWith('event:')) evType = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
    const dataText = dataLines.join('\n');
    let data = null;
    if (dataText) {
      try { data = JSON.parse(dataText); } catch { /* skip malformed */ }
    }
    events.push({ event: evType, data });
  }
  return events;
}

function extractImage(events) {
  for (const ev of [...events].reverse()) {
    const item = ev?.data?.item;
    if (item?.type === 'image_generation_call' && item?.result) {
      return { result: item.result, revisedPrompt: item.revised_prompt ?? null };
    }
    if (Array.isArray(ev?.data?.response?.output)) {
      for (const out of ev.data.response.output) {
        if (out?.type === 'image_generation_call' && out?.result) {
          return { result: out.result, revisedPrompt: out.revised_prompt ?? null };
        }
      }
    }
  }
  for (const ev of [...events].reverse()) {
    if (ev?.data?.type === 'response.image_generation_call.partial_image' && ev?.data?.partial_image_b64) {
      return { result: ev.data.partial_image_b64, revisedPrompt: ev.data.revised_prompt ?? null };
    }
  }
  return null;
}

function readPngDims(buf) {
  if (buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    colorType: buf[25],
  };
}

function describeBackendError(events) {
  for (const ev of [...events].reverse()) {
    const e = ev?.data?.error
      || ev?.data?.response?.error
      || ev?.data?.item?.error;
    if (e) return `${e.message ?? ''} code=${e.code ?? ''} type=${e.type ?? ''}`.trim();
  }
  return null;
}

async function probeSize(size, auth, prompt) {
  const body = {
    model: 'gpt-5.4',
    instructions: '',
    input: [
      {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: prompt }],
      },
    ],
    tools: [{ type: 'image_generation', output_format: 'png', size }],
    tool_choice: { type: 'image_generation' },
    parallel_tool_calls: false,
    reasoning: null,
    store: false,
    stream: true,
    include: ['reasoning.encrypted_content'],
  };

  const start = Date.now();
  const response = await fetch('https://chatgpt.com/backend-api/codex/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${auth.token}`,
      'ChatGPT-Account-ID': auth.accountId,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      originator: 'codex_cli_rs',
      session_id: crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const responseText = await response.text();

  if (!response.ok) {
    return {
      size,
      ok: false,
      elapsed,
      status: response.status,
      reason: `HTTP ${response.status}`,
      bodySnippet: responseText.slice(0, 500),
    };
  }

  const events = parseSseText(responseText);
  const backendError = describeBackendError(events);
  const image = extractImage(events);

  if (!image) {
    return {
      size,
      ok: false,
      elapsed,
      status: response.status,
      reason: backendError || 'No image_generation_call in response',
      eventTypes: [...new Set(events.map((e) => e?.data?.type ?? e.event))].slice(0, 10),
    };
  }

  const pngBuf = Buffer.from(image.result, 'base64');
  const dims = readPngDims(pngBuf);
  if (!dims) {
    return { size, ok: false, elapsed, reason: 'Returned non-PNG data' };
  }

  const matches = `${dims.width}x${dims.height}` === size;
  return {
    size,
    ok: true,
    elapsed,
    returnedDims: `${dims.width}x${dims.height}`,
    sizeRespected: matches,
    pngBytes: pngBuf.length,
    revisedPrompt: image.revisedPrompt,
  };
}

async function main() {
  console.log(`Probing codex backend with size param across ${TARGET_SIZES.length} sizes:`);
  console.log(`  sizes: ${TARGET_SIZES.join(', ')}\n`);

  const auth = await loadAuth();
  const prompt = 'A simple flat icon of a banana on a white background.';
  const results = [];

  for (const size of TARGET_SIZES) {
    process.stdout.write(`  ${size} ... `);
    try {
      const result = await probeSize(size, auth, prompt);
      results.push(result);
      if (result.ok && result.sizeRespected) {
        console.log(`✅ ${result.returnedDims} (${result.elapsed}s, ${result.pngBytes} bytes) — size RESPECTED`);
      } else if (result.ok && !result.sizeRespected) {
        console.log(`⚠️  returned ${result.returnedDims} (${result.elapsed}s) — backend ACCEPTED size param but IGNORED it`);
      } else {
        console.log(`❌ ${result.reason} (${result.elapsed}s)`);
        if (result.bodySnippet) console.log(`     body: ${result.bodySnippet.slice(0, 200)}`);
        if (result.eventTypes) console.log(`     eventTypes: ${result.eventTypes.join(', ')}`);
      }
    } catch (e) {
      console.log(`❌ exception: ${e.message}`);
      results.push({ size, ok: false, reason: e.message });
    }
  }

  console.log('\n=== SUMMARY ===');
  const accepted = results.filter((r) => r.ok && r.sizeRespected);
  const rejected = results.filter((r) => !r.ok);
  const ignored = results.filter((r) => r.ok && !r.sizeRespected);

  console.log(`  ✅ size respected: ${accepted.length}/${results.length}`);
  console.log(`  ⚠️  size ignored:  ${ignored.length}/${results.length}`);
  console.log(`  ❌ failed:         ${rejected.length}/${results.length}`);

  if (accepted.length === results.length) {
    console.log('\n🎉 VERDICT: codex backend honors the `size` param in image_generation tool.');
    console.log('   We can ship size support to god-tibo-imagen + BananaTape.');
    process.exit(0);
  } else if (rejected.length === results.length) {
    console.log('\n❌ VERDICT: codex backend rejects the `size` param.');
    console.log('   Need a different approach (prompt engineering, post-processing).');
    process.exit(1);
  } else {
    console.log('\n⚠️  VERDICT: mixed results — some sizes work, some don\'t.');
    console.log('   See details above. Likely partial support.');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(2);
});
