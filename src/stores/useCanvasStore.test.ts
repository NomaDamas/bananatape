import { beforeEach, describe, expect, it } from 'vitest';
import { useCanvasStore, type CanvasState } from './useCanvasStore';
import type { CanvasImage } from '@/types/canvas';
import type { BoundingBox, DrawingPath, TextMemo } from '@/types';

function makeImage(id: string, status: CanvasImage['status'] = 'ready'): CanvasImage {
  return {
    id,
    url: `/assets/${id}.png`,
    size: { width: 512, height: 512 },
    position: { x: 0, y: 0 },
    parentId: null,
    generationIndex: 0,
    prompt: `prompt ${id}`,
    provider: 'openai',
    type: 'generate',
    createdAt: 1,
    paths: [],
    boxes: [],
    memos: [],
    status,
  };
}

const path: DrawingPath = {
  id: 'path-1',
  tool: 'pen',
  points: [{ x: 0.1, y: 0.2 }],
  color: '#ef4444',
  strokeWidth: 3,
};

const box: BoundingBox = {
  id: 'box-1',
  tool: 'box',
  x: 0.1,
  y: 0.2,
  width: 0.3,
  height: 0.4,
  color: '#ef4444',
  status: 'pending',
};

const memo: TextMemo = {
  id: 'memo-1',
  x: 0.1,
  y: 0.2,
  text: 'memo',
  color: '#fef3c7',
};

function resetStore(): void {
  useCanvasStore.setState({
    images: {},
    imageOrder: [],
    focusedImageIds: [],
    imageHistories: {},
    viewport: { panX: 0, panY: 0, zoom: 1, width: 0, height: 0 },
  });
  useCanvasStore.temporal.getState().clear();
  useCanvasStore.temporal.getState().resume();
}

function pastLength(): number {
  return useCanvasStore.temporal.getState().pastStates.length;
}

