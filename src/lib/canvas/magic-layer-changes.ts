import type { CanvasImage, MagicLayer } from '@/types/canvas';

export function isLayerMoved(layer: MagicLayer): boolean {
  return layer.position.x !== layer.sourceBounds.x || layer.position.y !== layer.sourceBounds.y;
}

export function hasMagicLayerChanges(image: Pick<CanvasImage, 'magicLayers'>): boolean {
  return image.magicLayers?.some((layer) => layer.hidden === true || isLayerMoved(layer)) ?? false;
}
