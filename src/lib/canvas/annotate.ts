import type { DrawingPath, BoundingBox, TextMemo, ImageSize } from '@/types';

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

  const toCanvas = (nx: number, ny: number) => ({
    x: nx * naturalSize.width,
    y: ny * naturalSize.height,
  });

  paths.forEach((path) => {
    if (path.points.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = path.color;
    ctx.lineWidth = path.strokeWidth;
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
    ctx.strokeStyle = box.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(pos.x, pos.y, w, h);
  });

  memos.forEach((memo) => {
    const pos = toCanvas(memo.x, memo.y);
    const padding = 8;
    const lineHeight = 18;
    const maxWidth = 200;

    ctx.font = '14px sans-serif';
    const lines = wrapText(ctx, memo.text, maxWidth);
    const boxWidth = maxWidth + padding * 2;
    const boxHeight = lines.length * lineHeight + padding * 2;

    ctx.fillStyle = memo.color;
    roundRect(ctx, pos.x, pos.y, boxWidth, boxHeight, 4);
    ctx.fill();

    ctx.fillStyle = '#000000';
    lines.forEach((line, i) => {
      ctx.fillText(line, pos.x + padding, pos.y + padding + (i + 1) * lineHeight - 4);
    });
  });

  return canvas;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = words[0] || '';

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + ' ' + word).width;
    if (width < maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
