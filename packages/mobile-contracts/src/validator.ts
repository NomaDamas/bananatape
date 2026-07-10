import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  VALIDATION_ERROR_CODE,
  type CanvasFile,
  type CanvasImage,
  type ContractProject,
  type ContractValidationIssue,
  type ContractValidationResult,
  type ProjectHistory,
  type ProjectHistoryEntry,
  type ProjectManifest,
  type ProjectReferenceImage,
} from './contracts';

type JsonObject = Record<string, unknown>;

type JsonReadResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly issue: ContractValidationIssue };

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function issue(code: ContractValidationIssue['code'], filePath: string, message: string): ContractValidationIssue {
  return { code, path: filePath, message };
}

async function readJson(filePath: string, missingCode: ContractValidationIssue['code']): Promise<JsonReadResult> {
  try {
    const source = await readFile(filePath, 'utf8');
    const parsed: unknown = JSON.parse(source);
    return { ok: true, value: parsed };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { ok: false, issue: issue(VALIDATION_ERROR_CODE.fileMissing, filePath, `Invalid JSON in ${path.basename(filePath)}`) };
    }
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return { ok: false, issue: issue(missingCode, filePath, `Missing ${path.basename(filePath)}`) };
    }
    throw error;
  }
}

function parseReferenceImages(values: readonly unknown[]): readonly ProjectReferenceImage[] | null {
  const references: ProjectReferenceImage[] = [];
  for (const value of values) {
    const reference = parseReferenceImage(value);
    if (reference === null) return null;
    references.push(reference);
  }
  return references;
}

function parseReferenceImage(value: unknown): ProjectReferenceImage | null {
  if (!isObject(value)) return null;
  if (!isString(value.id) || !isString(value.assetId) || !isString(value.assetPath)) return null;
  if (!isString(value.name) || !isString(value.createdAt)) return null;
  if (value.mimeType !== 'image/png' && value.mimeType !== 'image/jpeg') return null;
  return {
    id: value.id,
    assetId: value.assetId,
    assetPath: value.assetPath,
    name: value.name,
    mimeType: value.mimeType,
    createdAt: value.createdAt,
  };
}

function parseManifest(value: unknown): ProjectManifest | null {
  if (!isObject(value) || value.schemaVersion !== 1) return null;
  if (!isString(value.id) || !isString(value.name) || !isString(value.createdAt) || !isString(value.updatedAt)) return null;
  const settingsValue = value.settings;
  if (settingsValue !== undefined && !isObject(settingsValue)) return null;
  const referenceValues = isObject(settingsValue) && Array.isArray(settingsValue.referenceImages) ? settingsValue.referenceImages : [];
  const referenceImages = parseReferenceImages(referenceValues);
  if (referenceImages === null) return null;
  return {
    schemaVersion: 1,
    id: value.id,
    name: value.name,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    settings: {
      systemPrompt: isObject(settingsValue) && typeof settingsValue.systemPrompt === 'string' ? settingsValue.systemPrompt : '',
      referenceImages,
    },
  };
}

function parseHistoryEntry(value: unknown): ProjectHistoryEntry | null {
  if (!isObject(value)) return null;
  if (!isString(value.id) || !isString(value.prompt) || !isString(value.assetId) || !isString(value.assetPath)) return null;
  if (value.type !== 'generate' && value.type !== 'edit') return null;
  if (value.provider !== 'openai' && value.provider !== 'god-tibo') return null;
  if (!isString(value.createdAt) || !isNumber(value.timestamp)) return null;
  return {
    id: value.id,
    type: value.type,
    provider: value.provider,
    prompt: value.prompt,
    assetId: value.assetId,
    assetPath: value.assetPath,
    thumbnailPath: typeof value.thumbnailPath === 'string' || value.thumbnailPath === null ? value.thumbnailPath : null,
    parentId: typeof value.parentId === 'string' || value.parentId === null ? value.parentId : null,
    createdAt: value.createdAt,
    timestamp: value.timestamp,
  };
}

function parseHistory(value: unknown): ProjectHistory | null {
  if (!isObject(value) || value.schemaVersion !== 1 || !isNumber(value.revision) || !Array.isArray(value.entries)) return null;
  const entries: ProjectHistoryEntry[] = [];
  for (const entryValue of value.entries) {
    const entry = parseHistoryEntry(entryValue);
    if (entry === null) return null;
    entries.push(entry);
  }
  return { schemaVersion: 1, revision: value.revision, entries };
}

