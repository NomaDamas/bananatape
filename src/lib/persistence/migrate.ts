import { nanoid } from 'nanoid';
import type { ProjectSettings } from '@/lib/projects/schema';
import { createEmptyProjectSettings } from '@/lib/projects/schema';
import type { CanvasImage } from '@/types/canvas';
import type { HistoryEntry } from '@/stores/types';

export interface LegacyProjectFile {
  settings?: ProjectSettings;
  baseImage?: string | null;
  imageSize?: { width: number; height: number };
  paths?: CanvasImage['paths'];
  boxes?: CanvasImage['boxes'];
  memos?: CanvasImage['memos'];
  schemaVersion?: 0 | undefined;
}

export interface CanvasState {
  images: Record<string, CanvasImage>;
  imageOrder: string[];
  focusedImageId: string | null;
  selectedImageIds: string[];
}

export interface ProjectFileV1 {
  schemaVersion: 1;
  settings: ProjectSettings;
  canvas: CanvasState;
}

export interface LegacyHistoryEntry extends HistoryEntry {
  imageId?: string;
}

export interface HistoryEntryV1 extends HistoryEntry {
  imageId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isProjectFileV1(value: unknown): value is ProjectFileV1 {
  if (!isRecord(value)) return false;
  return (
    value['schemaVersion'] === 1 &&
    isRecord(value['canvas']) &&
    isRecord((value['canvas'] as Record<string, unknown>)['images'])
  );
}

function isLegacyProjectFile(value: unknown): value is LegacyProjectFile {
  if (!isRecord(value)) return false;
  const sv = value['schemaVersion'];
  return sv === undefined || sv === 0;
}

function extractSettings(value: Record<string, unknown>): ProjectSettings {
  const raw = value['settings'];
  if (isRecord(raw)) {
    return {
      ...createEmptyProjectSettings(),
      ...(raw as Partial<ProjectSettings>),
      referenceImages: Array.isArray(raw['referenceImages'])
        ? (raw['referenceImages'] as ProjectSettings['referenceImages'])
        : [],
    };
  }
  return createEmptyProjectSettings();
}

function emptyCanvas(): CanvasState {
  return {
    images: {},
    imageOrder: [],
    focusedImageId: null,
    selectedImageIds: [],
  };
}

export function migrateProjectV0ToV1(input: unknown): ProjectFileV1 {
  if (isProjectFileV1(input)) {
    return {
      schemaVersion: 1,
      settings: {
        ...createEmptyProjectSettings(),
        ...input.settings,
        referenceImages: Array.isArray(input.settings?.referenceImages)
          ? [...input.settings.referenceImages]
          : [],
      },
      canvas: {
        images: { ...input.canvas.images },
        imageOrder: [...input.canvas.imageOrder],
        focusedImageId: input.canvas.focusedImageId,
        selectedImageIds: [...input.canvas.selectedImageIds],
      },
    };
  }

  if (!isRecord(input)) {
    return {
      schemaVersion: 1,
      settings: createEmptyProjectSettings(),
      canvas: emptyCanvas(),
    };
  }

  if (!isLegacyProjectFile(input)) {
    return {
      schemaVersion: 1,
      settings: extractSettings(input),
      canvas: emptyCanvas(),
    };
  }

  const settings = extractSettings(input);
  const baseImage = input.baseImage;

  if (typeof baseImage === 'string' && baseImage.length > 0) {
    const id = nanoid();
    const size =
      isRecord(input.imageSize) &&
      typeof input.imageSize.width === 'number' &&
      typeof input.imageSize.height === 'number'
        ? { width: input.imageSize.width, height: input.imageSize.height }
        : { width: 1024, height: 1024 };

    const rootImage: CanvasImage = {
      id,
      url: baseImage,
      size,
      position: { x: 0, y: 0 },
      parentId: null,
      generationIndex: 0,
      prompt: '',
      provider: 'openai',
      type: 'generate',
      createdAt: Date.now(),
      paths: Array.isArray(input.paths) ? [...input.paths] : [],
      boxes: Array.isArray(input.boxes) ? [...input.boxes] : [],
      memos: Array.isArray(input.memos) ? [...input.memos] : [],
      status: 'ready',
    };

    return {
      schemaVersion: 1,
      settings,
      canvas: {
        images: { [id]: rootImage },
        imageOrder: [id],
        focusedImageId: id,
        selectedImageIds: [id],
      },
    };
  }

  return {
    schemaVersion: 1,
    settings,
    canvas: emptyCanvas(),
  };
}

export function migrateHistoryEntries(
  entries: LegacyHistoryEntry[],
  rootImageId: string,
): HistoryEntryV1[] {
  return entries.map((entry) => {
    if (typeof entry.imageId === 'string' && entry.imageId.length > 0) {
      return { ...entry, imageId: entry.imageId };
    }
    return { ...entry, imageId: rootImageId };
  });
}
