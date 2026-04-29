import { describe, it, expect, beforeEach } from 'vitest';
import {
  rectsIntersect,
  computeViewportBounds,
  expandBounds,
  getVisibleImageIds,
  type ImageBounds,
  type ViewportBounds,
} from './culling';

const vp: ViewportBounds = { x: 0, y: 0, width: 800, height: 600 };

function img(id: string, x: number, y: number, w: number, h: number): ImageBounds {
  return { id, x, y, width: w, height: h };
}

describe('rectsIntersect', () => {
  it('returns true when a is fully inside b', () => {
    expect(rectsIntersect({ x: 10, y: 10, width: 50, height: 50 }, { x: 0, y: 0, width: 100, height: 100 })).toBe(true);
  });

  it('returns true when b is fully inside a', () => {
    expect(rectsIntersect({ x: 0, y: 0, width: 100, height: 100 }, { x: 10, y: 10, width: 50, height: 50 })).toBe(true);
  });

  it('returns true when rects partially overlap', () => {
    expect(rectsIntersect({ x: 0, y: 0, width: 60, height: 60 }, { x: 40, y: 40, width: 60, height: 60 })).toBe(true);
  });

  it('returns false when rects are completely separate', () => {
    expect(rectsIntersect({ x: 0, y: 0, width: 50, height: 50 }, { x: 100, y: 100, width: 50, height: 50 })).toBe(false);
  });

  it('returns false when edges touch (strict inequality)', () => {
    expect(rectsIntersect({ x: 0, y: 0, width: 50, height: 50 }, { x: 50, y: 0, width: 50, height: 50 })).toBe(false);
  });

  it('returns false when top/bottom edges touch', () => {
    expect(rectsIntersect({ x: 0, y: 0, width: 50, height: 50 }, { x: 0, y: 50, width: 50, height: 50 })).toBe(false);
  });
});

describe('computeViewportBounds', () => {
  it('pan=(0,0), zoom=1, container 800x600 → world (0,0,800,600)', () => {
    const result = computeViewportBounds({ panX: 0, panY: 0, zoom: 1, containerWidth: 800, containerHeight: 600 });
    expect(result).toEqual({ x: 0, y: 0, width: 800, height: 600 });
  });

  it('pan=(-100,-200), zoom=2, container 800x600 → world (50,100,400,300)', () => {
    const result = computeViewportBounds({ panX: -100, panY: -200, zoom: 2, containerWidth: 800, containerHeight: 600 });
    expect(result).toEqual({ x: 50, y: 100, width: 400, height: 300 });
  });

  it('positive pan shifts viewport origin negatively in world space', () => {
    const result = computeViewportBounds({ panX: 200, panY: 100, zoom: 1, containerWidth: 800, containerHeight: 600 });
    expect(result).toEqual({ x: -200, y: -100, width: 800, height: 600 });
  });
});

describe('expandBounds', () => {
  it('20% on (0,0,100,100) → (-20,-20,140,140)', () => {
    const result = expandBounds({ x: 0, y: 0, width: 100, height: 100 }, 0.2);
    expect(result).toEqual({ x: -20, y: -20, width: 140, height: 140 });
  });

  it('0% margin returns same dimensions', () => {
    const result = expandBounds({ x: 10, y: 20, width: 100, height: 200 }, 0);
    expect(result).toEqual({ x: 10, y: 20, width: 100, height: 200 });
  });

  it('does not mutate input', () => {
    const bounds: ViewportBounds = { x: 0, y: 0, width: 100, height: 100 };
    expandBounds(bounds, 0.5);
    expect(bounds).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });
});

describe('getVisibleImageIds', () => {
  it('empty images → []', () => {
    expect(getVisibleImageIds([], vp)).toEqual([]);
  });

  it('single image fully inside viewport → returned', () => {
    const images = [img('a', 100, 100, 200, 200)];
    expect(getVisibleImageIds(images, vp, 0)).toEqual(['a']);
  });

  it('single image fully outside viewport → not returned', () => {
    const images = [img('a', 1000, 1000, 100, 100)];
    expect(getVisibleImageIds(images, vp, 0)).toEqual([]);
  });

  it('single image partially overlapping viewport → returned', () => {
    const images = [img('a', 700, 500, 200, 200)];
    expect(getVisibleImageIds(images, vp, 0)).toEqual(['a']);
  });

  it('edge-touching → NOT returned (strict inequality)', () => {
    const images = [img('a', 800, 0, 100, 100)];
    expect(getVisibleImageIds(images, vp, 0)).toEqual([]);
  });

  it('large image enclosing viewport → returned', () => {
    const images = [img('a', -100, -100, 2000, 2000)];
    expect(getVisibleImageIds(images, vp, 0)).toEqual(['a']);
  });

  it('image just outside viewport but within 20% margin → returned', () => {
    const images = [img('a', 810, 0, 100, 100)];
    expect(getVisibleImageIds(images, vp, 0.2)).toEqual(['a']);
  });

  it('image well outside margin → not returned', () => {
    const images = [img('a', 2000, 0, 100, 100)];
    expect(getVisibleImageIds(images, vp, 0.2)).toEqual([]);
  });

  it('multiple images: only intersecting ones returned', () => {
    const images = [
      img('inside', 100, 100, 100, 100),
      img('outside', 2000, 2000, 100, 100),
      img('partial', 750, 550, 100, 100),
    ];
    const result = getVisibleImageIds(images, vp, 0);
    expect(result).toContain('inside');
    expect(result).toContain('partial');
    expect(result).not.toContain('outside');
  });

  describe('memoization', () => {
    it('same inputs return same array reference', () => {
      const images = [img('a', 100, 100, 100, 100)];
      const viewport: ViewportBounds = { x: 0, y: 0, width: 800, height: 600 };
      const r1 = getVisibleImageIds(images, viewport, 0.2);
      const r2 = getVisibleImageIds(images, viewport, 0.2);
      expect(Object.is(r1, r2)).toBe(true);
    });

    it('different images array returns different result', () => {
      const images1 = [img('a', 100, 100, 100, 100)];
      const images2 = [img('b', 100, 100, 100, 100)];
      const viewport: ViewportBounds = { x: 0, y: 0, width: 800, height: 600 };
      const r1 = getVisibleImageIds(images1, viewport, 0.2);
      const r2 = getVisibleImageIds(images2, viewport, 0.2);
      expect(Object.is(r1, r2)).toBe(false);
    });

    it('different viewport object returns different result', () => {
      const images = [img('a', 100, 100, 100, 100)];
      const vp1: ViewportBounds = { x: 0, y: 0, width: 800, height: 600 };
      const vp2: ViewportBounds = { x: 0, y: 0, width: 800, height: 600 };
      const r1 = getVisibleImageIds(images, vp1, 0.2);
      const r2 = getVisibleImageIds(images, vp2, 0.2);
      expect(Object.is(r1, r2)).toBe(false);
    });

    it('different marginPct returns different result', () => {
      const images = [img('a', 100, 100, 100, 100)];
      const viewport: ViewportBounds = { x: 0, y: 0, width: 800, height: 600 };
      const r1 = getVisibleImageIds(images, viewport, 0.1);
      const r2 = getVisibleImageIds(images, viewport, 0.3);
      expect(Object.is(r1, r2)).toBe(false);
    });
  });
});
