import { useCallback, useRef } from 'react';
import { nanoid } from 'nanoid';
import { useCanvasStore } from '@/stores/useCanvasStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { useHistoryStore } from '@/stores/useHistoryStore';
import { useCanvasExport } from '@/hooks/useCanvasExport';
import {
  abortAllGenerations,
  abortGeneration,
  clearGeneration,
  isLatest,
  registerGeneration,
} from '@/lib/generation/request-registry';
import { buildSubmittedPrompt } from '@/lib/prompt/build';
import type { Provider } from '@/types';
import type { CanvasImage } from '@/types/canvas';
import {
  CHILD_VERTICAL_STACK_GAP,
  DEFAULT_PLACEHOLDER_LAYOUT,
  PARENT_CHILD_VERTICAL_GAP,
  SIBLING_HORIZONTAL_GAP,
} from '@/types/canvas';
import {
  type ConcreteOutputSize,
  resolveAutoSize,
  type OutputSize,
} from '@/lib/generation/output-size';

export interface ParallelGenerateInput {
  count: number;
  prompt: string;
  systemPrompt?: string;
  designContext?: string;
  referenceImages?: { file: File; id: string }[];
  parentIds?: string[];
  rootOrigin?: { x: number; y: number };
  outputSize?: OutputSize;
}

export interface ParallelEditInput extends ParallelGenerateInput {
  parentIds: string[];
}

export interface UseParallelGenerateApi {
  generate(input: ParallelGenerateInput): Promise<void>;
  cancel(imageId: string): void;
  cancelAll(): void;
}

interface GenerateResponse {
  error?: string;
  imageDataUrl?: string;
  assetId?: string;
  assetUrl?: string;
  metadata?: {
    timestamp?: number;
  };
}

function clampCount(count: number): number {
  return Math.max(1, Math.min(8, count));
}

function getResponseError(error: unknown): string {
  return error instanceof Error ? error.message : 'Generation failed';
}

export function loadImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      reject(new Error('Could not load generated image'));
    };
    img.src = url;
  });
}

function createRootPlaceholders(input: {
  count: number;
  origin: { x: number; y: number };
  userPrompt: string;
  provider: Provider;
  createdAt: number;
}): CanvasImage[] {
  return Array.from({ length: input.count }, (_, index) => ({
    id: nanoid(),
    url: '',
    size: DEFAULT_PLACEHOLDER_LAYOUT,
    position: {
      x: input.origin.x + index * (DEFAULT_PLACEHOLDER_LAYOUT.width + SIBLING_HORIZONTAL_GAP),
      y: input.origin.y,
    },
    parentId: null,
    generationIndex: index,
    prompt: input.userPrompt,
    provider: input.provider,
    type: 'generate',
    createdAt: input.createdAt,
    paths: [],
    boxes: [],
    memos: [],
    status: 'pending',
  }));
}

function createChildPlaceholders(input: {
  count: number;
  parents: CanvasImage[];
  userPrompt: string;
  provider: Provider;
  createdAt: number;
}): CanvasImage[] {
  return input.parents.flatMap((parent) => Array.from({ length: input.count }, (_, index) => ({
    id: nanoid(),
    url: '',
    size: DEFAULT_PLACEHOLDER_LAYOUT,
    position: {
      x: parent.position.x,
      y: parent.position.y
        + parent.size.height
        + PARENT_CHILD_VERTICAL_GAP
        + index * (DEFAULT_PLACEHOLDER_LAYOUT.height + CHILD_VERTICAL_STACK_GAP),
    },
    parentId: parent.id,
    generationIndex: index,
    prompt: input.userPrompt,
    provider: input.provider,
    type: 'edit' as const,
    createdAt: input.createdAt,
    paths: [],
    boxes: [],
    memos: [],
    status: 'pending' as const,
  })));
}

function buildPlaceholders(input: {
  count: number;
  parentIds: string[];
  rootOrigin: { x: number; y: number };
  userPrompt: string;
  provider: Provider;
  createdAt: number;
}): CanvasImage[] {
  if (input.parentIds.length === 0) {
    return createRootPlaceholders({
      count: input.count,
      origin: input.rootOrigin,
      userPrompt: input.userPrompt,
      provider: input.provider,
      createdAt: input.createdAt,
    });
  }

  const images = useCanvasStore.getState().images;
  const parents = input.parentIds
    .map((id) => images[id])
    .filter((image): image is CanvasImage => image !== undefined);

  return createChildPlaceholders({
    count: input.count,
    parents,
    userPrompt: input.userPrompt,
    provider: input.provider,
    createdAt: input.createdAt,
  });
}

async function parseGenerateResponse(response: Response): Promise<GenerateResponse> {
  const data = await response.json() as GenerateResponse;
  if (!response.ok || data.error) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
}

function appendReferenceImages(formData: FormData, referenceImages: { file: File; id: string }[]): void {
  referenceImages.forEach((reference, index) => {
    formData.append('referenceImages', reference.file, `reference-${index}-${reference.file.name}`);
  });
}

