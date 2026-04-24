import type { DrawingPath, BoundingBox, TextMemo, ImageSize } from '@/types';
import {
  createCanvasMapper,
  drawAnnotationPath,
  drawBoundingBox,
  drawStickyMemo,
} from './annotation-rendering';

interface OverlayAnnotationsOptions {
  baseImage: HTMLImageElement;
  paths: DrawingPath[];
  boxes: BoundingBox[];
  memos: TextMemo[];
  naturalSize: ImageSize;
}

export function overlayAnnotations(options: OverlayAnnotationsOptions): HTMLCanvasElement {
  const { baseImage, paths, boxes, memos, naturalSize } = options;
  const canvas = document.createElement('canvas');
  canvas.width = naturalSize.width;
  canvas.height = naturalSize.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.drawImage(baseImage, 0, 0, naturalSize.width, naturalSize.height);

  const toCanvas = createCanvasMapper(naturalSize);

  paths.forEach((path) => drawAnnotationPath(ctx, path, toCanvas));
  boxes.forEach((box) => drawBoundingBox(ctx, box, naturalSize));
  memos.forEach((memo) => drawStickyMemo(ctx, memo, naturalSize));

  return canvas;
}
