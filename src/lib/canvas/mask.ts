import type { DrawingPath, BoundingBox, ImageSize } from '@/types';

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

  const toCanvas = (nx: number, ny: number) => ({
    x: nx * naturalSize.width,
    y: ny * naturalSize.height,
  });

  ctx.globalCompositeOperation = 'destination-out';

  paths.forEach((path) => {
    if (path.points.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.lineWidth = path.strokeWidth * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const start = toCanvas(path.points[0].x, path.points[0].y);
    ctx.moveTo(start.x, start.y);
    for (let i = 1; i < path.points.length; i++) {
      const p = toCanvas(path.points[i].x, path.points[i].y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  });

  boxes.forEach((box) => {
    const pos = toCanvas(box.x, box.y);
    const w = box.width * naturalSize.width;
    const h = box.height * naturalSize.height;
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.fillRect(pos.x, pos.y, w, h);
  });

  ctx.globalCompositeOperation = 'source-over';

  return canvas;
}
