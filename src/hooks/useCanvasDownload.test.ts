/** @vitest-environment jsdom */

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCanvasDownload } from './useCanvasDownload';

const canvasExportMocks = vi.hoisted(() => ({
  exportImageWithAnnotations: vi.fn(),
}));

vi.mock('@/hooks/useCanvasExport', () => ({
  useCanvasExport: () => canvasExportMocks,
}));

interface DownloadApi {
  downloadCanvasImage(imageId: string): Promise<void>;
}

function renderHook(): { current: DownloadApi; unmount: () => void } {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root: Root = createRoot(host);
  const captured: { current?: DownloadApi } = {};

  function TestComponent() {
    captured.current = useCanvasDownload();
    return null;
  }

  act(() => {
    root.render(createElement(TestComponent));
  });

  if (!captured.current) {
    throw new Error('Hook did not render');
  }

  return {
    current: captured.current,
    unmount: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
}

function blobText(label: string): Blob {
  return new Blob([label], { type: 'image/png' });
}

let createdLinks: HTMLAnchorElement[] = [];
let createdObjectUrls: string[] = [];
let revokedObjectUrls: string[] = [];

beforeEach(() => {
  canvasExportMocks.exportImageWithAnnotations.mockReset();
  createdLinks = [];
  createdObjectUrls = [];
  revokedObjectUrls = [];

  vi.spyOn(URL, 'createObjectURL').mockImplementation((source) => {
    const stub = `blob:bananatape/${createdObjectUrls.length}`;
    createdObjectUrls.push(stub);
    void source;
    return stub;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
    revokedObjectUrls.push(url);
  });

  const originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const node = originalCreateElement(tag);
    if (tag === 'a') {
      const anchor = node as HTMLAnchorElement;
      anchor.click = vi.fn();
      createdLinks.push(anchor);
    }
    return node;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useCanvasDownload', () => {
  it('downloads the un-annotated original blob, never the annotated overlay', async () => {
    canvasExportMocks.exportImageWithAnnotations.mockResolvedValue({
      original: blobText('clean-original'),
      annotated: blobText('annotated-overlay'),
      mask: blobText('mask'),
      size: { width: 100, height: 100 },
    });

    const hook = renderHook();
    await hook.current.downloadCanvasImage('img-1');

    expect(canvasExportMocks.exportImageWithAnnotations).toHaveBeenCalledWith('img-1');
    expect(createdLinks).toHaveLength(1);

    const sourcedBlobUrl = createdLinks[0].href;
    expect(sourcedBlobUrl).toBe(createdObjectUrls[0]);

    const sourcedBlob = (URL.createObjectURL as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob;
    await expect(sourcedBlob.text()).resolves.toBe('clean-original');
    await expect(sourcedBlob.text()).resolves.not.toBe('annotated-overlay');

    expect(createdLinks[0].download).toMatch(/^bananatape-img-1-\d+\.png$/);
    expect((createdLinks[0].click as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    expect(revokedObjectUrls).toEqual([sourcedBlobUrl]);

    hook.unmount();
  });
});
