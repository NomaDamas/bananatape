import type { BoundingBox, Provider } from '@/types';
import type { ProjectHistoryEntry, ProjectSettings } from '@/lib/projects/schema';

export const LIVE2D_MANIFEST_SCHEMA_VERSION = 1;

export const LIVE2D_PROMPT_PRESET = `Create a Live2D-ready upper-body anime character part sheet.
Use a clean front-facing neutral pose and one full preview of the final character.
Separate these transparent-friendly parts with visible spacing: head base, face without hair/eyes/mouth, neck, body base, outfit torso, left arm, right arm, front hair, side hair, back hair, eye whites, irises, eyelids, eyebrows, closed mouth, and open mouth interior.
Draw hidden areas that would be covered in the final character, including face under bangs, torso under arms, neck under head, eye areas under eyelids, and mouth interior.
Do not claim automatic rigging or .moc3 generation.`;


export const LIVE2D_DEFAULT_USER_PROMPT = `Use the attached reference image(s) to create a Live2D-ready part sheet for the same character.
Preserve the character identity, palette, outfit, and face design from the references.
Output one clean front-facing upper-body preview plus clearly separated transparent-friendly parts for every required Live2D layer.
Include hidden/covered areas needed for rigging: face under bangs, torso under arms, neck under head, eyelid-covered eye areas, and mouth interior.
Keep all parts spaced apart, unmerged, and easy to bbox annotate in BananaTape.`;

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

export interface Live2DPartLabel {
  part: string;
  label: string;
}

export interface Live2DProjectSettings {
  enabled: boolean;
  selectedHistoryEntryId?: string | null;
  partLabels: Record<string, string>;
  hiddenAreaNotes: Live2DHiddenAreaNote[];
}

export function createEmptyLive2DProjectSettings(): Live2DProjectSettings {
  return { enabled: false, selectedHistoryEntryId: null, partLabels: {}, hiddenAreaNotes: [] };
}

export function normalizeLive2DProjectSettings(value: unknown): Live2DProjectSettings {
  if (!value || typeof value !== 'object') return createEmptyLive2DProjectSettings();
  const record = value as Record<string, unknown>;
  const rawPartLabels = record.partLabels && typeof record.partLabels === 'object'
    ? record.partLabels as Record<string, unknown>
    : {};
  const partLabels = Object.fromEntries(
    Object.entries(rawPartLabels).filter((entry): entry is [string, string] => (
      typeof entry[0] === 'string' && typeof entry[1] === 'string' && entry[1].trim().length > 0
    )),
  );
  const hiddenAreaNotes = Array.isArray(record.hiddenAreaNotes)
    ? record.hiddenAreaNotes.flatMap((note): Live2DHiddenAreaNote[] => {
      if (!note || typeof note !== 'object') return [];
      const candidate = note as Record<string, unknown>;
      return typeof candidate.part === 'string' && typeof candidate.note === 'string' && candidate.note.trim()
        ? [{ part: candidate.part, note: candidate.note }]
        : [];
    })
    : [];
  return {
    enabled: record.enabled === true,
    selectedHistoryEntryId: typeof record.selectedHistoryEntryId === 'string' ? record.selectedHistoryEntryId : null,
    partLabels,
    hiddenAreaNotes,
  };
}

export function buildLive2DSystemPrompt(existingSystemPrompt = ''): string {
  const trimmed = existingSystemPrompt.trim();
  if (!trimmed) return LIVE2D_PROMPT_PRESET;
  if (trimmed.includes(LIVE2D_PROMPT_PRESET)) return trimmed;
  return `${trimmed}\n\n${LIVE2D_PROMPT_PRESET}`;
}

export function bboxToLive2DAnnotation(box: BoundingBox, index: number, part?: string): Live2DAnnotation {
  return {
    id: box.id,
    kind: 'bbox',
    label: part ? `${part} bbox` : `Live2D annotation ${index + 1}`,
    ...(part ? { part } : {}),
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
