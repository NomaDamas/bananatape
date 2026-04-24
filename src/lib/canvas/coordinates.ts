export interface Point { x: number; y: number; }
export interface NormalizedPoint { x: number; y: number; }
export interface Rect { x: number; y: number; width: number; height: number; }

export interface Viewport {
  zoom: number;
  panX: number;
  panY: number;
}

export function screenToNormalized(
  screenX: number,
  screenY: number,
  imageSize: { width: number; height: number },
  viewport: Viewport,
): NormalizedPoint {
  const x = (screenX - viewport.panX) / viewport.zoom / imageSize.width;
  const y = (screenY - viewport.panY) / viewport.zoom / imageSize.height;
  return { x, y };
}

export function normalizedToScreen(
  point: NormalizedPoint,
  imageSize: { width: number; height: number },
  viewport: Viewport,
): Point {
  return {
    x: point.x * imageSize.width * viewport.zoom + viewport.panX,
    y: point.y * imageSize.height * viewport.zoom + viewport.panY,
  };
}

export function normalizedToCanvas(
  point: NormalizedPoint,
  imageSize: { width: number; height: number },
): Point {
  return {
    x: point.x * imageSize.width,
    y: point.y * imageSize.height,
  };
}

export function pointsToBox(
  start: NormalizedPoint,
  current: NormalizedPoint,
): { x: number; y: number; width: number; height: number } {
  const x = Math.min(start.x, current.x);
  const y = Math.min(start.y, current.y);
  const width = Math.abs(current.x - start.x);
  const height = Math.abs(current.y - start.y);
  return { x, y, width, height };
}

export function clientToNormalized(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): NormalizedPoint {
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
}

export function normalizedToClient(
  point: NormalizedPoint,
  rect: DOMRect,
): Point {
  return {
    x: point.x * rect.width,
    y: point.y * rect.height,
  };
}
