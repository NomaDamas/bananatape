import type { BoundingBox, Provider } from '@/types';
import type { ProjectHistoryEntry, ProjectSettings } from '@/lib/projects/schema';

export const LIVE2D_MANIFEST_SCHEMA_VERSION = 1;

export const LIVE2D_PROMPT_PRESET = `Create a Live2D-ready upper-body anime character part sheet.
Use a clean front-facing neutral pose and one full preview of the final character.
Separate these transparent-friendly parts with visible spacing: head base, face without hair/eyes/mouth, neck, body base, outfit torso, left arm, right arm, front hair, side hair, back hair, eye whites, irises, eyelids, eyebrows, closed mouth, and open mouth interior.
Draw hidden areas that would be covered in the final character, including face under bangs, torso under arms, neck under head, eye areas under eyelids, and mouth interior.
Do not claim automatic rigging or .moc3 generation.`;

export type Live2DAnnotationKind = 'bbox' | 'memo' | 'path';

export interface Live2DNormalizedBBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Live2DAnnotation {
  id: string;
  kind: Live2DAnnotationKind;
  label: string;
  part?: string;
  hiddenArea?: string;
  bbox?: Live2DNormalizedBBox;
  note?: string;
}

export interface Live2DHiddenAreaNote {
  part: string;
  note: string;
}

export interface Live2DSelectedAsset {
  historyEntryId: string;
  assetPath: string;
  provider: Provider;
}

export interface Live2DManifest {
  schemaVersion: typeof LIVE2D_MANIFEST_SCHEMA_VERSION;
  selected: Live2DSelectedAsset;
  annotations: Live2DAnnotation[];
  hiddenAreaNotes: Live2DHiddenAreaNote[];
}

export interface Live2DProjectSettings {
  enabled: boolean;
  selectedHistoryEntryId?: string | null;
}

export function createEmptyLive2DProjectSettings(): Live2DProjectSettings {
  return { enabled: false, selectedHistoryEntryId: null };
}

export function normalizeLive2DProjectSettings(value: unknown): Live2DProjectSettings {
  if (!value || typeof value !== 'object') return createEmptyLive2DProjectSettings();
  const record = value as Record<string, unknown>;
  return {
    enabled: record.enabled === true,
    selectedHistoryEntryId: typeof record.selectedHistoryEntryId === 'string' ? record.selectedHistoryEntryId : null,
  };
}

export function buildLive2DSystemPrompt(existingSystemPrompt = ''): string {
  const trimmed = existingSystemPrompt.trim();
  if (!trimmed) return LIVE2D_PROMPT_PRESET;
  if (trimmed.includes(LIVE2D_PROMPT_PRESET)) return trimmed;
  return `${trimmed}\n\n${LIVE2D_PROMPT_PRESET}`;
}

export function bboxToLive2DAnnotation(box: BoundingBox, index: number): Live2DAnnotation {
  return {
    id: box.id,
    kind: 'bbox',
    label: `Live2D annotation ${index + 1}`,
    bbox: {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    },
  };
}

export function buildLive2DManifest(options: {
  selectedEntry: ProjectHistoryEntry;
  annotations?: Live2DAnnotation[];
  hiddenAreaNotes?: Live2DHiddenAreaNote[];
}): Live2DManifest {
  return {
    schemaVersion: LIVE2D_MANIFEST_SCHEMA_VERSION,
    selected: {
      historyEntryId: options.selectedEntry.id,
      assetPath: options.selectedEntry.assetPath,
      provider: options.selectedEntry.provider,
    },
    annotations: options.annotations ?? [],
    hiddenAreaNotes: options.hiddenAreaNotes ?? [],
  };
}

export function getSelectedLive2DHistoryEntry(settings: ProjectSettings, entries: ProjectHistoryEntry[]): ProjectHistoryEntry | null {
  const selectedId = settings.live2d.selectedHistoryEntryId;
  if (selectedId) return entries.find((entry) => entry.id === selectedId) ?? null;
  return entries[0] ?? null;
}
