import { describe, expect, it } from 'vitest';
import { countFocusedAnnotations, hasBusyFocusedBranches, isEditableGenerationSource, isImageBranchGenerating } from './branch-busy';
import type { CanvasImage } from '@/types/canvas';

function image(id: string, parentId: string | null = null, status: CanvasImage['status'] = 'ready'): CanvasImage {
  return {
    id,
    url: status === 'ready' ? `/${id}.png` : '',
    size: { width: 100, height: 100 },
    position: { x: 0, y: 0 },
    parentId,
    generationIndex: 0,
    prompt: id,
    provider: 'openai',
    type: parentId ? 'edit' : 'generate',
    createdAt: 1,
    paths: [],
    boxes: [],
    memos: [],
    status,
  };
}

describe('branch generation busy selectors', () => {
  it('marks a parent busy when a child generation is pending', () => {
    const images = {
      a: image('a'),
      b: image('b'),
      e: image('e', 'a', 'pending'),
    };

    expect(isImageBranchGenerating(images, 'a')).toBe(true);
    expect(isImageBranchGenerating(images, 'b')).toBe(false);
  });

  it('keeps sibling focused images editable while another branch is pending', () => {
    const images = {
      a: image('a'),
      b: image('b'),
      c: image('c'),
      e: image('e', 'a', 'pending'),
      f: image('f', 'a', 'pending'),
    };

    expect(hasBusyFocusedBranches(images, ['a'])).toBe(true);
    expect(hasBusyFocusedBranches(images, ['b'])).toBe(false);
    expect(hasBusyFocusedBranches(images, ['b', 'c'])).toBe(false);
  });

  it('counts focused annotations with non-empty memo text only', () => {
    const images: Record<string, CanvasImage> = {
      a: { ...image('a'), paths: [{ id: 'path', tool: 'pen', points: [], color: '#fff', strokeWidth: 1 }], memos: [{ id: 'blank', x: 0, y: 0, text: ' ', color: '#fff' }] },
      b: { ...image('b'), boxes: [{ id: 'box', tool: 'box', x: 0, y: 0, width: 1, height: 1, color: '#fff', status: 'pending' }], memos: [{ id: 'memo', x: 0, y: 0, text: 'note', color: '#fff' }] },
    };

    expect(countFocusedAnnotations(images, ['a', 'b'])).toBe(3);
  });

  it('identifies only ready or streaming images as editable sources', () => {
    expect(isEditableGenerationSource(image('ready'))).toBe(true);
    expect(isEditableGenerationSource(image('streaming', null, 'streaming'))).toBe(true);
    expect(isEditableGenerationSource(image('pending', null, 'pending'))).toBe(false);
    expect(isEditableGenerationSource(image('error', null, 'error'))).toBe(false);
  });

  it('treats pending descendants as a branch lock', () => {
    const images = {
      a: image('a'),
      e: image('e', 'a'),
      g: image('g', 'e', 'pending'),
    };

    expect(isImageBranchGenerating(images, 'a')).toBe(true);
    expect(isImageBranchGenerating(images, 'e')).toBe(true);
  });
});