function hasCanvasImageShape(value: unknown): value is CanvasImage {
  if (!isObject(value)) return false;
  return isString(value.id)
    && isString(value.url)
    && isObject(value.size)
    && isNumber(value.size.width)
    && isNumber(value.size.height)
    && isObject(value.position)
    && isNumber(value.position.x)
    && isNumber(value.position.y)
    && (typeof value.parentId === 'string' || value.parentId === null)
    && isNumber(value.generationIndex)
    && typeof value.prompt === 'string'
    && (value.provider === 'openai' || value.provider === 'god-tibo')
    && (value.type === 'generate' || value.type === 'edit')
    && isNumber(value.createdAt)
    && Array.isArray(value.paths)
    && Array.isArray(value.boxes)
    && Array.isArray(value.memos)
    && (value.status === 'pending' || value.status === 'streaming' || value.status === 'ready' || value.status === 'error');
}

function parseCanvas(value: unknown): CanvasFile | null {
  if (!isObject(value) || value.schemaVersion !== 1 || !isObject(value.canvas)) return null;
  const canvas = value.canvas;
  if (!isObject(value.settings)) return null;
  if (!isObject(canvas.images) || !Array.isArray(canvas.imageOrder) || !Array.isArray(canvas.focusedImageIds)) return null;
  const images: Record<string, CanvasImage> = {};
  for (const [imageId, image] of Object.entries(canvas.images)) {
    if (!hasCanvasImageShape(image)) return null;
    images[imageId] = image;
  }
  if (!canvas.imageOrder.every(isString) || !canvas.focusedImageIds.every(isString)) return null;
  return {
    schemaVersion: 1,
    settings: {
      systemPrompt: typeof value.settings.systemPrompt === 'string' ? value.settings.systemPrompt : '',
      referenceImages: Array.isArray(value.settings.referenceImages) ? (parseReferenceImages(value.settings.referenceImages) ?? []) : [],
    },
    canvas: {
      images,
      imageOrder: canvas.imageOrder,
      focusedImageIds: canvas.focusedImageIds,
    },
  };
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
    throw error;
  }
}

async function collectAssetIssues(projectRoot: string, manifest: ProjectManifest, history: ProjectHistory): Promise<readonly ContractValidationIssue[]> {
  const issues: ContractValidationIssue[] = [];
  for (const entry of history.entries) {
    const assetPath = path.join(projectRoot, entry.assetPath);
    if (!(await pathExists(assetPath))) {
      issues.push(issue(VALIDATION_ERROR_CODE.assetMissing, entry.assetPath, `Missing history asset ${entry.assetPath}`));
    }
  }
  for (const reference of manifest.settings?.referenceImages ?? []) {
    const referencePath = path.join(projectRoot, reference.assetPath);
    if (!(await pathExists(referencePath))) {
      issues.push(issue(VALIDATION_ERROR_CODE.referenceMissing, reference.assetPath, `Missing reference asset ${reference.assetPath}`));
    }
  }
  return issues;
}

export async function validateFixtureProject(projectRoot: string): Promise<ContractValidationResult> {
  const manifestValue = await readJson(path.join(projectRoot, 'project.json'), VALIDATION_ERROR_CODE.fileMissing);
  if (!manifestValue.ok) return { ok: false, issues: [manifestValue.issue] };
  const manifest = parseManifest(manifestValue.value);
  if (manifest === null) {
    return { ok: false, issues: [issue(VALIDATION_ERROR_CODE.manifestInvalid, 'project.json', 'Invalid BananaTape project manifest')] };
  }

  const historyValue = await readJson(path.join(projectRoot, 'history.json'), VALIDATION_ERROR_CODE.historyMissing);
  if (!historyValue.ok) return { ok: false, issues: [historyValue.issue] };
  const history = parseHistory(historyValue.value);
  if (history === null) {
    return { ok: false, issues: [issue(VALIDATION_ERROR_CODE.historyInvalid, 'history.json', 'Invalid BananaTape history file')] };
  }

  const canvasPath = path.join(projectRoot, 'canvas.json');
  const canvasValue = await pathExists(canvasPath) ? await readJson(canvasPath, VALIDATION_ERROR_CODE.fileMissing) : undefined;
  if (canvasValue !== undefined && !canvasValue.ok) return { ok: false, issues: [canvasValue.issue] };
  const canvas = canvasValue === undefined ? undefined : parseCanvas(canvasValue.value);
  if (canvas === null) {
    return { ok: false, issues: [issue(VALIDATION_ERROR_CODE.canvasInvalid, 'canvas.json', 'Invalid BananaTape canvas file')] };
  }

  const assetIssues = await collectAssetIssues(projectRoot, manifest, history);
  if (assetIssues.length > 0) return { ok: false, issues: assetIssues };

  const project: ContractProject = canvas === undefined ? { manifest, history } : { manifest, history, canvas };
  return { ok: true, project };
}

export function roundTripProject(project: ContractProject): ContractProject {
  const parsed: unknown = JSON.parse(JSON.stringify(project));
  if (!isObject(parsed) || !isObject(parsed.manifest) || !isObject(parsed.history)) {
    throw new TypeError('Contract project did not survive JSON serialization');
  }
  return parsed as ContractProject;
}
