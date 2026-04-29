import type { Provider } from './index';
import type { DrawingPath, BoundingBox, TextMemo } from './index';

export type GenerationStatus = 'pending' | 'streaming' | 'ready' | 'error';

export interface CanvasImage {
  id: string;
  url: string;
  assetId?: string;
  size: { width: number; height: number };
  position: { x: number; y: number };
  parentId: string | null;
  generationIndex: number;
  prompt: string;
  provider: Provider;
  type: 'generate' | 'edit';
  createdAt: number;
  paths: DrawingPath[];
  boxes: BoundingBox[];
  memos: TextMemo[];
  status: GenerationStatus;
  error?: string;
}

export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
  width: number;
  height: number;
}

export interface PlaceholderLayout {
  width: number;
  height: number;
}

export const DEFAULT_PLACEHOLDER_LAYOUT: PlaceholderLayout = { width: 512, height: 512 };
export const SIBLING_HORIZONTAL_GAP = 32;
export const PARENT_CHILD_VERTICAL_GAP = 64;
export const CHILD_VERTICAL_STACK_GAP = 24;
