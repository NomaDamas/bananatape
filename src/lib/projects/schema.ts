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
}

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
