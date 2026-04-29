import { create } from 'zustand';
import { temporal } from 'zundo';
import { devtools } from 'zustand/middleware';
import type { CanvasImage, GenerationStatus } from '@/types/canvas';
import type { DrawingPath, BoundingBox, TextMemo } from '@/types';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 1.2;

export interface CanvasState {
  // Image storage
  images: Record<string, CanvasImage>;
  imageOrder: string[];
  // Focus model
  focusedImageIds: string[];
  // Viewport
  viewport: { panX: number; panY: number; zoom: number; width: number; height: number };
}

export interface CanvasActions {
  // Image CRUD
  addImage(image: CanvasImage): void;
  addImages(images: CanvasImage[]): void;
  updateImage(id: string, patch: Partial<Omit<CanvasImage, 'id'>>): void;
  deleteImage(id: string): void;
  deleteImages(ids: string[]): void;

  // Focus
  setFocusedImages(ids: string[], additive?: boolean): void;
  setFocusedImage(id: string | null): void;

  // Per-image annotations
  addPathToImage(imageId: string, path: DrawingPath): void;
  updatePathOnImage(imageId: string, pathId: string, patch: Partial<DrawingPath>): void;
  removePathFromImage(imageId: string, pathId: string): void;

  addBoxToImage(imageId: string, box: BoundingBox): void;
  updateBoxOnImage(imageId: string, boxId: string, patch: Partial<BoundingBox>): void;
  removeBoxFromImage(imageId: string, boxId: string): void;

  addMemoToImage(imageId: string, memo: TextMemo): void;
  updateMemoOnImage(imageId: string, memoId: string, patch: Partial<TextMemo>): void;
  removeMemoFromImage(imageId: string, memoId: string): void;

  clearAnnotationsOnImage(imageId: string): void;

  // Status updates (for parallel generation lifecycle)
  setImageStatus(id: string, status: GenerationStatus, error?: string): void;

  // Viewport
  setViewport(viewport: Partial<CanvasState['viewport']>): void;
  zoomIn(): void;
  zoomOut(): void;
  resetViewport(): void;

  // Reset / hydration
  hydrate(images: Record<string, CanvasImage>, imageOrder: string[], focusedImageIds?: string[]): void;
  resetCanvas(): void;
}

export type CanvasStore = CanvasState & CanvasActions;

