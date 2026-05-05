import type { Provider } from '@/types';

export const PROJECT_SCHEMA_VERSION = 1;
export const HISTORY_SCHEMA_VERSION = 1;

export type ProjectResultType = 'generate' | 'edit';

export interface ProjectManifest {
  schemaVersion: 1;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  settings?: ProjectSettings;
}

export interface ProjectReferenceImage {
  id: string;
  assetId: string;
  assetPath: string;
  name: string;
  mimeType: string;
  createdAt: string;
}

export interface ProjectSettings {
  systemPrompt: string;
  referenceImages: ProjectReferenceImage[];
  designContext?: string;
  designContextFileName?: string;
}

export type ProjectSettingsPatch = Partial<
  Pick<ProjectSettings, 'systemPrompt' | 'designContext' | 'designContextFileName'>
>;

export interface ProjectHistoryEntry {
  id: string;
  type: ProjectResultType;
  provider: Provider;
  prompt: string;
  assetId: string;
  assetPath: string;
  thumbnailPath?: string | null;
  parentId?: string | null;
  createdAt: string;
  timestamp: number;
}

export interface ProjectHistory {
  schemaVersion: 1;
  revision: number;
  entries: ProjectHistoryEntry[];
}

export interface PersistedImageResult {
  historyEntry: ProjectHistoryEntry;
  assetUrl: string;
}

export function createEmptyProjectSettings(): ProjectSettings {
  return { systemPrompt: '', referenceImages: [] };
}

export function normalizeProjectSettings(settings: Partial<ProjectSettings> | undefined): ProjectSettings {
  const normalized: ProjectSettings = {
    ...createEmptyProjectSettings(),
    ...(settings ?? {}),
    referenceImages: Array.isArray(settings?.referenceImages) ? settings.referenceImages : [],
  };

  if (typeof normalized.designContext !== 'string' || normalized.designContext.length === 0) {
    delete normalized.designContext;
  }
  if (typeof normalized.designContextFileName !== 'string' || normalized.designContextFileName.length === 0) {
    delete normalized.designContextFileName;
  }
  return normalized;
}

export function createEmptyHistory(): ProjectHistory {
  return { schemaVersion: HISTORY_SCHEMA_VERSION, revision: 0, entries: [] };
}

export function isProjectHistory(value: unknown): value is ProjectHistory {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return record.schemaVersion === HISTORY_SCHEMA_VERSION
    && typeof record.revision === 'number'
    && Array.isArray(record.entries);
}

export function isProjectManifest(value: unknown): value is ProjectManifest {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return record.schemaVersion === PROJECT_SCHEMA_VERSION
    && typeof record.id === 'string'
    && typeof record.name === 'string'
    && typeof record.createdAt === 'string'
    && typeof record.updatedAt === 'string';
}
