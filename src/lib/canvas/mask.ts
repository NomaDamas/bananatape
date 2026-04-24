import type { DrawingPath, BoundingBox, ImageSize } from '@/types';
import {
  createCanvasMapper,
  drawAnnotationPath,
} from './annotation-rendering';

interface GenerateMaskOptions {
  paths: DrawingPath[];
  boxes: BoundingBox[];
  naturalSize: ImageSize;
}

export function generateMask(options: GenerateMaskOptions): HTMLCanvasElement {
  const { paths, boxes, naturalSize } = options;
  const canvas = document.createElement('canvas');
  canvas.width = naturalSize.width;
  canvas.height = naturalSize.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, naturalSize.width, naturalSize.height);

  const toCanvas = createCanvasMapper(naturalSize);

  ctx.globalCompositeOperation = 'destination-out';

  paths.forEach((path) => {
    drawAnnotationPath(ctx, path, toCanvas, 'rgba(0,0,0,1)', path.strokeWidth * 2);
  });

  boxes.forEach((box) => {
    const x = box.x * naturalSize.width;
    const y = box.y * naturalSize.height;
    const width = box.width * naturalSize.width;
    const height = box.height * naturalSize.height;
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.fillRect(x, y, width, height);
  });

  ctx.globalCompositeOperation = 'source-over';

  return canvas;
}