const initialState: CanvasState = {
  images: {},
  imageOrder: [],
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

function withTemporalPaused(fn: () => void): void {
  const temporalState = useCanvasStore.temporal.getState();
  temporalState.pause();
  try {
    fn();
  } finally {
    temporalState.resume();
  }
}

export const useCanvasStore = create<CanvasStore>()(
  temporal(
    devtools((set) => ({
      ...initialState,
      addImage: (image) => set((state) => ({
        images: { ...state.images, [image.id]: image },
        imageOrder: [...state.imageOrder, image.id],
        focusedImageIds: state.focusedImageIds.length === 0 && image.status === 'ready' ? [image.id] : state.focusedImageIds,
      })),
      addImages: (images) => set((state) => {
        const nextImages = { ...state.images };
        const nextImageOrder = [...state.imageOrder];
        for (const image of images) {
          nextImages[image.id] = image;
          nextImageOrder.push(image.id);
        }
        const firstReadyImage = images.find((image) => image.status === 'ready');
        return {
          images: nextImages,
          imageOrder: nextImageOrder,
          focusedImageIds: state.focusedImageIds.length === 0 && firstReadyImage ? [firstReadyImage.id] : state.focusedImageIds,
        };
      }),
      updateImage: (id, patch) => set((state) => {
        const image = state.images[id];
        if (!image) return {};
        return { images: { ...state.images, [id]: { ...image, ...patch } } };
      }),
      deleteImage: (id) => set((state) => {
        if (!state.images[id]) return {};
        const { [id]: _deleted, ...images } = state.images;
        const idsToRemove = new Set([id]);
        return {
          images,
          imageOrder: withoutIds(state.imageOrder, idsToRemove),
          focusedImageIds: withoutIds(state.focusedImageIds, idsToRemove),
        };
      }),
      deleteImages: (ids) => set((state) => {
        const idsToRemove = new Set(ids);
        const images = { ...state.images };
        let didDelete = false;
        for (const id of idsToRemove) {
          if (images[id]) {
            delete images[id];
            didDelete = true;
          }
        }
        if (!didDelete) return {};
        return {
          images,
          imageOrder: withoutIds(state.imageOrder, idsToRemove),
          focusedImageIds: withoutIds(state.focusedImageIds, idsToRemove),
        };
      }),
      setFocusedImages: (ids, additive = false) => set((state) => ({
        focusedImageIds: additive ? uniqueIds([...state.focusedImageIds, ...ids]) : uniqueIds(ids),
      })),
      setFocusedImage: (id) => set({ focusedImageIds: id === null ? [] : [id] }),
      addPathToImage: (imageId, path) => set((state) => {
        const image = state.images[imageId];
        if (!image) return {};
        return { images: { ...state.images, [imageId]: { ...image, paths: [...image.paths, path] } } };
      }),
      updatePathOnImage: (imageId, pathId, patch) => set((state) => {
        const image = state.images[imageId];
        if (!image) return {};
        return {
          images: {
            ...state.images,
            [imageId]: { ...image, paths: image.paths.map((path) => (path.id === pathId ? { ...path, ...patch } : path)) },
          },
        };
      }),
      removePathFromImage: (imageId, pathId) => set((state) => {
        const image = state.images[imageId];
        if (!image) return {};
        return { images: { ...state.images, [imageId]: { ...image, paths: image.paths.filter((path) => path.id !== pathId) } } };
      }),
      addBoxToImage: (imageId, box) => set((state) => {
        const image = state.images[imageId];
        if (!image) return {};
        return { images: { ...state.images, [imageId]: { ...image, boxes: [...image.boxes, box] } } };
      }),
      updateBoxOnImage: (imageId, boxId, patch) => set((state) => {
        const image = state.images[imageId];
        if (!image) return {};
        return {
          images: {
            ...state.images,
            [imageId]: { ...image, boxes: image.boxes.map((box) => (box.id === boxId ? { ...box, ...patch } : box)) },
          },
        };
      }),
      removeBoxFromImage: (imageId, boxId) => set((state) => {
        const image = state.images[imageId];
        if (!image) return {};
        return { images: { ...state.images, [imageId]: { ...image, boxes: image.boxes.filter((box) => box.id !== boxId) } } };
      }),
      addMemoToImage: (imageId, memo) => set((state) => {
        const image = state.images[imageId];
        if (!image) return {};
        return { images: { ...state.images, [imageId]: { ...image, memos: [...image.memos, memo] } } };
      }),
      updateMemoOnImage: (imageId, memoId, patch) => set((state) => {
        const image = state.images[imageId];
        if (!image) return {};
        return {
          images: {
            ...state.images,
            [imageId]: { ...image, memos: image.memos.map((memo) => (memo.id === memoId ? { ...memo, ...patch } : memo)) },
          },
        };
      }),
      removeMemoFromImage: (imageId, memoId) => set((state) => {
        const image = state.images[imageId];
        if (!image) return {};
        return { images: { ...state.images, [imageId]: { ...image, memos: image.memos.filter((memo) => memo.id !== memoId) } } };
      }),
      clearAnnotationsOnImage: (imageId) => set((state) => {
        const image = state.images[imageId];
        if (!image) return {};
        return { images: { ...state.images, [imageId]: { ...image, paths: [], boxes: [], memos: [] } } };
      }),
      setImageStatus: (id, status, error) => withTemporalPaused(() => set((state) => {
        const image = state.images[id];
        if (!image) return {};
        return { images: { ...state.images, [id]: { ...image, status, error } } };
      })),
      setViewport: (viewport) => set((state) => ({
        viewport: { ...state.viewport, ...viewport, zoom: viewport.zoom === undefined ? state.viewport.zoom : clampZoom(viewport.zoom) },
      })),
      zoomIn: () => set((state) => ({ viewport: { ...state.viewport, zoom: clampZoom(state.viewport.zoom * ZOOM_STEP) } })),
      zoomOut: () => set((state) => ({ viewport: { ...state.viewport, zoom: clampZoom(state.viewport.zoom / ZOOM_STEP) } })),
      resetViewport: () => set((state) => ({ viewport: { ...state.viewport, panX: 0, panY: 0, zoom: 1 } })),
      hydrate: (images, imageOrder, focusedImageIds = []) => set({
        images,
        imageOrder,
        focusedImageIds: uniqueIds(focusedImageIds),
      }),
      resetCanvas: () => {
        set(initialState);
        useCanvasStore.temporal.getState().clear();
      },
    })),
    {
      partialize: (state) => ({
        images: state.images,
        imageOrder: state.imageOrder,
      }),
      equality: (pastState, currentState) => (
        pastState.images === currentState.images && pastState.imageOrder === currentState.imageOrder
      ),
      limit: 100,
    },
  ),
);
