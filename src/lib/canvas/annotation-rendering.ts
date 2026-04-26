import type { BoundingBox, DrawingPath, ImageSize, NormalizedPoint, TextMemo } from '@/types';

export const BOX_STROKE_WIDTH = 5;
export const ACTIVE_BOX_STROKE_WIDTH = 5;

export const STICKY_MEMO_FONT_SIZE = 16;
export const STICKY_MEMO_LINE_HEIGHT = 24;
export const STICKY_MEMO_PADDING = 12;

const MEMO_RADIUS = 8;
const MEMO_AVERAGE_CHAR_WIDTH = 8;
const MEMO_MIN_WIDTH = 160;
const MEMO_MAX_WIDTH = 320;
const MEMO_MIN_ROWS = 2;
const MEMO_MAX_ROWS = 12;
const MEMO_MIN_TEXT_WIDTH = MEMO_MIN_WIDTH - STICKY_MEMO_PADDING * 2;
const MEMO_MAX_TEXT_WIDTH = MEMO_MAX_WIDTH - STICKY_MEMO_PADDING * 2;

interface CanvasPoint {
  x: number;
  y: number;
}

export function createCanvasMapper(naturalSize: ImageSize) {
  return (point: NormalizedPoint): CanvasPoint => ({
    x: point.x * naturalSize.width,
    y: point.y * naturalSize.height,
  });
}

export function estimateStickyMemoSize(text: string): { width: number; height: number; rows: number } {
  const normalized = normalizeMemoText(text);
  const paragraphs = normalized.split('\n');
  const longestLineLength = Math.max(...paragraphs.map((line) => Array.from(line).length), 0);
  const width = clamp(
    longestLineLength * MEMO_AVERAGE_CHAR_WIDTH + STICKY_MEMO_PADDING * 2,
    MEMO_MIN_WIDTH,
    MEMO_MAX_WIDTH,
  );
  const charsPerLine = Math.max(
    1,
    Math.floor((width - STICKY_MEMO_PADDING * 2) / MEMO_AVERAGE_CHAR_WIDTH),
  );
  const rows = clamp(
    paragraphs.reduce(
      (total, line) => total + Math.max(1, Math.ceil(Array.from(line).length / charsPerLine)),
      0,
    ),
    MEMO_MIN_ROWS,
    MEMO_MAX_ROWS,
  );

  return {
    width,
    height: rows * STICKY_MEMO_LINE_HEIGHT + STICKY_MEMO_PADDING * 2,
    rows,
  };
}

export function drawAnnotationPath(
  ctx: CanvasRenderingContext2D,
  path: DrawingPath,
  toCanvas: (point: NormalizedPoint) => CanvasPoint,
  color = path.color,
  lineWidth = path.strokeWidth,
) {
  if (path.points.length < 2) return;

  if (path.tool === 'arrow') {
    drawArrow(ctx, toCanvas(path.points[0]), toCanvas(path.points[path.points.length - 1]), color, lineWidth);
    return;
  }

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const start = toCanvas(path.points[0]);
  ctx.moveTo(start.x, start.y);
  for (let i = 1; i < path.points.length; i++) {
    const point = toCanvas(path.points[i]);
    ctx.lineTo(point.x, point.y);
  }
  ctx.stroke();
}

export function drawArrow(
  ctx: CanvasRenderingContext2D,
  start: CanvasPoint,
  end: CanvasPoint,
  color: string,
  lineWidth: number,
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 1) return;

  const angle = Math.atan2(dy, dx);
  const headLength = Math.max(14, lineWidth * 4.5);
  const headAngle = Math.PI / 7;

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(
    end.x - headLength * Math.cos(angle - headAngle),
    end.y - headLength * Math.sin(angle - headAngle),
  );
  ctx.lineTo(
    end.x - headLength * Math.cos(angle + headAngle),
    end.y - headLength * Math.sin(angle + headAngle),
  );
  ctx.closePath();
  ctx.fill();
}