describe('useCanvasStore', () => {
  beforeEach(() => {
    resetStore();
  });

  it('addImage stores the image and appends imageOrder', () => {
    const image = makeImage('a');

    useCanvasStore.getState().addImage(image);

    expect(useCanvasStore.getState().images.a).toBe(image);
    expect(useCanvasStore.getState().imageOrder).toEqual(['a']);
  });

  it('addImages is an atomic batch undo entry', () => {
    useCanvasStore.getState().addImages([makeImage('a'), makeImage('b'), makeImage('c')]);

    expect(useCanvasStore.getState().imageOrder).toEqual(['a', 'b', 'c']);
    expect(pastLength()).toBe(1);

    useCanvasStore.temporal.getState().undo();

    expect(useCanvasStore.getState().images).toEqual({});
    expect(useCanvasStore.getState().imageOrder).toEqual([]);
  });

  it('updateImage mutates only the target image reference', () => {
    const first = makeImage('a');
    const second = makeImage('b');
    useCanvasStore.getState().addImages([first, second]);

    useCanvasStore.getState().updateImage('a', { prompt: 'changed' });

    expect(useCanvasStore.getState().images.a).not.toBe(first);
    expect(useCanvasStore.getState().images.a.prompt).toBe('changed');
    expect(useCanvasStore.getState().images.b).toBe(second);
  });

  it('deleteImage removes image, order, and deleted focus', () => {
    useCanvasStore.getState().addImages([makeImage('a'), makeImage('b')]);
    useCanvasStore.getState().setFocusedImages(['a', 'b']);

    useCanvasStore.getState().deleteImage('a');

    expect(useCanvasStore.getState().images.a).toBeUndefined();
    expect(useCanvasStore.getState().imageOrder).toEqual(['b']);
    expect(useCanvasStore.getState().focusedImageIds).toEqual(['b']);
  });

  it('setFocusedImages replaces focus and deduplicates ids', () => {
    useCanvasStore.getState().setFocusedImages(['a']);
    useCanvasStore.getState().setFocusedImages(['b', 'b', 'c']);

    expect(useCanvasStore.getState().focusedImageIds).toEqual(['b', 'c']);
  });

  it('setFocusedImages additive unions focus and deduplicates ids', () => {
    useCanvasStore.getState().setFocusedImages(['a', 'b']);
    useCanvasStore.getState().setFocusedImages(['b', 'c'], true);

    expect(useCanvasStore.getState().focusedImageIds).toEqual(['a', 'b', 'c']);
  });

  it('setFocusedImage aliases single focus and clearing focus', () => {
    useCanvasStore.getState().setFocusedImage('b');
    expect(useCanvasStore.getState().focusedImageIds).toEqual(['b']);

    useCanvasStore.getState().setFocusedImage(null);
    expect(useCanvasStore.getState().focusedImageIds).toEqual([]);
  });

  it('addPathToImage changes only the target image paths array', () => {
    const first = makeImage('a');
    const second = makeImage('b');
    useCanvasStore.getState().addImages([first, second]);

    useCanvasStore.getState().addPathToImage('a', path);

    expect(useCanvasStore.getState().images.a.paths).toEqual([path]);
    expect(useCanvasStore.getState().images.a).not.toBe(first);
    expect(useCanvasStore.getState().images.b).toBe(second);
    expect(useCanvasStore.getState().images.b.paths).toBe(second.paths);
  });

  it('box and memo annotation helpers update immutable arrays', () => {
    useCanvasStore.getState().addImage(makeImage('a'));

    useCanvasStore.getState().addBoxToImage('a', box);
    useCanvasStore.getState().updateBoxOnImage('a', 'box-1', { status: 'accepted' });
    useCanvasStore.getState().addMemoToImage('a', memo);
    useCanvasStore.getState().updateMemoOnImage('a', 'memo-1', { text: 'changed' });

    expect(useCanvasStore.getState().images.a.boxes).toEqual([{ ...box, status: 'accepted' }]);
    expect(useCanvasStore.getState().images.a.memos).toEqual([{ ...memo, text: 'changed' }]);

    useCanvasStore.getState().removeBoxFromImage('a', 'box-1');
    useCanvasStore.getState().removeMemoFromImage('a', 'memo-1');

    expect(useCanvasStore.getState().images.a.boxes).toEqual([]);
    expect(useCanvasStore.getState().images.a.memos).toEqual([]);
  });

  it('path update/remove and clearAnnotationsOnImage work immutably', () => {
    useCanvasStore.getState().addImage({ ...makeImage('a'), paths: [path], boxes: [box], memos: [memo] });

    useCanvasStore.getState().updatePathOnImage('a', 'path-1', { color: '#000000' });
    expect(useCanvasStore.getState().images.a.paths).toEqual([{ ...path, color: '#000000' }]);

    useCanvasStore.getState().removePathFromImage('a', 'path-1');
    expect(useCanvasStore.getState().images.a.paths).toEqual([]);

    useCanvasStore.getState().clearAnnotationsOnImage('a');
    expect(useCanvasStore.getState().images.a).toMatchObject({ paths: [], boxes: [], memos: [] });
  });


  it('keeps undo and redo stacks isolated per image', () => {
    useCanvasStore.getState().addImages([makeImage('a'), makeImage('b')]);
    useCanvasStore.getState().addBoxToImage('a', box);
    useCanvasStore.getState().addMemoToImage('b', memo);

    useCanvasStore.getState().undoImage('a');

    expect(useCanvasStore.getState().images.a.boxes).toEqual([]);
    expect(useCanvasStore.getState().images.b.memos).toEqual([memo]);

    useCanvasStore.getState().redoImage('a');
    expect(useCanvasStore.getState().images.a.boxes).toEqual([box]);
    expect(useCanvasStore.getState().images.b.memos).toEqual([memo]);
  });

  it('clears only the selected image redo branch after a new action', () => {
    useCanvasStore.getState().addImages([makeImage('a'), makeImage('b')]);
    useCanvasStore.getState().addBoxToImage('a', box);
    useCanvasStore.getState().addMemoToImage('b', memo);
    useCanvasStore.getState().undoImage('a');
    useCanvasStore.getState().undoImage('b');

    expect(useCanvasStore.getState().canRedoImage('a')).toBe(true);
    expect(useCanvasStore.getState().canRedoImage('b')).toBe(true);

    useCanvasStore.getState().addPathToImage('a', path);

    expect(useCanvasStore.getState().canRedoImage('a')).toBe(false);
    expect(useCanvasStore.getState().canRedoImage('b')).toBe(true);
  });

  it('batches memo typing into one undoable image event', () => {
    useCanvasStore.getState().addImage(makeImage('a'));
    useCanvasStore.getState().addMemoToImage('a', { ...memo, text: '' });
    const afterAdd = useCanvasStore.getState().images.a;

    useCanvasStore.getState().updateMemoOnImage('a', 'memo-1', { text: 'h' }, { track: false });
    useCanvasStore.getState().updateMemoOnImage('a', 'memo-1', { text: 'hi' }, { track: false });
    useCanvasStore.getState().commitMemoTextOnImage('a', 'memo-1', 'hi', { historySnapshot: afterAdd });

    useCanvasStore.getState().undoImage('a');
    expect(useCanvasStore.getState().images.a.memos).toEqual([{ ...memo, text: '' }]);
  });

  it('setImageStatus does not push an undo entry', () => {
    useCanvasStore.getState().addImage(makeImage('a', 'pending'));
    const before = pastLength();

    useCanvasStore.getState().setImageStatus('a', 'error', 'failed');

    expect(useCanvasStore.getState().images.a.status).toBe('error');
    expect(useCanvasStore.getState().images.a.error).toBe('failed');
    expect(pastLength()).toBe(before);
  });

  it('hydrate replaces state atomically and remains undoable', () => {
    useCanvasStore.getState().addImage(makeImage('old'));
    const images = { a: makeImage('a'), b: makeImage('b') };

    useCanvasStore.getState().hydrate(images, ['b', 'a'], ['b']);

    expect(useCanvasStore.getState().images).toBe(images);
    expect(useCanvasStore.getState().imageOrder).toEqual(['b', 'a']);
    expect(useCanvasStore.getState().focusedImageIds).toEqual(['b']);

    useCanvasStore.temporal.getState().undo();
    expect(useCanvasStore.getState().imageOrder).toEqual(['old']);
  });

  it('resetCanvas empties state and clears the undo stack', () => {
    useCanvasStore.getState().addImage(makeImage('a'));
    useCanvasStore.getState().setFocusedImage('a');
    useCanvasStore.getState().setViewport({ panX: 10, panY: 20, zoom: 2 });

    useCanvasStore.getState().resetCanvas();

    expect(useCanvasStore.getState().images).toEqual({});
    expect(useCanvasStore.getState().imageOrder).toEqual([]);
    expect(useCanvasStore.getState().focusedImageIds).toEqual([]);
    expect(useCanvasStore.getState().imageHistories).toEqual({});
    expect(useCanvasStore.getState().viewport).toEqual({ panX: 0, panY: 0, zoom: 1, width: 0, height: 0 });
    expect(pastLength()).toBe(0);
    expect(useCanvasStore.temporal.getState().futureStates.length).toBe(0);
  });

  it('focus and viewport changes do not push undo entries', () => {
    const before = pastLength();

    useCanvasStore.getState().setFocusedImages(['a']);
    useCanvasStore.getState().setFocusedImages(['b'], true);
    useCanvasStore.getState().setFocusedImage('c');
    useCanvasStore.getState().setViewport({ panX: 20, panY: 30, zoom: 2 });
    useCanvasStore.getState().zoomIn();
    useCanvasStore.getState().zoomOut();
    useCanvasStore.getState().resetViewport();

    expect(pastLength()).toBe(before);
  });

  it('undo and redo restore image data', () => {
    useCanvasStore.getState().addImage(makeImage('a'));

    useCanvasStore.temporal.getState().undo();
    expect(useCanvasStore.getState().images.a).toBeUndefined();

    useCanvasStore.temporal.getState().redo();
    expect(useCanvasStore.getState().images.a).toEqual(makeImage('a'));
  });

  it('undo stack respects the 100 entry limit', () => {
    for (let i = 0; i < 105; i += 1) {
      useCanvasStore.getState().addImage(makeImage(`image-${i}`));
    }

    expect(pastLength()).toBe(100);
  });

  it('auto-focuses first ready image only when no focus exists', () => {
    useCanvasStore.getState().addImage(makeImage('pending', 'pending'));
    expect(useCanvasStore.getState().focusedImageIds).toEqual([]);

    useCanvasStore.getState().addImage(makeImage('ready'));
    expect(useCanvasStore.getState().focusedImageIds).toEqual(['ready']);

    useCanvasStore.getState().addImage(makeImage('later'));
    expect(useCanvasStore.getState().focusedImageIds).toEqual(['ready']);
  });

  it('deleteImages removes multiple images and prunes deleted focus', () => {
    useCanvasStore.getState().addImages([makeImage('a'), makeImage('b'), makeImage('c')]);
    useCanvasStore.setState({ focusedImageIds: ['a', 'b', 'c'] } satisfies Partial<CanvasState>);

    useCanvasStore.getState().deleteImages(['a', 'b']);

    expect(useCanvasStore.getState().imageOrder).toEqual(['c']);
    expect(useCanvasStore.getState().focusedImageIds).toEqual(['c']);
  });
});
