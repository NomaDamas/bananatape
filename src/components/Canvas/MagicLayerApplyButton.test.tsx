/** @vitest-environment jsdom */

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockApply: vi.fn(),
}));

vi.mock('@/hooks/useMagicLayerApply', () => ({
  useMagicLayerApply: () => ({ apply: mocks.mockApply }),
}));

import { CanvasImageItem } from './CanvasImageItem';
import { useCanvasStore } from '@/stores/useCanvasStore';
import { useEditorStore } from '@/stores/useEditorStore';
import type { CanvasImage, MagicLayer } from '@/types/canvas';

interface RenderResult {
  host: HTMLDivElement;
  root: Root;
  unmount: () => void;
}

function renderItem(image: CanvasImage, isFocused: boolean): RenderResult {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);

  act(() => {
    root.render(
      createElement(CanvasImageItem, {
        image,
        isFocused,
        isVisible: true,
        onFocus: () => {},
        onDelete: () => {},
        onRetry: () => {},
      }),
    );
  });

  return {
    host,
    root,
    unmount: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
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

function makeImage(overrides: Partial<CanvasImage> = {}): CanvasImage {
  return {
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
}

function queryApplyButton(host: HTMLElement): HTMLButtonElement | null {
  return host.querySelector('[data-testid="magic-layer-apply"]');
}

beforeEach(() => {
  useCanvasStore.getState().resetCanvas();
  useEditorStore.getState().setActiveTool('magic-layer');
  mocks.mockApply.mockReset();
  mocks.mockApply.mockResolvedValue(undefined);
});

afterEach(() => {
  useCanvasStore.getState().resetCanvas();
  useEditorStore.getState().setActiveTool('pan');
});

describe('MagicLayerOverlay Apply button', () => {
  it('does not render when the active tool is not magic-layer', () => {
    useEditorStore.getState().setActiveTool('pan');
    const image = makeImage();
    const { host, unmount } = renderItem(image, true);

    expect(queryApplyButton(host)).toBeNull();

    unmount();
  });

  it('does not render when the image is not focused', () => {
    useEditorStore.getState().setActiveTool('magic-layer');
    const image = makeImage();
    const { host, unmount } = renderItem(image, false);

    expect(queryApplyButton(host)).toBeNull();

    unmount();
  });

  it('does not render when the image has no magic layers', () => {
    useEditorStore.getState().setActiveTool('magic-layer');
    const image = makeImage({ magicLayers: undefined });
    const { host, unmount } = renderItem(image, true);

    expect(queryApplyButton(host)).toBeNull();

    unmount();
  });

  it('does not render when no magic-layer changes are pending', () => {
    useEditorStore.getState().setActiveTool('magic-layer');
    const layer = makeLayer({
      sourceBounds: { x: 10, y: 20, width: 30, height: 40 },
      position: { x: 10, y: 20 },
      hidden: false,
    });
    const image = makeImage({ magicLayers: [layer] });
    const { host, unmount } = renderItem(image, true);

    expect(queryApplyButton(host)).toBeNull();

    unmount();
  });

  it('renders enabled when there are uncommitted magic-layer changes', () => {
    useEditorStore.getState().setActiveTool('magic-layer');
    const image = makeImage();
    const { host, unmount } = renderItem(image, true);

    const button = queryApplyButton(host);
    expect(button).not.toBeNull();
    expect(button?.disabled).toBe(false);

    unmount();
  });

  it('is disabled when the image status is not "ready"', () => {
    useEditorStore.getState().setActiveTool('magic-layer');
    const image = makeImage({ status: 'streaming' });
    const { host, unmount } = renderItem(image, true);

    const button = queryApplyButton(host);
    expect(button).not.toBeNull();
    expect(button?.disabled).toBe(true);

    unmount();
  });

  it('calls apply with the image id when the enabled button is clicked', async () => {
    useEditorStore.getState().setActiveTool('magic-layer');
    const image = makeImage();
    const { host, unmount } = renderItem(image, true);

    const button = queryApplyButton(host);
    expect(button).not.toBeNull();

    await act(async () => {
      button!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(mocks.mockApply).toHaveBeenCalledTimes(1);
    expect(mocks.mockApply).toHaveBeenCalledWith('img-1');

    unmount();
  });
});
