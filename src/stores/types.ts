import type {
  DrawingPath,
  BoundingBox,
  TextMemo,
  Tool,
  Provider,
  Mode,
  StreamChunk,
  ImageSize,
  NormalizedPoint,
} from '../types';
import type { OutputSize } from '../lib/generation/output-size';

export type {
  DrawingPath,
  BoundingBox,
  TextMemo,
  Tool,
  Provider,
  Mode,
  StreamChunk,
  ImageSize,
  NormalizedPoint,
};

export interface EditorState {
  baseImage: string | null;
  imageSize: ImageSize;
  paths: DrawingPath[];
  boxes: BoundingBox[];
  memos: TextMemo[];
  activeTool: Tool;
  activePath: DrawingPath | null;
  activeMemoId: string | null;
  toolColor: string;
  strokeWidth: number;
  provider: Provider;
  mode: Mode;
  isGenerating: boolean;
  streamProgress: StreamChunk | null;
  zoom: number;
  panX: number;
  panY: number;
  isSpacePressed: boolean;
  parallelCount: number;
  outputSize: OutputSize;
}

export interface HistoryEntry {
  id: string;
  imageDataUrl?: string;
  assetId?: string;
  assetUrl?: string;
  prompt: string;
  provider: Provider;
  type: 'generate' | 'edit';
  timestamp: number;
  parentId?: string | null;
  imageId?: string | null;
}
