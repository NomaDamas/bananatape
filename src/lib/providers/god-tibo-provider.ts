import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import {
  buildResponsesRequest,
  extractImageGeneration,
  parseSseText,
} from 'god-tibo-imagen';

interface CodexAuth {
  tokens?: {
    access_token?: string;
    account_id?: string;
  };
}

interface CodexSessionForRequest {
  accessToken: string;
  accountId: string;
  installationId: string | null;
}

async function loadAuthSession(readFileImpl: typeof readFile): Promise<CodexSessionForRequest> {
  const authPath = join(homedir(), '.codex', 'auth.json');
  const data = await readFileImpl(authPath, 'utf-8');
  const auth: CodexAuth = JSON.parse(data);

  const accessToken = auth.tokens?.access_token;
  const accountId = auth.tokens?.account_id;

  if (!accessToken || !accountId) {
    throw new Error('Missing access_token or account_id in ~/.codex/auth.json');
  }

  return { accessToken, accountId, installationId: null };
}

export interface GenerateImageOptions {
  prompt: string;
  model?: string;
  images?: string[];
  size?: string;
  fetchImpl?: typeof fetch;
  readFileImpl?: typeof readFile;
}

type ImageToolChoiceMode = 'auto' | 'required';

interface ParsedSse {
  events: Array<{ event?: string; data?: { type?: string } }>;
  items: unknown[];
  responseId: string | null;
}

function describeBackendError(parsed: ParsedSse): string | null {
  for (const event of [...parsed.events].reverse()) {
    const data = event?.data as Record<string, unknown> | undefined;
    if (!data) continue;
    const error = (data.error as Record<string, unknown> | undefined)
      ?? ((data.response as Record<string, unknown> | undefined)?.error as Record<string, unknown> | undefined)
      ?? ((data.item as Record<string, unknown> | undefined)?.error as Record<string, unknown> | undefined);
    const directMessage = typeof data.message === 'string' ? data.message : undefined;
    if (!error && !directMessage) continue;
    const message = (error?.message as string | undefined) ?? directMessage ?? '';
    const code = error?.code as string | undefined;
    const type = error?.type as string | undefined;
    const details = [message, code ? `code=${code}` : null, type ? `type=${type}` : null]
      .filter(Boolean)
      .join(' ');
    if (details) return details;
  }
  return null;
}

function describeHttpFailureBody(body: string): string | null {
  if (!body.trim()) return null;
  try {
    const payload = JSON.parse(body);
    const error = payload?.error as Record<string, unknown> | undefined;
    const message = error?.message as string | undefined;
    const code = error?.code as string | undefined;
    const type = error?.type as string | undefined;
    if (message || code || type) {
      return [message, code ? `code=${code}` : null, type ? `type=${type}` : null]
        .filter(Boolean)
        .join(' ');
    }
  } catch {
    return body.trim().slice(0, 500);
  }
  return body.trim().slice(0, 500);
}

async function attemptImageGeneration(
  options: GenerateImageOptions,
  session: CodexSessionForRequest,
  toolChoiceMode: ImageToolChoiceMode,
): Promise<string> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const request = buildResponsesRequest({
    baseUrl: 'https://chatgpt.com/backend-api/codex',
    session,
    prompt: options.prompt,
    model: options.model ?? 'gpt-5.4',
    originator: 'codex_cli_rs',
    images: options.images,
    ...(options.size ? { size: options.size } : {}),
  });

  const body = request.body as Record<string, unknown>;
  if (toolChoiceMode === 'required') {
    body.tool_choice = { type: 'image_generation' };
  }

  const response = await fetchImpl(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(body),
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
  const contentType = response.headers.get('content-type') ?? '';
  const shouldParseAsSse =
    contentType.includes('text/event-stream') ||
    trimmed.startsWith('event:') ||
    trimmed.startsWith('data:');

  let parsed: ParsedSse;
  if (shouldParseAsSse) {
    parsed = parseSseText(responseBody) as ParsedSse;
    for (const event of parsed.events) {
      const data = event?.data as { type?: string; response?: { output?: unknown[] } } | undefined;
      if (data?.type === 'response.completed' && Array.isArray(data.response?.output)) {
        parsed.items.push(...data.response.output);
      }
    }
  } else {
    const payload = JSON.parse(responseBody);
    parsed = {
      events: [],
      items: Array.isArray(payload?.output) ? payload.output : [],
      responseId: payload?.id ?? null,
    };
  }

  try {
    const generation = extractImageGeneration(parsed);
    return `data:image/png;base64,${generation.resultBase64}`;
  } catch (extractError) {
    const backendError = describeBackendError(parsed);
    const eventTypes = [...new Set(parsed.events.map((event) => {
      const dataType = (event?.data as { type?: string } | undefined)?.type;
      return dataType ?? event.event ?? 'unknown';
    }))].join(', ');
    const outputTypes = [...new Set(parsed.items.map((item) => {
      const type = (item as { type?: string } | undefined)?.type;
      return type ?? 'unknown';
    }))].join(', ');
    throw new Error(
      [
        'The response stream completed without an image_generation_call result.',
        backendError ? `Backend error: ${backendError}.` : null,
        eventTypes ? `Events: ${eventTypes}.` : null,
        outputTypes ? `Output items: ${outputTypes}.` : null,
        extractError instanceof Error ? `Cause: ${extractError.message}` : null,
      ].filter(Boolean).join(' '),
    );
  }
}

export async function generateImage(options: GenerateImageOptions): Promise<string> {
  const session = await loadAuthSession(options.readFileImpl ?? readFile);

  const attempts: ImageToolChoiceMode[] = ['auto', 'required'];
  let lastError: unknown;

  for (const mode of attempts) {
    try {
      return await attemptImageGeneration(options, session, mode);
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
