import { describe, expect, it } from 'vitest';
import { buildHistoryTree } from './build-history-tree';
import type { HistoryEntry } from '@/stores/types';
import type { CanvasImage } from '@/types/canvas';

function makeImage(id: string, parentId: string | null): CanvasImage {
  return {
    id,
    url: `/assets/${id}.png`,
    size: { width: 512, height: 512 },
    position: { x: 0, y: 0 },
    parentId,
    generationIndex: 0,
    prompt: `prompt ${id}`,
    provider: 'openai',
    type: parentId ? 'edit' : 'generate',
    createdAt: 1,
    paths: [],
    boxes: [],
    memos: [],
    status: 'ready',
  };
}

function makeEntry(id: string, imageId: string): HistoryEntry {
  return {
    id,
    imageId,
    prompt: `entry ${id}`,
    provider: 'openai',
    type: 'edit',
    timestamp: 1,
  };
}

describe('buildHistoryTree', () => {
  it('returns ancestor chain from root to focused image with grouped entries', () => {
    const images = {
      root: makeImage('root', null),
      child: makeImage('child', 'root'),
      grandchild: makeImage('grandchild', 'child'),
      sibling: makeImage('sibling', 'root'),
    };
    const entries = [makeEntry('a', 'root'), makeEntry('b', 'grandchild'), makeEntry('c', 'sibling')];

    const tree = buildHistoryTree(images, entries, 'grandchild');

    expect(tree.map((section) => section.image.id)).toEqual(['root', 'child', 'grandchild']);
    expect(tree.map((section) => section.entries.map((entry) => entry.id))).toEqual([['a'], [], ['b']]);
  });

  it('returns an empty tree when the focused image is missing', () => {
    expect(buildHistoryTree({}, [], 'missing')).toEqual([]);
  });

  it('stops safely when parent links form a cycle', () => {
    const images = {
      a: makeImage('a', 'b'),
      b: makeImage('b', 'a'),
    };

    const tree = buildHistoryTree(images, [], 'a');

    expect(tree.map((section) => section.image.id)).toEqual(['b', 'a']);
  });
});
