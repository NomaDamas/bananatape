import { create } from 'zustand';
import { temporal } from 'zundo';
import { devtools } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type { EditorState, BoundingBox, TextMemo, Tool, Provider, Mode, NormalizedPoint, ImageSize, StreamChunk } from './types';

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
  updateMemo: (id: string, text: string) => void;
  deleteMemo: (id: string) => void;
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
  zoomIn: () => void;
  zoomOut: () => void;
  resetViewport: () => void;
  setIsSpacePressed: (v: boolean) => void;
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
  provider: 'openai',
  mode: 'generate',
  isGenerating: false,
  streamProgress: null,
  zoom: 1,
  panX: 0,
  panY: 0,
  isSpacePressed: false,
};

export const useEditorStore = create<EditorState & EditorActions>()(
  temporal(
    devtools((set) => ({
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
      updateMemo: (id, text) => set((state) => ({
        memos: state.memos.map((m) => (m.id === id ? { ...m, text } : m)),
      })),
      deleteMemo: (id) => set((state) => ({
        memos: state.memos.filter((m) => m.id !== id),
      })),
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
      setZoom: (zoom) => set({ zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)) }),
      setPan: (panX, panY) => set({ panX, panY }),
      zoomIn: () => set((state) => ({
        zoom: Math.min(MAX_ZOOM, state.zoom * ZOOM_STEP),
      })),
      zoomOut: () => set((state) => ({
        zoom: Math.max(MIN_ZOOM, state.zoom / ZOOM_STEP),
      })),
      resetViewport: () => set({ zoom: 1, panX: 0, panY: 0 }),
      setIsSpacePressed: (v) => set({ isSpacePressed: v }),
    })),
    {
      partialize: (state) => ({
        paths: state.paths,
        boxes: state.boxes,
        memos: state.memos,
        baseImage: state.baseImage,
        imageSize: state.imageSize,
      }),
    },
  ),
);
