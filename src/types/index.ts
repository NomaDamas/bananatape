export type Tool = 'pan' | 'pen' | 'box' | 'arrow' | 'memo';
export type Provider = 'openai' | 'god-tibo';
export type Mode = 'generate' | 'edit';
export type AnnotationStatus = 'pending' | 'review' | 'accepted';

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface ImageSize {
  width: number;
  height: number;
}

export interface DrawingPath {
  id: string;
  tool: Tool;
  points: NormalizedPoint[];
  color: string;
  strokeWidth: number;
}

export interface BoundingBox {
  id: string;
  tool: Tool;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  status: AnnotationStatus;
}

export interface TextMemo {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
}

export interface StreamChunk {
  type: 'progress' | 'log' | 'image' | 'error';
  data: unknown;
}

export interface GenerateOptions {
  prompt: string;
  size?: '1024x1024' | '1024x1536' | '1536x1024';
  quality?: 'low' | 'medium' | 'high' | 'auto';
}

export interface EditOptions {
  images: Blob[];
  maskImage: Blob;
  prompt: string;
}

export * from './canvas';
