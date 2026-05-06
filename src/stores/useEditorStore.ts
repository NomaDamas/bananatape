import { create } from 'zustand';
import { temporal, type TemporalState } from 'zundo';
import { devtools } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand';
import type { EditorState, BoundingBox, TextMemo, Tool, Provider, Mode, NormalizedPoint, ImageSize, StreamChunk } from './types';
import type { OutputSize } from '../lib/generation/output-size';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 1.2;

interface EditorActions {
  setBaseImage: (url: string | null, size: ImageSize) => void;
  startPath: (point: NormalizedPoint, tool: Tool) => void;
  addPathPoint: (point: NormalizedPoint) => void;
  commitPath: () => void;
  addBox: (box: Omit<BoundingBox, 'id'>) => void;
  addMemo: (memo: Omit<TextMemo, 'id'>) => string;
  updateMemo: (id: string, text: string, options?: { track?: boolean }) => void;
  commitMemoText: (id: string, text: string, options?: { historySnapshot?: Pick<EditorState, 'memos'> }) => void;
  deleteMemo: (id: string, options?: { track?: boolean; historySnapshot?: Pick<EditorState, 'memos'> }) => void;
  setActiveTool: (tool: Tool) => void;
  setProvider: (provider: Provider) => void;
  setMode: (mode: Mode) => void;
  setIsGenerating: (v: boolean) => void;
  setStreamProgress: (progress: StreamChunk | null) => void;
  clearAnnotations: () => void;
  deleteBox: (id: string) => void;
  deletePath: (id: string) => void;
  setActiveMemoId: (id: string | null) => void;
  setToolColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setZoom: (zoom: number) => void;
  setPan: (panX: number, panY: number) => void;
  setViewport: (viewport: { zoom?: number; panX?: number; panY?: number }) => void;
  undo: () => void;
  redo: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetViewport: () => void;
  setIsSpacePressed: (v: boolean) => void;
  setParallelCount: (count: number) => void;
  incrementParallelCount: () => void;
  decrementParallelCount: () => void;
  setOutputSize: (size: OutputSize) => void;
}

type UndoableEditorState = Pick<EditorState, 'paths' | 'boxes' | 'memos' | 'baseImage' | 'imageSize'>;

type EditorStore = EditorState & EditorActions;

type EditorStoreWithTemporal = StoreApi<EditorStore> & {
  temporal: StoreApi<TemporalState<UndoableEditorState>>;
};

const getTemporalStore = () => (useEditorStore as unknown as EditorStoreWithTemporal).temporal;
const getTemporalState = () => getTemporalStore().getState();

function getUndoableSnapshot(state: EditorStore, overrides: Partial<UndoableEditorState> = {}): UndoableEditorState {
  return {
    paths: state.paths,
    boxes: state.boxes,
    memos: state.memos,
    baseImage: state.baseImage,
    imageSize: state.imageSize,
    ...overrides,
  };
}

function areUndoableStatesEqual(a: UndoableEditorState, b: UndoableEditorState) {
  return a.paths === b.paths
    && a.boxes === b.boxes
    && a.memos === b.memos
    && a.baseImage === b.baseImage
    && a.imageSize === b.imageSize;
}

function pushManualHistorySnapshot(snapshot: Partial<UndoableEditorState>) {
  const current = getUndoableSnapshot(useEditorStore.getState());
  const pastState = getUndoableSnapshot(useEditorStore.getState(), snapshot);
  if (areUndoableStatesEqual(pastState, current)) return;

  getTemporalStore().setState((state) => ({
    pastStates: [...state.pastStates, pastState],
    futureStates: [],
  }));
}

function withPausedHistory(update: () => void) {
  const temporalState = getTemporalState();
  const wasTracking = temporalState.isTracking;
  if (wasTracking) temporalState.pause();
  update();
  if (wasTracking) temporalState.resume();
}

export function useEditorTemporalStore<T>(selector: (state: TemporalState<UndoableEditorState>) => T): T {
  return useStore(getTemporalStore(), selector);
}

const initialState: EditorState = {
  baseImage: null,
  imageSize: { width: 0, height: 0 },
  paths: [],
  boxes: [],
  memos: [],
  activeTool: 'pan',
  activePath: null,
  activeMemoId: null,
  toolColor: '#ef4444',
  strokeWidth: 3,
  provider: 'god-tibo',
  mode: 'generate',
  isGenerating: false,
  streamProgress: null,
  zoom: 1,
  panX: 0,
  panY: 0,
  isSpacePressed: false,
  parallelCount: 1,
  outputSize: 'auto',
};

