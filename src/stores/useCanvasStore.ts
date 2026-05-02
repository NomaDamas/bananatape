import { create } from 'zustand';
import { temporal } from 'zundo';
import { devtools } from 'zustand/middleware';
import type { CanvasImage, GenerationStatus } from '@/types/canvas';
import type { DrawingPath, BoundingBox, TextMemo } from '@/types';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 1.2;
const HISTORY_LIMIT = 100;

export interface ImageHistory {
  past: CanvasImage[];
  future: CanvasImage[];
}

export interface CanvasState {
  images: Record<string, CanvasImage>;
  imageOrder: string[];
  imageHistories: Record<string, ImageHistory>;
  focusedImageIds: string[];
  viewport: { panX: number; panY: number; zoom: number; width: number; height: number };
}

export interface CanvasActions {
  addImage(image: CanvasImage): void;
  addImages(images: CanvasImage[]): void;
  updateImage(id: string, patch: Partial<Omit<CanvasImage, 'id'>>, options?: { track?: boolean }): void;
  deleteImage(id: string): void;
  deleteImages(ids: string[]): void;

  setFocusedImages(ids: string[], additive?: boolean): void;
  setFocusedImage(id: string | null): void;

  addPathToImage(imageId: string, path: DrawingPath): void;
  updatePathOnImage(imageId: string, pathId: string, patch: Partial<DrawingPath>): void;
  removePathFromImage(imageId: string, pathId: string): void;

  addBoxToImage(imageId: string, box: BoundingBox): void;
  updateBoxOnImage(imageId: string, boxId: string, patch: Partial<BoundingBox>): void;
  removeBoxFromImage(imageId: string, boxId: string): void;

  addMemoToImage(imageId: string, memo: TextMemo): void;
  updateMemoOnImage(imageId: string, memoId: string, patch: Partial<TextMemo>, options?: { track?: boolean }): void;
  commitMemoTextOnImage(imageId: string, memoId: string, text: string, options?: { historySnapshot?: CanvasImage }): void;
  removeMemoFromImage(imageId: string, memoId: string, options?: { track?: boolean; historySnapshot?: CanvasImage }): void;

  clearAnnotationsOnImage(imageId: string): void;

  undoImage(imageId: string): void;
  redoImage(imageId: string): void;
  undoFocusedImage(): void;
  redoFocusedImage(): void;
  canUndoImage(imageId: string): boolean;
  canRedoImage(imageId: string): boolean;

  setImageStatus(id: string, status: GenerationStatus, error?: string): void;

  setViewport(viewport: Partial<CanvasState['viewport']>): void;
  zoomIn(): void;
  zoomOut(): void;
  resetViewport(): void;

  hydrate(images: Record<string, CanvasImage>, imageOrder: string[], focusedImageIds?: string[]): void;
  resetCanvas(): void;
}

export type CanvasStore = CanvasState & CanvasActions;

type UndoableCanvasState = Pick<CanvasState, 'images' | 'imageOrder' | 'imageHistories'>;

const initialState: CanvasState = {
  images: {},
  imageOrder: [],
  imageHistories: {},
  focusedImageIds: [],
  viewport: { panX: 0, panY: 0, zoom: 1, width: 0, height: 0 },
};

