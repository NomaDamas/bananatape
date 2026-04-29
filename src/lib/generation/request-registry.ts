export interface GenerationHandle {
  imageId: string;
  requestId: number;
  controller: AbortController;
  signal: AbortSignal;
}

const handles = new Map<string, GenerationHandle>();
const latestRequestId = new Map<string, number>();

/**
 * Register a new generation attempt for the given imageId.
 * If a previous attempt is in-flight for this imageId, it is aborted first.
 * Returns a fresh handle with an incremented requestId.
 */
export function registerGeneration(imageId: string): GenerationHandle {
  const existing = handles.get(imageId);
  if (existing) {
    existing.controller.abort();
  }

  const prev = latestRequestId.get(imageId) ?? 0;
  const requestId = prev + 1;
  latestRequestId.set(imageId, requestId);

  const controller = new AbortController();
  const handle: GenerationHandle = {
    imageId,
    requestId,
    controller,
    signal: controller.signal,
  };

  handles.set(imageId, handle);
  return handle;
}

/**
 * Returns true if the given requestId is the latest for its imageId.
 * Used to drop stale responses (e.g., if user re-generated while previous was in-flight).
 */
export function isLatest(imageId: string, requestId: number): boolean {
  const latest = latestRequestId.get(imageId);
  if (latest === undefined) {
    return false;
  }
  return latest === requestId;
}

/**
 * Abort the current in-flight generation for imageId, if any.
 * Idempotent — safe to call when no generation is active.
 */
export function abortGeneration(imageId: string): void {
  const handle = handles.get(imageId);
  if (handle) {
    handle.controller.abort();
  }
}

/**
 * Abort ALL in-flight generations.
 * Used on component unmount or full cancel.
 */
export function abortAllGenerations(): void {
  for (const handle of handles.values()) {
    handle.controller.abort();
  }
}

/**
 * Clear bookkeeping for an imageId. Called after generation settles
 * (success or final error). Does not abort.
 */
export function clearGeneration(imageId: string): void {
  handles.delete(imageId);
}

/**
 * Test-only utility. Resets internal state. NOT exported in production code paths.
 * Marked with __test_ prefix.
 */
export function __test_resetRegistry(): void {
  handles.clear();
  latestRequestId.clear();
}
