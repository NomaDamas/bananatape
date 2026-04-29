import { mkdir, readFile, rename, open } from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import type { Provider } from '@/types';
import { buildLive2DManifest, buildLive2DSystemPrompt, type Live2DManifest } from '@/lib/live2d/contract';
import { createEmptyHistory, createEmptyProjectSettings, HISTORY_SCHEMA_VERSION, isProjectHistory, normalizeProjectSettings, PROJECT_SCHEMA_VERSION, type ProjectHistory, type ProjectHistoryEntry, type ProjectManifest, type ProjectReferenceImage, type ProjectResultType, type ProjectSettings, type ProjectSettingsPatch } from './schema';
import { ensureProjectDirectories, getHistoryPath, getLive2DManifestPath, getManifestPath } from './paths';
import { withProjectLock } from './locks';
import { sanitizeProjectName, slugifyProjectName } from './validate';

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const data = `${JSON.stringify(value, null, 2)}\n`;
  const handle = await open(tmp, 'w');
  try {
    await handle.writeFile(data, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(tmp, filePath);
}

export async function createProject(projectRoot: string, name: string): Promise<ProjectManifest> {
  const cleanName = sanitizeProjectName(name);
  const now = new Date().toISOString();
  const manifest: ProjectManifest = {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: slugifyProjectName(cleanName),
    name: cleanName,
    createdAt: now,
    updatedAt: now,
    settings: createEmptyProjectSettings(),
  };
  await ensureProjectDirectories(projectRoot);
  await atomicWriteJson(getManifestPath(projectRoot), manifest);
  await atomicWriteJson(getHistoryPath(projectRoot), createEmptyHistory());
  return manifest;
}

export async function readProjectManifest(projectRoot: string): Promise<ProjectManifest> {
  const manifest = await readJson<ProjectManifest>(getManifestPath(projectRoot));
  if (!manifest || manifest.schemaVersion !== PROJECT_SCHEMA_VERSION) {
    throw new Error('Invalid BananaTape project manifest');
  }
  return manifest;
}

export async function readProjectSettings(projectRoot: string): Promise<ProjectSettings> {
  const manifest = await readProjectManifest(projectRoot);
  return normalizeProjectSettings(manifest.settings);
}

async function updateProjectManifest(
  projectRoot: string,
  update: (manifest: ProjectManifest) => ProjectManifest,
): Promise<ProjectManifest> {
  return withProjectLock(projectRoot, async () => {
    const current = await readProjectManifest(projectRoot);
    const next = update({
      ...current,
      settings: normalizeProjectSettings(current.settings),
      updatedAt: new Date().toISOString(),
    });
    await atomicWriteJson(getManifestPath(projectRoot), next);
    return next;
  });
}

export async function updateProjectSettings(
  projectRoot: string,
  patch: ProjectSettingsPatch,
): Promise<ProjectSettings> {
  const manifest = await updateProjectManifest(projectRoot, (current) => ({
    ...current,
    settings: {
      ...normalizeProjectSettings(current.settings),
      ...patch,
    },
  }));
  return normalizeProjectSettings(manifest.settings);
}

export interface DesignContextInput {
  content: string;
  fileName: string;
}

export async function setProjectDesignContext(
  projectRoot: string,
  input: DesignContextInput,
): Promise<ProjectSettings> {
  return updateProjectSettings(projectRoot, {
    designContext: input.content,
    designContextFileName: input.fileName,
  });
}

export async function clearProjectDesignContext(projectRoot: string): Promise<ProjectSettings> {
  return updateProjectSettings(projectRoot, {
    designContext: '',
    designContextFileName: '',
  });
}

export async function enableLive2DMode(projectRoot: string): Promise<ProjectSettings> {
  const manifest = await updateProjectManifest(projectRoot, (current) => {
    const settings = normalizeProjectSettings(current.settings);
    return {
      ...current,
      settings: {
        ...settings,
        systemPrompt: buildLive2DSystemPrompt(settings.systemPrompt),
        live2d: {
          ...settings.live2d,
          enabled: true,
        },
      },
    };
  });
  return normalizeProjectSettings(manifest.settings);
}

export async function writeLive2DManifest(projectRoot: string, selectedHistoryEntryId?: string | null): Promise<Live2DManifest> {
  return withProjectLock(projectRoot, async () => {
    const [manifest, history] = await Promise.all([
      readProjectManifest(projectRoot),
      readProjectHistory(projectRoot),
    ]);
    const settings = normalizeProjectSettings(manifest.settings);
    const selectedId = selectedHistoryEntryId ?? settings.live2d.selectedHistoryEntryId ?? history.entries[0]?.id;
    const selectedEntry = history.entries.find((entry) => entry.id === selectedId);
    if (!selectedEntry) {
      throw new Error('No selected BananaTape history entry is available for Live2D export');
    }
    const live2dManifest = buildLive2DManifest({ selectedEntry });
    await atomicWriteJson(getLive2DManifestPath(projectRoot), live2dManifest);
    await atomicWriteJson(getManifestPath(projectRoot), {
      ...manifest,
      settings: {
        ...settings,
        live2d: {
          enabled: true,
          selectedHistoryEntryId: selectedEntry.id,
        },
      },
      updatedAt: new Date().toISOString(),
    });
    return live2dManifest;
  });
}

export async function appendProjectReference(projectRoot: string, reference: ProjectReferenceImage): Promise<ProjectSettings> {
  const manifest = await updateProjectManifest(projectRoot, (current) => {
    const settings = normalizeProjectSettings(current.settings);
    return {
      ...current,
      settings: {
        ...settings,
        referenceImages: [...settings.referenceImages, reference],
      },
    };
  });
  return normalizeProjectSettings(manifest.settings);
}

export async function removeProjectReference(projectRoot: string, referenceId: string): Promise<ProjectSettings> {
  const manifest = await updateProjectManifest(projectRoot, (current) => {
    const settings = normalizeProjectSettings(current.settings);
    return {
      ...current,
      settings: {
        ...settings,
        referenceImages: settings.referenceImages.filter((reference) => reference.id !== referenceId),
      },
    };
  });
  return normalizeProjectSettings(manifest.settings);
}

export async function clearProjectReferences(projectRoot: string): Promise<ProjectSettings> {
  const manifest = await updateProjectManifest(projectRoot, (current) => ({
    ...current,
    settings: {
      ...normalizeProjectSettings(current.settings),
      referenceImages: [],
    },
  }));
  return normalizeProjectSettings(manifest.settings);
}

export async function readProjectHistory(projectRoot: string): Promise<ProjectHistory> {
  const history = await readJson<ProjectHistory>(getHistoryPath(projectRoot));
  if (!history) return createEmptyHistory();
  if (!isProjectHistory(history)) throw new Error('Invalid BananaTape history file');
  return history;
}

export interface AppendHistoryEntryOptions {
  type: ProjectResultType;
  provider: Provider;
  prompt: string;
  assetId: string;
  assetPath: string;
  parentId?: string | null;
}

export async function appendHistoryEntry(projectRoot: string, options: AppendHistoryEntryOptions): Promise<ProjectHistoryEntry> {
  return withProjectLock(projectRoot, async () => {
    const history = await readProjectHistory(projectRoot);
    const now = new Date();
    const entry: ProjectHistoryEntry = {
      id: `hist_${nanoid(12)}`,
      type: options.type,
      provider: options.provider,
      prompt: options.prompt,
      assetId: options.assetId,
      assetPath: options.assetPath,
      thumbnailPath: null,
      parentId: options.parentId ?? null,
      createdAt: now.toISOString(),
      timestamp: now.getTime(),
    };
    const next: ProjectHistory = {
      schemaVersion: HISTORY_SCHEMA_VERSION,
      revision: history.revision + 1,
      entries: [entry, ...history.entries],
    };
    await atomicWriteJson(getHistoryPath(projectRoot), next);
    return entry;
  });
}

export async function deleteHistoryEntry(projectRoot: string, entryId: string): Promise<ProjectHistory> {
  return withProjectLock(projectRoot, async () => {
    const history = await readProjectHistory(projectRoot);
    const next: ProjectHistory = {
      schemaVersion: HISTORY_SCHEMA_VERSION,
      revision: history.revision + 1,
      entries: history.entries.filter((entry) => entry.id !== entryId),
    };
    await atomicWriteJson(getHistoryPath(projectRoot), next);
    return next;
  });
}

export async function writeJsonForTests(filePath: string, value: unknown): Promise<void> {
  await atomicWriteJson(filePath, value);
}
