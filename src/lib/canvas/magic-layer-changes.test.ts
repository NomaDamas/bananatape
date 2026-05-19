import { describe, expect, it } from 'vitest';
import { hasMagicLayerChanges, isLayerMoved } from './magic-layer-changes';
import type { CanvasImage, MagicLayer } from '@/types/canvas';

function layer(overrides: Partial<MagicLayer> = {}): MagicLayer {
  return {
    id: 'layer-1',
    name: 'Layer 1',
    maskDataUrl: 'data:image/png;base64,mask',
    cutoutDataUrl: 'data:image/png;base64,cutout',
    sourceBounds: { x: 10, y: 20, width: 30, height: 40 },
    position: { x: 10, y: 20 },
    hidden: false,
    ...overrides,
  };
}

function image(magicLayers?: CanvasImage['magicLayers']): Pick<CanvasImage, 'magicLayers'> {
  return { magicLayers };
}

describe('magic-layer-changes', () => {
  it('returns false when magicLayers is undefined', () => {
    expect(hasMagicLayerChanges(image(undefined))).toBe(false);
  });

  it('returns false when magicLayers is empty', () => {
    expect(hasMagicLayerChanges(image([]))).toBe(false);
  });

  it('returns false for a single untouched visible layer', () => {
    expect(hasMagicLayerChanges(image([layer()]))).toBe(false);
  });

  it('returns true for a single moved layer when x differs', () => {
    expect(hasMagicLayerChanges(image([layer({ position: { x: 11, y: 20 } })]))).toBe(true);
  });

  it('returns true for a single moved layer when y differs', () => {
    expect(hasMagicLayerChanges(image([layer({ position: { x: 10, y: 21 } })]))).toBe(true);
  });

  it('returns true for a single hidden layer', () => {
    expect(hasMagicLayerChanges(image([layer({ hidden: true })]))).toBe(true);
  });

  it('returns true when any layer in a mix is moved', () => {
    expect(hasMagicLayerChanges(image([layer(), layer({ position: { x: 15, y: 20 } })]))).toBe(true);
  });

  it('returns true when any layer in a mix is hidden', () => {
    expect(hasMagicLayerChanges(image([layer(), layer({ hidden: true })]))).toBe(true);
  });

  it('returns true only when position differs from sourceBounds in x or y', () => {
    expect(isLayerMoved(layer())).toBe(false);
    expect(isLayerMoved(layer({ position: { x: 11, y: 20 } }))).toBe(true);
    expect(isLayerMoved(layer({ position: { x: 10, y: 21 } }))).toBe(true);
  });
});
