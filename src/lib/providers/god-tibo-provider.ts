import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';

interface CodexAuth {
  tokens?: {
    access_token?: string;
    account_id?: string;
  };
}

async function loadAuthToken(readFileImpl: typeof readFile): Promise<{ token: string; accountId: string }> {
  const authPath = join(homedir(), '.codex', 'auth.json');
  const data = await readFileImpl(authPath, 'utf-8');
  const auth: CodexAuth = JSON.parse(data);

  const token = auth.tokens?.access_token;
  const accountId = auth.tokens?.account_id;

  if (!token || !accountId) {
    throw new Error('Missing access_token or account_id in ~/.codex/auth.json');
  }

  return { token, accountId };
}

export interface GenerateImageOptions {
  prompt: string;
  model?: string;
  images?: string[];
  size?: string;
  fetchImpl?: typeof fetch;
  readFileImpl?: typeof readFile;
}



interface SseEvent {
  event: string;
  data: unknown;
  raw: string;
}

function parseEventBlock(block: string): SseEvent {
  const lines = block.split(/\r?\n/);
  let event = 'message';
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(':')) {
      continue;
    }
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
      continue;
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  const dataText = dataLines.join('\n');
  let data: unknown = null;
  if (dataText) {
    try {
      data = JSON.parse(dataText);
    } catch {
      throw new Error(`Malformed SSE JSON payload for event ${event}`);
    }
  }

  return { event, data, raw: block };
}

interface SseSummary {
  events: SseEvent[];
  items: unknown[];
  responseId: string | null;
}

function parseSseText(text: string): SseSummary {
  const normalized = text.replace(/\r\n/g, '\n');
  const chunks = normalized
    .split(/\n\n+/)
    .map((v) => v.trim())
    .filter(Boolean);
  const events = chunks.map(parseEventBlock);
  return summarizeEvents(events);
}

function summarizeEvents(events: SseEvent[]): SseSummary {
  const items: unknown[] = [];
  let responseId: string | null = null;

  for (const event of events) {
    const type = (event?.data as Record<string, unknown> | undefined)?.type;
    const response = (event?.data as Record<string, unknown> | undefined)?.response as Record<string, unknown> | undefined;

    if (type === 'response.created') {
      responseId =
        response?.id?.toString() ?? responseId;
    }
    if (type === 'response.output_item.done') {
      const item = (event?.data as Record<string, unknown> | undefined)?.item;
      if (item) {
        items.push(item);
      }
    }
    if (type === 'response.completed') {
      responseId =
        response?.id?.toString() ?? responseId;
      if (Array.isArray(response?.output)) {
        items.push(...response.output);
      }
    }
  }

  return { events, items, responseId };
}



interface ImageGenerationResult {
  callId: string | undefined;
  revisedPrompt: string | null;
  resultBase64: string;
  item: unknown;
}

type ImageToolChoiceMode = 'auto' | 'required';

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? value as Record<string, unknown> : undefined;
}

function describeBackendError(source: SseSummary): string | null {
  for (const event of [...source.events].reverse()) {
    const data = getRecord(event.data);
    const error = getRecord(data?.error)
      ?? getRecord(getRecord(data?.response)?.error)
      ?? getRecord(getRecord(data?.item)?.error);
    const directMessage = data?.message?.toString();

    if (!error && !directMessage) {
      continue;
    }

    const message = error?.message?.toString() ?? directMessage;
    const code = error?.code?.toString();
    const type = error?.type?.toString();
    const details = [
      message,
      code ? `code=${code}` : null,
      type ? `type=${type}` : null,
    ].filter(Boolean).join(' ');

    if (details) {
      return details;
    }
  }

  return null;
}

function describeHttpFailureBody(body: string): string | null {
  if (!body.trim()) {
    return null;
  }

  try {
    const payload = JSON.parse(body);
    const error = getRecord(payload?.error);
    const message = error?.message?.toString();
    const code = error?.code?.toString();
    const type = error?.type?.toString();

    if (message || code || type) {
      return [
        message,
        code ? `code=${code}` : null,
        type ? `type=${type}` : null,
      ].filter(Boolean).join(' ');
    }
  } catch {
    // Fall through to a trimmed text snippet.
  }

  return body.trim().slice(0, 500);
}

function normalizeSource(source: SseSummary | unknown[]): { items: unknown[]; events: SseEvent[] } {
  if (Array.isArray(source)) {
    return { items: source, events: [] };
  }
  const s = source as SseSummary | undefined;
  return {
    items: s?.items || [],
    events: (s?.events || []) as SseEvent[],
  };
}