function clampParallelCount(count: number): number {
  if (!Number.isFinite(count)) return 1;
  return Math.max(1, Math.round(count));
}

export const useEditorStore = create<EditorStore>()(
  temporal<EditorStore, [], [['zustand/devtools', never]], UndoableEditorState>(
    devtools<EditorStore>((set) => ({
      ...initialState,
      setBaseImage: (url, size) => set({ baseImage: url, imageSize: size }),
      startPath: (point, tool) => set((state) => ({
        activePath: {
          id: nanoid(),
          tool,
          points: [point],
          color: state.toolColor,
          strokeWidth: state.strokeWidth,
        },
      })),
      addPathPoint: (point) => set((state) => ({
        activePath: state.activePath
          ? { ...state.activePath, points: [...state.activePath.points, point] }
          : null,
      })),
      commitPath: () => set((state) => {
        if (!state.activePath) return {};
        return { paths: [...state.paths, state.activePath], activePath: null };
      }),
      addBox: (box) => set((state) => ({
        boxes: [...state.boxes, { ...box, id: nanoid() }],
      })),
      addMemo: (memo) => {
        const id = nanoid();
        set((state) => ({
          memos: [...state.memos, { ...memo, id }],
        }));
        return id;
      },
      updateMemo: (id, text, options) => {
        const update = () => set((state) => ({
          memos: state.memos.map((m) => (m.id === id ? { ...m, text } : m)),
        }));
        if (options?.track === false) {
          withPausedHistory(update);
          return;
        }
        update();
      },
      commitMemoText: (id, text, options) => {
        const update = () => set((state) => ({
          memos: state.memos.map((m) => (m.id === id ? { ...m, text } : m)),
        }));
        if (options?.historySnapshot) {
          withPausedHistory(update);
          pushManualHistorySnapshot(options.historySnapshot);
          return;
        }
        update();
      },
      deleteMemo: (id, options) => {
        const update = () => set((state) => ({
          memos: state.memos.filter((m) => m.id !== id),
        }));
        if (options?.track === false) {
          withPausedHistory(update);
          return;
        }
        if (options?.historySnapshot) {
          withPausedHistory(update);
          pushManualHistorySnapshot(options.historySnapshot);
          return;
        }
        update();
      },
      setActiveTool: (tool) => set({ activeTool: tool }),
      setProvider: (provider) => set({ provider }),
      setMode: (mode) => set({ mode }),
      setIsGenerating: (v) => set({ isGenerating: v }),
      setStreamProgress: (progress) => set({ streamProgress: progress }),
      clearAnnotations: () => set({ paths: [], boxes: [], memos: [] }),
      deleteBox: (id) => set((state) => ({ boxes: state.boxes.filter((b) => b.id !== id) })),
      deletePath: (id) => set((state) => ({ paths: state.paths.filter((p) => p.id !== id) })),
      setActiveMemoId: (id) => set({ activeMemoId: id }),
      setToolColor: (color) => set({ toolColor: color }),
      setStrokeWidth: (width) => set({ strokeWidth: width }),
      setZoom: (zoom) => withPausedHistory(() => set({ zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)) })),
      setPan: (panX, panY) => withPausedHistory(() => set({ panX, panY })),
      setViewport: ({ zoom, panX, panY }) => withPausedHistory(() => set((state) => ({
        zoom: zoom === undefined ? state.zoom : Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)),
        panX: panX === undefined ? state.panX : panX,
        panY: panY === undefined ? state.panY : panY,
      }))),
      zoomIn: () => withPausedHistory(() => set((state) => ({
        zoom: Math.min(MAX_ZOOM, state.zoom * ZOOM_STEP),
      }))),
      zoomOut: () => withPausedHistory(() => set((state) => ({
        zoom: Math.max(MIN_ZOOM, state.zoom / ZOOM_STEP),
      }))),
      resetViewport: () => withPausedHistory(() => set({ zoom: 1, panX: 0, panY: 0 })),
      undo: () => getTemporalState().undo(),
      redo: () => getTemporalState().redo(),
      setIsSpacePressed: (v: boolean) => set({ isSpacePressed: v }),
      setParallelCount: (count) => set({ parallelCount: clampParallelCount(count) }),
      incrementParallelCount: () => set((state) => ({ parallelCount: clampParallelCount(state.parallelCount + 1) })),
      decrementParallelCount: () => set((state) => ({ parallelCount: clampParallelCount(state.parallelCount - 1) })),
      setOutputSize: (size) => set({ outputSize: size }),
    })),
    {
      partialize: (state): UndoableEditorState => getUndoableSnapshot(state),
      equality: areUndoableStatesEqual,
    },
  ),
);
