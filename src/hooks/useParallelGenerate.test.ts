/** @vitest-environment jsdom */

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useParallelGenerate } from './useParallelGenerate';
import { useCanvasStore } from '@/stores/useCanvasStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { useHistoryStore } from '@/stores/useHistoryStore';
import { __test_resetRegistry, registerGeneration } from '@/lib/generation/request-registry';
import type { CanvasImage } from '@/types/canvas';
import {
  CHILD_VERTICAL_STACK_GAP,
  DEFAULT_PLACEHOLDER_LAYOUT,
  PARENT_CHILD_VERTICAL_GAP,
} from '@/types/canvas';
import type { UseParallelGenerateApi } from './useParallelGenerate';

const canvasExportMocks = vi.hoisted(() => ({
  exportImageWithAnnotations: vi.fn(),
}));

vi.mock('@/hooks/useCanvasExport', () => ({
  useCanvasExport: () => canvasExportMocks,
}));

interface DeferredResponse {
  response: Promise<Response>;
  resolve(data: GeneratePayload, init?: { ok?: boolean; status?: number }): void;
  reject(error: Error): void;
}

interface FetchCall {
  input: RequestInfo | URL;
  init?: RequestInit;
  deferred: DeferredResponse;
}

interface GeneratePayload {
  imageDataUrl?: string;
  assetId?: string;
  assetUrl?: string;
  error?: string;
  metadata?: {
    timestamp?: number;
  };
}

class MockResponse {
  ok: boolean;
  status: number;

  constructor(private readonly payload: GeneratePayload, init: { ok?: boolean; status?: number } = {}) {
    this.ok = init.ok ?? true;
    this.status = init.status ?? 200;
  }

  async json(): Promise<GeneratePayload> {
    return this.payload;
  }
}

function createDeferredResponse(): DeferredResponse {
  let resolvePromise: (value: Response) => void = () => undefined;
  let rejectPromise: (error: Error) => void = () => undefined;
  const response = new Promise<Response>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return {
    response,
    resolve: (data, init) => resolvePromise(new MockResponse(data, init) as unknown as Response),
    reject: rejectPromise,
  };
}