function extractImageGeneration(source: SseSummary | unknown[]): ImageGenerationResult {
  const { items, events } = normalizeSource(source);

  const imageItem = [...items]
    .reverse()
    .find((item) => (item as Record<string, unknown> | undefined)?.type === 'image_generation_call' && (item as Record<string, unknown> | undefined)?.result);

  if (imageItem) {
    const it = imageItem as Record<string, unknown>;
    return {
      callId: it.id as string | undefined,
      revisedPrompt: (it.revised_prompt as string | null) ?? null,
      resultBase64: it.result as string,
      item: imageItem,
    };
  }

  const partialImageEvent = [...events]
    .reverse()
    .find((event) => {
      const d = event?.data as Record<string, unknown> | undefined;
      return d?.type === 'response.image_generation_call.partial_image' && d?.partial_image_b64;
    });

  if (partialImageEvent) {
    const d = partialImageEvent.data as Record<string, unknown>;
    return {
      callId: d.item_id as string,
      revisedPrompt: (d.revised_prompt as string | null) ?? null,
      resultBase64: d.partial_image_b64 as string,
      item: {
        type: 'image_generation_call',
        id: d.item_id,
        status: 'completed',
        revised_prompt: (d.revised_prompt as string | null) ?? null,
        result: d.partial_image_b64,
      },
    };
  }

  const summary = Array.isArray(source)
    ? { events: [], items, responseId: null }
    : source;
  const backendError = describeBackendError(summary);
  const eventTypes = [...new Set(events.map((event) => {
    const d = event?.data as Record<string, unknown> | undefined;
    return d?.type?.toString() ?? event.event;
  }))].join(', ');
  const outputTypes = [...new Set(items.map((item) => {
    const it = item as Record<string, unknown> | undefined;
    return it?.type?.toString() ?? 'unknown';
  }))].join(', ');

  throw new Error(
    [
      'The response stream completed without an image_generation_call result.',
      backendError ? `Backend error: ${backendError}.` : null,
      eventTypes ? `Events: ${eventTypes}.` : null,
      outputTypes ? `Output items: ${outputTypes}.` : null,
    ].filter(Boolean).join(' '),
  );
}

async function requestImageGeneration(
  options: GenerateImageOptions,
  auth: { token: string; accountId: string },
  content: Array<{ type: string; text?: string; image_url?: string }>,
  toolChoiceMode: ImageToolChoiceMode,
): Promise<ImageGenerationResult> {
  const { token, accountId } = auth;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const response = await fetchImpl('https://chatgpt.com/backend-api/codex/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'ChatGPT-Account-ID': accountId,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      originator: 'codex_cli_rs',
      session_id: crypto.randomUUID(),
    },
    body: JSON.stringify({
      model: options.model ?? 'gpt-5.4',
      instructions: '',
      input: [
        {
          type: 'message',
          role: 'user',
          content,
        },
      ],
      tools: [{
        type: 'image_generation',
        output_format: 'png',
        ...(options.size ? { size: options.size } : {}),
      }],
      tool_choice: toolChoiceMode === 'required' ? { type: 'image_generation' } : 'auto',
      parallel_tool_calls: false,
      reasoning: null,
      store: false,
      stream: true,
      include: ['reasoning.encrypted_content'],
    }),
  });

  if (!response.ok) {
    const failureText = await response.text();
    const failureDetails = describeHttpFailureBody(failureText);
    const error = new Error(
      [
        `Private Codex backend request failed with HTTP ${response.status}.`,
        failureDetails ? `Backend error: ${failureDetails}.` : null,
      ].filter(Boolean).join(' '),
    );
    (error as Error & { status?: number; body?: string }).status = response.status;
    (error as Error & { status?: number; body?: string }).body = failureText;
    throw error;
  }

  const responseBody = await response.text();

  const trimmed = responseBody.trimStart();
  const shouldParseAsSse =
    (response.headers.get('content-type') || '').includes('text/event-stream') ||
    trimmed.startsWith('event:') ||
    trimmed.startsWith('data:');

  let parsed: SseSummary;
  if (shouldParseAsSse) {
    parsed = parseSseText(responseBody);
  } else {
    const payload = JSON.parse(responseBody);
    parsed = {
      events: [],
      items: Array.isArray(payload?.output) ? payload.output : [],
      responseId: payload?.id ?? null,
    };
  }

  return extractImageGeneration(parsed);
}

export async function generateImage(options: GenerateImageOptions): Promise<string> {
  const auth = await loadAuthToken(options.readFileImpl ?? readFile);

  const content: Array<{ type: string; text?: string; image_url?: string }> = [
    { type: 'input_text', text: options.prompt },
  ];

  if (options.images && options.images.length > 0) {
    for (const image of options.images) {
      content.push({ type: 'input_image', image_url: image });
    }
  }

  const attempts: ImageToolChoiceMode[] = ['auto', 'required'];
  let lastError: unknown;

  for (const mode of attempts) {
    try {
      const generation = await requestImageGeneration(options, auth, content, mode);
      return `data:image/png;base64,${generation.resultBase64}`;
    } catch (error) {
      lastError = error;
      if (
        mode !== 'auto'
        || !(error instanceof Error)
        || !error.message.startsWith('The response stream completed without an image_generation_call result.')
      ) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Image generation failed');
}
