/** @vitest-environment jsdom */

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCanvasStore } from '@/stores/useCanvasStore';
import { useEditorStore } from '@/stores/useEditorStore';
import {
  MAGIC_LAYER_INPAINT_INSTRUCTION,
  composeMagicLayerPrompt,
} from '@/lib/prompt/magic-layer-inpaint';
import type { CanvasImage, MagicLayer } from '@/types/canvas';

const mocks = vi.hoisted(() => ({
  mockGenerate: vi.fn(),
  mockAddToast: vi.fn(),
}));

vi.mock('@/hooks/useParallelGenerate', () => ({
  useParallelGenerate: () => ({
    generate: mocks.mockGenerate,
    cancel: vi.fn(),
    cancelAll: vi.fn(),
  }),
}));

vi.mock('@/components/Composer/PromptComposerProvider', () => {
  const file = new File(['x'], 'r.png', { type: 'image/png' });
  const referenceImages = [{ id: 'r1', file, previewUrl: 'blob:r' }];
  return {
    usePromptComposer: () => ({
      systemPrompt: 'SYS',
      designContext: 'DC',
      referenceImages,
    }),
  };
});

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ addToast: mocks.mockAddToast }),
}));

import { useMagicLayerApply, type UseMagicLayerApplyApi } from './useMagicLayerApply';

interface GenerateCallArgs {
  count: number;
  prompt: string;
  systemPrompt?: string;
  designContext?: string;
  referenceImages?: { file: File; id: string }[];
  parentIds?: string[];
  outputSize?: string;
}

function getGenerateCall(index = 0): GenerateCallArgs {
  const args = mocks.mockGenerate.mock.calls[index];
  if (!args) throw new Error(`generate was not called (index ${index})`);
  return args[0] as GenerateCallArgs;
}

function makeLayer(overrides: Partial<MagicLayer> = {}): MagicLayer {
  return {
    id: 'layer-1',
    name: 'Layer 1',
    maskDataUrl: 'data:image/png;base64,mask',
    cutoutDataUrl: 'data:image/png;base64,cutout',
    sourceBounds: { x: 10, y: 20, width: 30, height: 40 },
    position: { x: 100, y: 200 },
    hidden: false,
    ...overrides,
  };
}

function seedImage(overrides: Partial<CanvasImage> = {}): CanvasImage {
  const image: CanvasImage = {
    id: 'img-1',
    url: 'data:image/png;base64,img',
    size: { width: 300, height: 200 },
    position: { x: 0, y: 0 },
    parentId: null,
    generationIndex: 0,
    prompt: 'a red car',
    provider: 'openai',
    type: 'generate',
    createdAt: 1,
    paths: [],
    boxes: [],
    memos: [],
    status: 'ready',
    magicLayers: [makeLayer()],
    magicLayerBaseUrl: 'data:image/png;base64,base',
    ...overrides,
  };
  useCanvasStore.setState((state) => ({
    images: { ...state.images, [image.id]: image },
    imageOrder: state.imageOrder.includes(image.id)
      ? state.imageOrder
      : [...state.imageOrder, image.id],
  }));
  return image;
}