function clampZoom(zoom: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

function withoutIds(ids: string[], idsToRemove: Set<string>): string[] {
  return ids.filter((id) => !idsToRemove.has(id));
}

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

function emptyHistory(): ImageHistory {
  return { past: [], future: [] };
}

function ensureHistories(images: Record<string, CanvasImage>, histories: Record<string, ImageHistory> = {}): Record<string, ImageHistory> {
  const next: Record<string, ImageHistory> = {};
  Object.keys(images).forEach((id) => {
    next[id] = histories[id] ?? emptyHistory();
  });
  return next;
}

function pushImageHistory(histories: Record<string, ImageHistory>, imageId: string, snapshot: CanvasImage): Record<string, ImageHistory> {
  const current = histories[imageId] ?? emptyHistory();
  return {
    ...histories,
    [imageId]: {
      past: [...current.past, snapshot].slice(-HISTORY_LIMIT),
      future: [],
    },
  };
}

function withTemporalPaused(fn: () => void): void {
  const temporalState = useCanvasStore.temporal.getState();
  const wasTracking = temporalState.isTracking;
  if (wasTracking) temporalState.pause();
  try {
    fn();
  } finally {
    if (wasTracking) temporalState.resume();
  }
}

function mutateImage(
  set: (partial: CanvasStore | Partial<CanvasStore> | ((state: CanvasStore) => CanvasStore | Partial<CanvasStore>), replace?: false) => void,
  imageId: string,
  updater: (image: CanvasImage) => CanvasImage,
  options: { track?: boolean; historySnapshot?: CanvasImage } = {},
): void {
  const update = () => set((state) => {
    const image = state.images[imageId];
    if (!image) return {};
    const nextImage = updater(image);
    if (nextImage === image) return {};
    const track = options.track !== false;
    return {
      images: { ...state.images, [imageId]: nextImage },
      imageHistories: track ? pushImageHistory(state.imageHistories, imageId, options.historySnapshot ?? image) : state.imageHistories,
    };
  });

  withTemporalPaused(update);
}

export const useCanvasStore = create<CanvasStore>()(
  temporal(
    devtools((set, get) => ({
      ...initialState,
      addImage: (image) => set((state) => ({
        images: { ...state.images, [image.id]: image },
        imageOrder: [...state.imageOrder, image.id],
        imageHistories: { ...state.imageHistories, [image.id]: state.imageHistories[image.id] ?? emptyHistory() },
        focusedImageIds: state.focusedImageIds.length === 0 && image.status === 'ready' ? [image.id] : state.focusedImageIds,
      })),
      addImages: (images) => set((state) => {
        const nextImages = { ...state.images };
        const nextImageOrder = [...state.imageOrder];
        const nextHistories = { ...state.imageHistories };
        for (const image of images) {
          nextImages[image.id] = image;
          nextImageOrder.push(image.id);
          nextHistories[image.id] = nextHistories[image.id] ?? emptyHistory();
        }
        const firstReadyImage = images.find((image) => image.status === 'ready');
        return {
          images: nextImages,
          imageOrder: nextImageOrder,
          imageHistories: nextHistories,
          focusedImageIds: state.focusedImageIds.length === 0 && firstReadyImage ? [firstReadyImage.id] : state.focusedImageIds,
        };
      }),
      updateImage: (id, patch, options) => mutateImage(set, id, (image) => ({ ...image, ...patch }), options),
      deleteImage: (id) => set((state) => {
        if (!state.images[id]) return {};
        const images = { ...state.images };
        const imageHistories = { ...state.imageHistories };
        delete images[id];
        delete imageHistories[id];
        const idsToRemove = new Set([id]);
        return {
          images,
          imageHistories,
          imageOrder: withoutIds(state.imageOrder, idsToRemove),
          focusedImageIds: withoutIds(state.focusedImageIds, idsToRemove),
        };
      }),
      deleteImages: (ids) => set((state) => {
        const idsToRemove = new Set(ids);
        const images = { ...state.images };
        const imageHistories = { ...state.imageHistories };
        let didDelete = false;
        for (const id of idsToRemove) {
          if (images[id]) {
            delete images[id];
            delete imageHistories[id];
            didDelete = true;
          }
        }
        if (!didDelete) return {};
        return {
          images,
          imageHistories,
          imageOrder: withoutIds(state.imageOrder, idsToRemove),
          focusedImageIds: withoutIds(state.focusedImageIds, idsToRemove),
        };
      }),
      setFocusedImages: (ids, additive = false) => withTemporalPaused(() => set((state) => ({
        focusedImageIds: additive ? uniqueIds([...state.focusedImageIds, ...ids]) : uniqueIds(ids),
      }))),
      setFocusedImage: (id) => withTemporalPaused(() => set({ focusedImageIds: id === null ? [] : [id] })),
      addPathToImage: (imageId, path) => mutateImage(set, imageId, (image) => ({ ...image, paths: [...image.paths, path] })),
      updatePathOnImage: (imageId, pathId, patch) => mutateImage(set, imageId, (image) => ({
        ...image,
        paths: image.paths.map((path) => (path.id === pathId ? { ...path, ...patch } : path)),
      })),
      removePathFromImage: (imageId, pathId) => mutateImage(set, imageId, (image) => ({
        ...image,
        paths: image.paths.filter((path) => path.id !== pathId),
      })),
      addBoxToImage: (imageId, box) => mutateImage(set, imageId, (image) => ({ ...image, boxes: [...image.boxes, box] })),
      updateBoxOnImage: (imageId, boxId, patch) => mutateImage(set, imageId, (image) => ({
        ...image,
        boxes: image.boxes.map((box) => (box.id === boxId ? { ...box, ...patch } : box)),
      })),
      removeBoxFromImage: (imageId, boxId) => mutateImage(set, imageId, (image) => ({
        ...image,
        boxes: image.boxes.filter((box) => box.id !== boxId),
      })),
      addMemoToImage: (imageId, memo) => mutateImage(set, imageId, (image) => ({ ...image, memos: [...image.memos, memo] })),
      updateMemoOnImage: (imageId, memoId, patch, options) => mutateImage(set, imageId, (image) => ({
        ...image,
        memos: image.memos.map((memo) => (memo.id === memoId ? { ...memo, ...patch } : memo)),
      }), options),
      commitMemoTextOnImage: (imageId, memoId, text, options) => mutateImage(set, imageId, (image) => ({
        ...image,
        memos: image.memos.map((memo) => (memo.id === memoId ? { ...memo, text } : memo)),
      }), { historySnapshot: options?.historySnapshot }),
      removeMemoFromImage: (imageId, memoId, options) => mutateImage(set, imageId, (image) => ({
        ...image,
        memos: image.memos.filter((memo) => memo.id !== memoId),
      }), options),
      clearAnnotationsOnImage: (imageId) => mutateImage(set, imageId, (image) => ({ ...image, paths: [], boxes: [], memos: [] })),
      undoImage: (imageId) => withTemporalPaused(() => set((state) => {
        const image = state.images[imageId];
        const history = state.imageHistories[imageId];
        if (!image || !history || history.past.length === 0) return {};
        const previous = history.past[history.past.length - 1];
        return {
          images: { ...state.images, [imageId]: previous },
          imageHistories: {
            ...state.imageHistories,
            [imageId]: {
              past: history.past.slice(0, -1),
              future: [image, ...history.future].slice(0, HISTORY_LIMIT),
            },
          },
        };
      })),
      redoImage: (imageId) => withTemporalPaused(() => set((state) => {
        const image = state.images[imageId];
        const history = state.imageHistories[imageId];
        if (!image || !history || history.future.length === 0) return {};
        const next = history.future[0];
        return {
          images: { ...state.images, [imageId]: next },
          imageHistories: {
            ...state.imageHistories,
            [imageId]: {
              past: [...history.past, image].slice(-HISTORY_LIMIT),
              future: history.future.slice(1),
            },
          },
        };
      })),
      undoFocusedImage: () => {
        const state = get();
        if (state.focusedImageIds.length !== 1) return;
        state.undoImage(state.focusedImageIds[0]);
      },
      redoFocusedImage: () => {
        const state = get();
        if (state.focusedImageIds.length !== 1) return;
        state.redoImage(state.focusedImageIds[0]);
      },
      canUndoImage: (imageId) => (get().imageHistories[imageId]?.past.length ?? 0) > 0,
      canRedoImage: (imageId) => (get().imageHistories[imageId]?.future.length ?? 0) > 0,
      setImageStatus: (id, status, error) => mutateImage(set, id, (image) => ({ ...image, status, error }), { track: false }),
      setViewport: (viewport) => withTemporalPaused(() => set((state) => ({
        viewport: { ...state.viewport, ...viewport, zoom: viewport.zoom === undefined ? state.viewport.zoom : clampZoom(viewport.zoom) },
      }))),
      zoomIn: () => withTemporalPaused(() => set((state) => ({ viewport: { ...state.viewport, zoom: clampZoom(state.viewport.zoom * ZOOM_STEP) } }))),
      zoomOut: () => withTemporalPaused(() => set((state) => ({ viewport: { ...state.viewport, zoom: clampZoom(state.viewport.zoom / ZOOM_STEP) } }))),
      resetViewport: () => withTemporalPaused(() => set((state) => ({ viewport: { ...state.viewport, panX: 0, panY: 0, zoom: 1 } }))),
      hydrate: (images, imageOrder, focusedImageIds = []) => set((state) => ({
        images,
        imageOrder,
        imageHistories: ensureHistories(images, state.imageHistories),
        focusedImageIds: uniqueIds(focusedImageIds),
      })),
      resetCanvas: () => {
        set(initialState);
        useCanvasStore.temporal.getState().clear();
      },
    })),
    {
      partialize: (state): UndoableCanvasState => ({
        images: state.images,
        imageOrder: state.imageOrder,
        imageHistories: state.imageHistories,
      }),
      equality: (pastState, currentState) => (
        pastState.images === currentState.images
        && pastState.imageOrder === currentState.imageOrder
        && pastState.imageHistories === currentState.imageHistories
      ),
      limit: HISTORY_LIMIT,
    },
  ),
);