function appendEditImages(formData: FormData, referenceImages: { file: File; id: string }[]): void {
  referenceImages.forEach((reference, index) => {
    formData.append('images', reference.file, `reference-${index}-${reference.file.name}`);
  });
}

function resolveOutputSize(
  outputSize: OutputSize | undefined,
  parentDims: { width: number; height: number } | null,
): ConcreteOutputSize {
  if (!outputSize || outputSize === 'auto') {
    return resolveAutoSize(parentDims);
  }
  return outputSize;
}

export function useParallelGenerate(): UseParallelGenerateApi {
  const activeImageIdsRef = useRef<Set<string>>(new Set());
  const { exportImageWithAnnotations } = useCanvasExport();

  const generate = useCallback(async (input: ParallelGenerateInput) => {
    const count = clampCount(input.count);
    const parentIds = input.parentIds ?? [];
    const userPrompt = input.prompt.trim();

    if (userPrompt === '' && parentIds.length === 0) {
      throw new Error('Prompt is required');
    }

    const provider = useEditorStore.getState().provider;
    const placeholders = buildPlaceholders({
      count,
      parentIds,
      rootOrigin: input.rootOrigin ?? { x: 0, y: 0 },
      userPrompt,
      provider,
      createdAt: Date.now(),
    });

    if (placeholders.length === 0) return;

    useCanvasStore.getState().addImages(placeholders);
    placeholders.forEach((placeholder) => activeImageIdsRef.current.add(placeholder.id));

    const submittedPrompt = buildSubmittedPrompt({
      userPrompt,
      systemPrompt: input.systemPrompt,
      designContext: input.designContext,
    });
    const referenceImages = input.referenceImages ?? [];

    const fanOut = placeholders.map(async (placeholder) => {
      const handle = registerGeneration(placeholder.id);

      try {
        const formData = new FormData();
        formData.append('prompt', submittedPrompt);
        formData.append('provider', placeholder.provider);

        let endpoint = '/api/generate';
        if (placeholder.parentId) {
          endpoint = '/api/edit';
          formData.append('parentId', placeholder.parentId);
          const exported = await exportImageWithAnnotations(placeholder.parentId);
          formData.append('images', exported.original, 'original.png');
          formData.append('images', exported.annotated, 'annotated.png');
          appendEditImages(formData, referenceImages);
          formData.append('maskImage', exported.mask, 'mask.png');
          const resolvedSize = resolveOutputSize(input.outputSize, exported.size);
          formData.append('size', resolvedSize);
        } else {
          appendReferenceImages(formData, referenceImages);
          const resolvedSize = resolveOutputSize(input.outputSize, null);
          formData.append('size', resolvedSize);
        }

        const response = await fetch(endpoint, { method: 'POST', body: formData, signal: handle.signal });
        const data = await parseGenerateResponse(response);
        if (!isLatest(placeholder.id, handle.requestId)) return;

        const url = data.assetUrl ?? data.imageDataUrl;
        if (!url) throw new Error('Generation response did not include an image URL');

        const size = await loadImageDimensions(url);
        if (!isLatest(placeholder.id, handle.requestId)) return;

        useCanvasStore.getState().updateImage(placeholder.id, {
          url,
          size,
          assetId: data.assetId,
          status: 'ready',
        }, { track: false });
        if (useCanvasStore.getState().focusedImageIds.length === 0) {
          useCanvasStore.getState().setFocusedImage(placeholder.id);
        }
        useHistoryStore.getState().addEntry({
          imageId: placeholder.id,
          prompt: userPrompt,
          provider: placeholder.provider,
          type: placeholder.type,
          imageDataUrl: data.imageDataUrl,
          assetId: data.assetId,
          assetUrl: data.assetUrl,
          parentId: placeholder.parentId,
          timestamp: data.metadata?.timestamp ?? Date.now(),
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (error instanceof Error && error.name === 'AbortError') return;
        if (!isLatest(placeholder.id, handle.requestId)) return;
        useCanvasStore.getState().setImageStatus(placeholder.id, 'error', getResponseError(error));
      } finally {
        clearGeneration(placeholder.id);
        activeImageIdsRef.current.delete(placeholder.id);
      }
    });

    await Promise.allSettled(fanOut);
  }, [exportImageWithAnnotations]);

  const cancel = useCallback((imageId: string) => {
    abortGeneration(imageId);
    const image = useCanvasStore.getState().images[imageId];
    if (image?.status === 'pending') {
      useCanvasStore.getState().deleteImage(imageId);
      activeImageIdsRef.current.delete(imageId);
    }
  }, []);

  const cancelAll = useCallback(() => {
    abortAllGenerations();
    const pendingIds = Object.values(useCanvasStore.getState().images)
      .filter((image) => image.status === 'pending')
      .map((image) => image.id);
    if (pendingIds.length > 0) {
      useCanvasStore.getState().deleteImages(pendingIds);
    }
    activeImageIdsRef.current.clear();
  }, []);

  return { generate, cancel, cancelAll };
}
