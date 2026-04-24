import { describe, expect, it } from 'vitest';
import {
  screenToNormalized,
  normalizedToScreen,
  normalizedToCanvas,
  pointsToBox,
} from '@/lib/canvas/coordinates';

describe('coordinate mapping utilities', () => {
  const imageSize = { width: 1000, height: 500 };

  describe('screenToNormalized', () => {
    it('maps identity at zoom=1, pan=0', () => {
      const viewport = { zoom: 1, panX: 0, panY: 0 };
      expect(screenToNormalized(0, 0, imageSize, viewport)).toEqual({ x: 0, y: 0 });
      expect(screenToNormalized(500, 250, imageSize, viewport)).toEqual({ x: 0.5, y: 0.5 });
      expect(screenToNormalized(1000, 500, imageSize, viewport)).toEqual({ x: 1, y: 1 });
    });

    it('scales by zoom', () => {
      const viewport = { zoom: 2, panX: 0, panY: 0 };
      expect(screenToNormalized(1000, 500, imageSize, viewport)).toEqual({ x: 0.5, y: 0.5 });
      expect(screenToNormalized(2000, 1000, imageSize, viewport)).toEqual({ x: 1, y: 1 });
    });

    it('offsets by pan', () => {
      const viewport = { zoom: 1, panX: 100, panY: 50 };
      expect(screenToNormalized(100, 50, imageSize, viewport)).toEqual({ x: 0, y: 0 });
      expect(screenToNormalized(600, 300, imageSize, viewport)).toEqual({ x: 0.5, y: 0.5 });
    });

    it('combines zoom and pan', () => {
      const viewport = { zoom: 2, panX: 100, panY: 50 };
      expect(screenToNormalized(300, 150, imageSize, viewport)).toEqual({ x: 0.1, y: 0.1 });
    });
  });

  describe('normalizedToScreen', () => {
    it('roundtrips with screenToNormalized', () => {
      const viewport = { zoom: 1.5, panX: 30, panY: -20 };
      const original = { x: 0.3, y: 0.7 };
      const screen = normalizedToScreen(original, imageSize, viewport);
      const back = screenToNormalized(screen.x, screen.y, imageSize, viewport);
      expect(back.x).toBeCloseTo(original.x, 10);
      expect(back.y).toBeCloseTo(original.y, 10);
    });

    it('scales and pans correctly', () => {
      const viewport = { zoom: 2, panX: 10, panY: 20 };
      expect(normalizedToScreen({ x: 0.5, y: 0.5 }, imageSize, viewport)).toEqual({
        x: 1010,
        y: 520,
      });
    });
  });

  describe('normalizedToCanvas', () => {
    it('scales to natural resolution', () => {
      expect(normalizedToCanvas({ x: 0.5, y: 0.5 }, imageSize)).toEqual({ x: 500, y: 250 });
    });

    it('maps corners to canvas pixels', () => {
      expect(normalizedToCanvas({ x: 1, y: 1 }, imageSize)).toEqual({ x: 1000, y: 500 });
    });
  });

  describe('pointsToBox', () => {
    it('returns a box for positive drag direction', () => {
      const box = pointsToBox({ x: 0.2, y: 0.3 }, { x: 0.7, y: 0.8 });
      expect(box.x).toBe(0.2);
      expect(box.y).toBe(0.3);
      expect(box.width).toBeCloseTo(0.5, 10);
      expect(box.height).toBeCloseTo(0.5, 10);
    });

    it('returns a box for negative drag direction', () => {
      const box = pointsToBox({ x: 0.8, y: 0.9 }, { x: 0.2, y: 0.4 });
      expect(box.x).toBe(0.2);
      expect(box.y).toBe(0.4);
      expect(box.width).toBeCloseTo(0.6, 10);
      expect(box.height).toBeCloseTo(0.5, 10);
    });
  });
});
