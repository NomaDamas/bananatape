export interface ImageBounds {
  id: string;
  x: number;       // world-space top-left X
  y: number;
  width: number;   // image render width in world units
  height: number;
}

export interface ViewportBounds {
  x: number;       // world-space top-left X of current viewport (after pan/zoom inversion)
  y: number;
  width: number;
  height: number;
}

type Rect = { x: number; y: number; width: number; height: number };

/**
 * Pure AABB intersection in world coordinates.
 * Uses strict inequality — touching edges count as NOT intersecting.
 */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * Compute viewport bounds in world-space from screen-space pan/zoom.
 * world = (-panX/zoom, -panY/zoom, containerWidth/zoom, containerHeight/zoom)
 *
 * panX, panY: CSS translate values applied to transform-wrapper.
 */
export function computeViewportBounds(input: {
  panX: number;
  panY: number;
  zoom: number;
  containerWidth: number;
  containerHeight: number;
}): ViewportBounds {
  const { panX, panY, zoom, containerWidth, containerHeight } = input;
  return {
    x: panX === 0 ? 0 : -panX / zoom,
    y: panY === 0 ? 0 : -panY / zoom,
    width: containerWidth / zoom,
    height: containerHeight / zoom,
  };
}

/**
 * Expand viewport bounds by a margin percentage on all sides.
 * Returns a new bounds object.
 */
export function expandBounds(bounds: ViewportBounds, marginPct: number): ViewportBounds {
  const { x, y, width, height } = bounds;
  return {
    x: x - width * marginPct,
    y: y - height * marginPct,
    width: width * (1 + 2 * marginPct),
    height: height * (1 + 2 * marginPct),
  };
}

// Module-scope memoization state
let lastImages: readonly ImageBounds[] | undefined;
let lastViewport: ViewportBounds | undefined;
let lastMarginPct: number | undefined;
let lastResult: readonly string[] | undefined;

/**
 * Returns the IDs of images that intersect the viewport rectangle, expanded by marginPct on each side.
 * Margin (default 0.2 = 20%) prevents mount/unmount flicker at viewport edges.
 *
 * Memoization: if the previous call's inputs are referentially equal to the new call,
 * the SAME array reference is returned.
 *
 * Important: callers MUST treat the returned array as readonly.
 */
export function getVisibleImageIds(
  images: readonly ImageBounds[],
  viewport: ViewportBounds,
  marginPct: number = 0.2,
): readonly string[] {
  if (
    images === lastImages &&
    viewport === lastViewport &&
    marginPct === lastMarginPct &&
    lastResult !== undefined
  ) {
    return lastResult;
  }

  const expanded = expandBounds(viewport, marginPct);
  const result = images
    .filter((img) => rectsIntersect(img, expanded))
    .map((img) => img.id);

  lastImages = images;
  lastViewport = viewport;
  lastMarginPct = marginPct;
  lastResult = result;

  return result;
}
