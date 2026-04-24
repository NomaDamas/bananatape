import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateImage } from '../../src/lib/providers/god-tibo-provider';

function makeSseBody(events: Array<{ type: string; item?: unknown; response?: unknown; partial_image_b64?: string; item_id?: string }>) {
  return events
    .map((ev) => `event: data\ndata: ${JSON.stringify(ev)}`)
    .join('\n\n');
}

describe('god-tibo-provider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('throws when auth file is missing required fields', async () => {
    const mockReadFile = vi.fn().mockResolvedValue(
      JSON.stringify({ tokens: { access_token: 'tok', account_id: '' } }),
    );

    await expect(
      generateImage({ prompt: 'test', readFileImpl: mockReadFile }),
    ).rejects.toThrow('Missing access_token or account_id');
  });

  it('throws on HTTP error from Codex backend', async () => {
    const mockReadFile = vi.fn().mockResolvedValue(
      JSON.stringify({ tokens: { access_token: 'tok', account_id: 'acc' } }),
    );

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
      headers: {
        get: () => null,
      },
    });

    await expect(
      generateImage({ prompt: 'test', readFileImpl: mockReadFile, fetchImpl: mockFetch as unknown as typeof fetch }),
    ).rejects.toThrow('Private Codex backend request failed with HTTP 401');
  });

  it('extracts image from SSE stream', async () => {
    const mockReadFile = vi.fn().mockResolvedValue(
      JSON.stringify({ tokens: { access_token: 'tok', account_id: 'acc' } }),
    );

    const sse = makeSseBody([
      { type: 'response.created', response: { id: 'r1' } },
      {
        type: 'response.output_item.done',
        item: { type: 'image_generation_call', id: 'ig1', result: 'fakebase64' },
      },
      { type: 'response.completed', response: { id: 'r1' } },
    ]);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => sse,
      headers: {
        get: (key: string) => (key.toLowerCase() === 'content-type' ? 'text/event-stream' : null),
      },
    });

    const result = await generateImage({
      prompt: 'a cat',
      readFileImpl: mockReadFile,
      fetchImpl: mockFetch as unknown as typeof fetch,
    });
    expect(result).toBe('data:image/png;base64,fakebase64');
  });

  it('falls back to partial_image event', async () => {
    const mockReadFile = vi.fn().mockResolvedValue(
      JSON.stringify({ tokens: { access_token: 'tok', account_id: 'acc' } }),
    );

    const sse = makeSseBody([
      { type: 'response.created', response: { id: 'r1' } },
      {
        type: 'response.image_generation_call.partial_image',
        item_id: 'ig1',
        partial_image_b64: 'partial64',
      },
    ]);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => sse,
      headers: {
        get: (key: string) => (key.toLowerCase() === 'content-type' ? 'text/event-stream' : null),
      },
    });

    const result = await generateImage({
      prompt: 'a dog',
      readFileImpl: mockReadFile,
      fetchImpl: mockFetch as unknown as typeof fetch,
    });
    expect(result).toBe('data:image/png;base64,partial64');
  });

  it('passes images for edit mode', async () => {
    const mockReadFile = vi.fn().mockResolvedValue(
      JSON.stringify({ tokens: { access_token: 'tok', account_id: 'acc' } }),
    );

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        makeSseBody([
          {
            type: 'response.output_item.done',
            item: { type: 'image_generation_call', result: 'edited64' },
          },
        ]),
      headers: {
        get: (key: string) => (key.toLowerCase() === 'content-type' ? 'text/event-stream' : null),
      },
    });

    await generateImage({
      prompt: 'make it blue',
      images: ['data:image/png;base64,abc', 'data:image/png;base64,def'],
      readFileImpl: mockReadFile,
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.input[0].content).toEqual([
      { type: 'input_text', text: 'make it blue' },
      { type: 'input_image', image_url: 'data:image/png;base64,abc' },
      { type: 'input_image', image_url: 'data:image/png;base64,def' },
    ]);
  });
});