function renderUseMagicLayerApply(): { current: UseMagicLayerApplyApi; unmount: () => void } {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root: Root = createRoot(host);
  const result: { current?: UseMagicLayerApplyApi } = {};

  function TestComponent() {
    result.current = useMagicLayerApply();
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

beforeEach(() => {
  useCanvasStore.getState().resetCanvas();
  useEditorStore.getState().setParallelCount(1);
  useEditorStore.getState().setOutputSize('auto');
  mocks.mockGenerate.mockReset();
  mocks.mockGenerate.mockResolvedValue(undefined);
  mocks.mockAddToast.mockReset();
});

describe('useMagicLayerApply', () => {
  it('composes the prompt by appending the inpaint instruction to the original prompt', async () => {
    seedImage({ prompt: 'a red car' });
    const { current, unmount } = renderUseMagicLayerApply();

    await act(async () => {
      await current.apply('img-1');
    });

    expect(mocks.mockGenerate).toHaveBeenCalledTimes(1);
    const call = getGenerateCall();
    expect(call.prompt).toBe(composeMagicLayerPrompt('a red car'));
    expect(call.systemPrompt).toBe('SYS');
    expect(call.designContext).toBe('DC');
    expect(call.referenceImages).toHaveLength(1);
    expect(call.referenceImages?.[0].id).toBe('r1');
    expect(call.parentIds).toEqual(['img-1']);

    unmount();
  });

  it('falls back to the inpaint instruction only when the original prompt is empty', async () => {
    seedImage({ prompt: '' });
    const { current, unmount } = renderUseMagicLayerApply();

    await act(async () => {
      await current.apply('img-1');
    });

    expect(mocks.mockGenerate).toHaveBeenCalledTimes(1);
    expect(getGenerateCall().prompt).toBe(MAGIC_LAYER_INPAINT_INSTRUCTION);

    unmount();
  });

  it('does not call generate when no magic layers have moved or are hidden', async () => {
    seedImage({
      magicLayers: [
        makeLayer({ position: { x: 10, y: 20 }, hidden: false }),
        makeLayer({ id: 'layer-2', position: { x: 10, y: 20 }, hidden: false }),
      ],
    });
    const { current, unmount } = renderUseMagicLayerApply();

    await act(async () => {
      await current.apply('img-1');
    });

    expect(mocks.mockGenerate).not.toHaveBeenCalled();
    expect(mocks.mockAddToast).toHaveBeenCalledWith(
      'Move or hide a Magic Layer before applying',
      'info',
    );

    unmount();
  });

  it('does not call generate when the image id does not exist', async () => {
    const { current, unmount } = renderUseMagicLayerApply();

    await act(async () => {
      await current.apply('nonexistent');
    });

    expect(mocks.mockGenerate).not.toHaveBeenCalled();
    expect(mocks.mockAddToast).toHaveBeenCalledWith('Image not found', 'error');

    unmount();
  });

  it('does not call generate when the source image is still pending', async () => {
    seedImage({ status: 'pending' });
    const { current, unmount } = renderUseMagicLayerApply();

    await act(async () => {
      await current.apply('img-1');
    });

    expect(mocks.mockGenerate).not.toHaveBeenCalled();
    expect(mocks.mockAddToast).toHaveBeenCalledWith('Image is still generating', 'info');

    unmount();
  });

  it('clears selectedMagicLayerId once the apply succeeds', async () => {
    seedImage({ selectedMagicLayerId: 'layer-1' });
    const { current, unmount } = renderUseMagicLayerApply();

    await act(async () => {
      await current.apply('img-1');
    });

    expect(mocks.mockGenerate).toHaveBeenCalledTimes(1);
    expect(useCanvasStore.getState().images['img-1']?.selectedMagicLayerId).toBeNull();
    expect(mocks.mockAddToast).toHaveBeenCalledWith('Magic Layer applied', 'success');

    unmount();
  });

  it('surfaces generate failures via the toast and keeps selectedMagicLayerId untouched', async () => {
    seedImage({ selectedMagicLayerId: 'layer-1' });
    mocks.mockGenerate.mockReset();
    mocks.mockGenerate.mockRejectedValue(new Error('boom'));
    const { current, unmount } = renderUseMagicLayerApply();

    await act(async () => {
      await current.apply('img-1');
    });

    expect(mocks.mockAddToast).toHaveBeenCalledWith('boom', 'error');
    expect(useCanvasStore.getState().images['img-1']?.selectedMagicLayerId).toBe('layer-1');

    unmount();
  });

  it('forwards parallelCount and outputSize from the editor store', async () => {
    seedImage();
    useEditorStore.getState().setParallelCount(3);
    useEditorStore.getState().setOutputSize('1024x1024');
    const { current, unmount } = renderUseMagicLayerApply();

    await act(async () => {
      await current.apply('img-1');
    });

    const call = getGenerateCall();
    expect(call.count).toBe(3);
    expect(call.outputSize).toBe('1024x1024');

    unmount();
  });
});