function createFetchMock() {
  const calls: FetchCall[] = [];
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const deferred = createDeferredResponse();
    calls.push({ input, init, deferred });
    init?.signal?.addEventListener('abort', () => {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      deferred.reject(error);
    });
    return deferred.response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

function mockImageConstructor() {
  class MockImage {
    naturalWidth = 640;
    naturalHeight = 480;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;

    set src(_url: string) {
      queueMicrotask(() => this.onload?.());
    }
  }

  vi.stubGlobal('Image', MockImage);
}

function makeParent(id: string, position: { x: number; y: number }, size = { width: 300, height: 200 }): CanvasImage {
  return {
    id,
    url: `data:image/png;base64,${id}`,
    size,
    position,
    parentId: null,
    generationIndex: 0,
    prompt: 'parent',
    provider: 'openai',
    type: 'generate',
    createdAt: 1,
    paths: [],
    boxes: [],
    memos: [],
    status: 'ready',
  };
}

function getImages(): CanvasImage[] {
  const state = useCanvasStore.getState();
  return state.imageOrder.map((id) => state.images[id]);
}

function renderUseParallelGenerate(): { current: UseParallelGenerateApi; unmount: () => void } {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root: Root = createRoot(host);
  const result: { current?: UseParallelGenerateApi } = {};

  function TestComponent() {
    result.current = useParallelGenerate();
    return null;
  }

  act(() => {
    root.render(createElement(TestComponent));
  });

  if (!result.current) {
    throw new Error('Hook did not render');
  }

  return {
    current: result.current,
    unmount: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
}

function resolveSuccesses(calls: FetchCall[]) {
  calls.forEach((call, index) => {
    call.deferred.resolve({
      imageDataUrl: `data:image/png;base64,result-${index}`,
      assetId: `asset-${index}`,
      assetUrl: `/assets/result-${index}.png`,
      metadata: { timestamp: 1_000 + index },
    });
  });
}

function makeBlob(label: string): Blob {
  return new Blob([label], { type: 'image/png' });
}

function makeReference(name: string): { file: File; id: string } {
  return { file: new File([name], name, { type: 'image/png' }), id: name };
}

function defaultExportBlobs(id = 'parent') {
  return {
    original: makeBlob(`${id}-original`),
    annotated: makeBlob(`${id}-annotated`),
    mask: makeBlob(`${id}-mask`),
    size: { width: 300, height: 200 },
  };
}

function flushPromises(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  __test_resetRegistry();
  useCanvasStore.getState().resetCanvas();
  useHistoryStore.getState().clearHistory();
  useEditorStore.getState().setProvider('openai');
  canvasExportMocks.exportImageWithAnnotations.mockReset();
  canvasExportMocks.exportImageWithAnnotations.mockImplementation((imageId: string) => Promise.resolve(defaultExportBlobs(imageId)));
  mockImageConstructor();
});

describe('useParallelGenerate', () => {
  it('keeps root generation on /api/generate without edit requests', async () => {
    const { calls, fetchMock } = createFetchMock();
    const result = renderUseParallelGenerate();

    const generatePromise = result.current.generate({ count: 2, prompt: 'root only', rootOrigin: { x: 5, y: 6 } });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(calls.map((call) => call.input)).toEqual(['/api/generate', '/api/generate']);
    expect(calls.some((call) => call.input === '/api/edit')).toBe(false);
    expect(canvasExportMocks.exportImageWithAnnotations).not.toHaveBeenCalled();

    resolveSuccesses(calls);
    await generatePromise;
  });

  it('fires three root requests and updates placeholders to ready as each completes', async () => {
    const { calls, fetchMock } = createFetchMock();
    const result = renderUseParallelGenerate();

    const generatePromise = result.current.generate({ count: 3, prompt: ' banana ', rootOrigin: { x: 10, y: 20 } });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(getImages()).toHaveLength(3);
    expect(getImages().map((image) => image.status)).toEqual(['pending', 'pending', 'pending']);

    resolveSuccesses(calls);
    await generatePromise;

    const images = getImages();
    expect(images.map((image) => image.status)).toEqual(['ready', 'ready', 'ready']);
    expect(images.map((image) => image.url)).toEqual([
      '/assets/result-0.png',
      '/assets/result-1.png',
      '/assets/result-2.png',
    ]);
    expect(images.map((image) => image.position)).toEqual([
      { x: 10, y: 20 },
      { x: 10 + DEFAULT_PLACEHOLDER_LAYOUT.width + 32, y: 20 },
      { x: 10 + 2 * (DEFAULT_PLACEHOLDER_LAYOUT.width + 32), y: 20 },
    ]);
  });

  it('creates stacked child placeholders for every parent', async () => {
    const { calls } = createFetchMock();
    const parentA = makeParent('a', { x: 100, y: 200 }, { width: 300, height: 250 });
    const parentB = makeParent('b', { x: 500, y: 600 }, { width: 320, height: 180 });
    useCanvasStore.getState().addImages([parentA, parentB]);
    const result = renderUseParallelGenerate();

    const generatePromise = result.current.generate({ count: 3, prompt: 'children', parentIds: ['a', 'b'] });

    const placeholders = getImages().slice(2);
    expect(placeholders).toHaveLength(6);
    expect(placeholders.map((image) => image.parentId)).toEqual(['a', 'a', 'a', 'b', 'b', 'b']);
    expect(placeholders.map((image) => image.type)).toEqual(['edit', 'edit', 'edit', 'edit', 'edit', 'edit']);
    expect(placeholders.map((image) => image.position)).toEqual([
      { x: 100, y: 200 + 250 + PARENT_CHILD_VERTICAL_GAP },
      { x: 100, y: 200 + 250 + PARENT_CHILD_VERTICAL_GAP + DEFAULT_PLACEHOLDER_LAYOUT.height + CHILD_VERTICAL_STACK_GAP },
      { x: 100, y: 200 + 250 + PARENT_CHILD_VERTICAL_GAP + 2 * (DEFAULT_PLACEHOLDER_LAYOUT.height + CHILD_VERTICAL_STACK_GAP) },
      { x: 500, y: 600 + 180 + PARENT_CHILD_VERTICAL_GAP },
      { x: 500, y: 600 + 180 + PARENT_CHILD_VERTICAL_GAP + DEFAULT_PLACEHOLDER_LAYOUT.height + CHILD_VERTICAL_STACK_GAP },
      { x: 500, y: 600 + 180 + PARENT_CHILD_VERTICAL_GAP + 2 * (DEFAULT_PLACEHOLDER_LAYOUT.height + CHILD_VERTICAL_STACK_GAP) },
    ]);

    await flushPromises();
    resolveSuccesses(calls);
    await generatePromise;
  });

  it('forwards parent original/annotated/mask blobs to /api/edit verbatim without resizing', async () => {
    const { calls } = createFetchMock();
    const parent = makeParent('p1', { x: 100, y: 200 });
    useCanvasStore.getState().addImages([parent]);
    const result = renderUseParallelGenerate();

    const generatePromise = result.current.generate({
      count: 2,
      prompt: 'edit parent',
      parentIds: ['p1'],
      referenceImages: [makeReference('ref.png')],
    });
    await flushPromises();

    expect(calls).toHaveLength(2);
    expect(calls.map((call) => call.input)).toEqual(['/api/edit', '/api/edit']);
    expect(canvasExportMocks.exportImageWithAnnotations).toHaveBeenCalledTimes(2);
    expect(canvasExportMocks.exportImageWithAnnotations).toHaveBeenNthCalledWith(1, 'p1');

    await Promise.all(
      calls.map(async (call) => {
        const body = call.init?.body;
        expect(body).toBeInstanceOf(FormData);
        const formData = body as FormData;
        expect(formData.get('parentId')).toBe('p1');

        const images = formData.getAll('images');
        expect(images).toHaveLength(3);

        const [originalAsSent, annotatedAsSent] = images as File[];
        await expect(originalAsSent.text()).resolves.toBe('p1-original');
        await expect(annotatedAsSent.text()).resolves.toBe('p1-annotated');

        const maskAsSent = formData.get('maskImage') as File | null;
        expect(maskAsSent).toBeInstanceOf(File);
        await expect((maskAsSent as File).text()).resolves.toBe('p1-mask');

        expect(formData.get('provider')).toBe('openai');
        expect(formData.get('size')).toBeTruthy();
      }),
    );

    resolveSuccesses(calls);
    await generatePromise;

    const children = getImages().slice(1);
    expect(children.map((image) => image.status)).toEqual(['ready', 'ready']);
    expect(useHistoryStore.getState().entries.map((entry) => entry.type)).toEqual(['edit', 'edit']);
    expect(useHistoryStore.getState().entries.map((entry) => entry.parentId)).toEqual(['p1', 'p1']);
  });

  it('fans out multiple parents through /api/edit with each parent id', async () => {
    const { calls } = createFetchMock();
    useCanvasStore.getState().addImages([
      makeParent('p1', { x: 0, y: 0 }),
      makeParent('p2', { x: 400, y: 0 }),
    ]);
    const result = renderUseParallelGenerate();

    const generatePromise = result.current.generate({ count: 2, prompt: 'multi edit', parentIds: ['p1', 'p2'] });
    await flushPromises();

    expect(calls).toHaveLength(4);
    expect(calls.map((call) => call.input)).toEqual(['/api/edit', '/api/edit', '/api/edit', '/api/edit']);
    expect(calls.map((call) => (call.init?.body as FormData).get('parentId'))).toEqual(['p1', 'p1', 'p2', 'p2']);

    resolveSuccesses(calls);
    await generatePromise;
  });

  it('keeps one parent export failure isolated while other parent edits continue', async () => {
    const { calls } = createFetchMock();
    useCanvasStore.getState().addImages([
      makeParent('p1', { x: 0, y: 0 }),
      makeParent('p2', { x: 400, y: 0 }),
    ]);
    canvasExportMocks.exportImageWithAnnotations.mockImplementation((imageId: string) => {
      if (imageId === 'p1') return Promise.reject(new Error('parent pixels missing'));
      return Promise.resolve(defaultExportBlobs(imageId));
    });
    const result = renderUseParallelGenerate();

    const generatePromise = result.current.generate({ count: 2, prompt: 'mixed parent export', parentIds: ['p1', 'p2'] });
    await flushPromises();

    expect(calls).toHaveLength(2);
    expect(calls.map((call) => (call.init?.body as FormData).get('parentId'))).toEqual(['p2', 'p2']);
    resolveSuccesses(calls);
    await generatePromise;

    const children = getImages().slice(2);
    expect(children.map((image) => image.parentId)).toEqual(['p1', 'p1', 'p2', 'p2']);
    expect(children.map((image) => image.status)).toEqual(['error', 'error', 'ready', 'ready']);
    expect(children[0].error).toBe('parent pixels missing');
    expect(children[1].error).toBe('parent pixels missing');
  });

  it('marks one failed placeholder as error while others succeed', async () => {
    const { calls } = createFetchMock();
    const result = renderUseParallelGenerate();

    const generatePromise = result.current.generate({ count: 3, prompt: 'mixed', rootOrigin: { x: 0, y: 0 } });
    calls[0].deferred.resolve({ imageDataUrl: 'data:image/png;base64,one' });
    calls[1].deferred.resolve({ error: 'Provider failed' }, { ok: false, status: 500 });
    calls[2].deferred.resolve({ imageDataUrl: 'data:image/png;base64,three' });
    await generatePromise;

    const images = getImages();
    expect(images.map((image) => image.status)).toEqual(['ready', 'error', 'ready']);
    expect(images[1].error).toBe('Provider failed');
  });

  it('drops a stale response after a newer registration for the same image', async () => {
    const { calls } = createFetchMock();
    const result = renderUseParallelGenerate();

    const generatePromise = result.current.generate({ count: 1, prompt: 'stale', rootOrigin: { x: 0, y: 0 } });
    const placeholderId = getImages()[0].id;
    registerGeneration(placeholderId);
    calls[0].deferred.resolve({ imageDataUrl: 'data:image/png;base64,stale' });
    await generatePromise;

    const image = useCanvasStore.getState().images[placeholderId];
    expect(image.status).toBe('pending');
    expect(image.url).toBe('');
    expect(useHistoryStore.getState().entries).toHaveLength(0);
  });

  it('drops a stale edit response after a newer registration for the same child image', async () => {
    const { calls } = createFetchMock();
    useCanvasStore.getState().addImages([makeParent('p1', { x: 0, y: 0 })]);
    const result = renderUseParallelGenerate();

    const generatePromise = result.current.generate({ count: 1, prompt: 'stale edit', parentIds: ['p1'] });
    await flushPromises();
    const placeholderId = getImages()[1].id;
    registerGeneration(placeholderId);
    calls[0].deferred.resolve({ imageDataUrl: 'data:image/png;base64,stale-edit' });
    await generatePromise;

    const image = useCanvasStore.getState().images[placeholderId];
    expect(image.status).toBe('pending');
    expect(image.url).toBe('');
    expect(useHistoryStore.getState().entries).toHaveLength(0);
  });

  it('aborts and removes a pending placeholder on cancel', async () => {
    const { calls } = createFetchMock();
    const result = renderUseParallelGenerate();

    const generatePromise = result.current.generate({ count: 1, prompt: 'cancel', rootOrigin: { x: 0, y: 0 } });
    const placeholderId = getImages()[0].id;

    result.current.cancel(placeholderId);
    await generatePromise;

    expect(calls[0].init?.signal?.aborted).toBe(true);
    expect(useCanvasStore.getState().images[placeholderId]).toBeUndefined();
  });

  it('aborts every pending request and removes all pending placeholders on cancelAll', async () => {
    const { calls } = createFetchMock();
    const result = renderUseParallelGenerate();

    const generatePromise = result.current.generate({ count: 3, prompt: 'cancel all', rootOrigin: { x: 0, y: 0 } });

    result.current.cancelAll();
    await generatePromise;

    expect(calls.every((call) => call.init?.signal?.aborted)).toBe(true);
    expect(getImages()).toHaveLength(0);
  });

  it('creates history entries for successful generations', async () => {
    const { calls } = createFetchMock();
    const result = renderUseParallelGenerate();

    const generatePromise = result.current.generate({ count: 1, prompt: 'history', rootOrigin: { x: 0, y: 0 } });
    const placeholderId = getImages()[0].id;
    calls[0].deferred.resolve({
      imageDataUrl: 'data:image/png;base64,history',
      assetId: 'asset-history',
      assetUrl: '/assets/history.png',
      metadata: { timestamp: 12_345 },
    });
    await generatePromise;

    expect(useHistoryStore.getState().entries).toMatchObject([
      {
        imageId: placeholderId,
        prompt: 'history',
        provider: 'openai',
        type: 'generate',
        imageDataUrl: 'data:image/png;base64,history',
        assetId: 'asset-history',
        assetUrl: '/assets/history.png',
        parentId: null,
        timestamp: 12_345,
      },
    ]);
  });

  it('propagates system prompt and design context into submitted prompt', async () => {
    const { calls } = createFetchMock();
    const result = renderUseParallelGenerate();

    const generatePromise = result.current.generate({
      count: 1,
      prompt: 'make it blue',
      systemPrompt: 'always cinematic',
      designContext: 'brand uses bananas',
      rootOrigin: { x: 0, y: 0 },
    });

    const body = calls[0].init?.body;
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('prompt')).toBe([
      'Design context:\nbrand uses bananas',
      'System prompt:\nalways cinematic',
      'User prompt:\nmake it blue',
    ].join('\n\n'));

    calls[0].deferred.resolve({ imageDataUrl: 'data:image/png;base64,global' });
    await generatePromise;
  });
});