export function drawBoundingBox(
  ctx: CanvasRenderingContext2D,
  box: Pick<BoundingBox, 'x' | 'y' | 'width' | 'height' | 'color'>,
  naturalSize: ImageSize,
  options?: { dashed?: boolean; lineWidth?: number },
) {
  const x = box.x * naturalSize.width;
  const y = box.y * naturalSize.height;
  const width = box.width * naturalSize.width;
  const height = box.height * naturalSize.height;

  if (options?.dashed) ctx.setLineDash([8, 6]);
  ctx.strokeStyle = box.color;
  ctx.lineWidth = options?.lineWidth ?? BOX_STROKE_WIDTH;
  ctx.lineJoin = 'round';
  ctx.strokeRect(x, y, width, height);
  if (options?.dashed) ctx.setLineDash([]);
}

export function drawStickyMemo(
  ctx: CanvasRenderingContext2D,
  memo: TextMemo,
  naturalSize: ImageSize,
) {
  const x = memo.x * naturalSize.width;
  const y = memo.y * naturalSize.height;

  ctx.font = `${STICKY_MEMO_FONT_SIZE}px Pretendard, sans-serif`;
  ctx.textBaseline = 'alphabetic';
  const { lines, boxWidth, boxHeight } = measureStickyMemoLayout(ctx, memo.text);

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = memo.color;
  roundRect(ctx, x, y, boxWidth, boxHeight, MEMO_RADIUS);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = 'rgba(161, 98, 7, 0.45)';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, boxWidth, boxHeight, MEMO_RADIUS);
  ctx.stroke();

  ctx.fillStyle = '#111827';
  lines.forEach((line, index) => {
    ctx.fillText(
      line,
      x + STICKY_MEMO_PADDING,
      y + STICKY_MEMO_PADDING + (index + 1) * STICKY_MEMO_LINE_HEIGHT - 5,
    );
  });
}

function measureStickyMemoLayout(ctx: CanvasRenderingContext2D, text: string) {
  const normalized = normalizeMemoText(text);
  const paragraphs = normalized.split('\n');
  const longestParagraphWidth = Math.max(
    ...paragraphs.map((paragraph) => ctx.measureText(paragraph || ' ').width),
    0,
  );
  const initialTextWidth = clamp(longestParagraphWidth, MEMO_MIN_TEXT_WIDTH, MEMO_MAX_TEXT_WIDTH);
  const lines = wrapText(ctx, normalized || ' ', initialTextWidth);
  const widestWrappedLine = Math.max(
    ...lines.map((line) => ctx.measureText(line || ' ').width),
    0,
  );
  const textWidth = clamp(widestWrappedLine, MEMO_MIN_TEXT_WIDTH, MEMO_MAX_TEXT_WIDTH);

  return {
    lines,
    boxWidth: Math.ceil(textWidth + STICKY_MEMO_PADDING * 2),
    boxHeight: lines.length * STICKY_MEMO_LINE_HEIGHT + STICKY_MEMO_PADDING * 2,
  };
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const normalized = normalizeMemoText(text);
  const lines: string[] = [];

  for (const paragraph of normalized.split('\n')) {
    const units = paragraph.match(/\S+\s*/g) ?? [''];
    let currentLine = '';

    for (const unit of units) {
      const candidate = currentLine + unit;
      if (!currentLine || ctx.measureText(candidate).width <= maxWidth) {
        currentLine = candidate;
        continue;
      }

      lines.push(currentLine.trimEnd());
      currentLine = fitLongUnit(ctx, unit.trimStart(), maxWidth, lines);
    }

    lines.push(currentLine.trimEnd());
  }

  return lines.length > 0 ? lines : [''];
}

function fitLongUnit(
  ctx: CanvasRenderingContext2D,
  unit: string,
  maxWidth: number,
  outputLines: string[],
): string {
  let currentLine = '';

  for (const char of Array.from(unit)) {
    const candidate = currentLine + char;
    if (!currentLine || ctx.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
    } else {
      outputLines.push(currentLine);
      currentLine = char;
    }
  }

  return currentLine;
}

function normalizeMemoText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
