import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import type { Provider } from '@/types';
import type { ProjectReferenceImage, ProjectResultType, PersistedImageResult } from './schema';
import { appendHistoryEntry, appendProjectReference } from './metadata-store';
import { resolveInsideProject } from './paths';
import { assertValidAssetId } from './validate';

const DATA_URL_PATTERN = /^data:([^;,]+);base64,(.+)$/;

export function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; mimeType: string; extension: string } {
  const match = dataUrl.match(DATA_URL_PATTERN);
  if (!match) throw new Error('Expected base64 data URL');
  const mimeType = match[1];
  const extension = extensionForMimeType(mimeType);
  return { buffer: Buffer.from(match[2], 'base64'), mimeType, extension };
}

export function extensionForMimeType(mimeType: string): string {
  return mimeType === 'image/jpeg' || mimeType === 'image/jpg' ? 'jpg'
    : mimeType === 'image/webp' ? 'webp'
      : mimeType === 'image/gif' ? 'gif'
        : 'png';
}

export function makeAssetId(date = new Date()): string {
  const stamp = date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `img_${stamp}_${nanoid(8)}`;
}

export function makeReferenceAssetId(date = new Date()): string {
  const stamp = date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `ref_${stamp}_${nanoid(8)}`;
}

export interface PersistImageResultOptions {
  projectRoot: string;
  imageDataUrl: string;
  prompt: string;
  provider: Provider;
  type: ProjectResultType;
  parentId?: string | null;
}

export async function persistImageResult(options: PersistImageResultOptions): Promise<PersistedImageResult> {
  const { buffer, extension } = dataUrlToBuffer(options.imageDataUrl);
  const assetId = makeAssetId();
  const assetPath = `assets/${assetId}.${extension}`;
  const absolutePath = await resolveInsideProject(options.projectRoot, assetPath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer, { flag: 'wx' });
  const historyEntry = await appendHistoryEntry(options.projectRoot, {
    type: options.type,
    provider: options.provider,
    prompt: options.prompt,
    assetId,
    assetPath,
    parentId: options.parentId,
  });
  return { historyEntry, assetUrl: `/api/projects/assets/${assetId}` };
}

export async function persistReferenceImage(projectRoot: string, file: File): Promise<ProjectReferenceImage> {
  const assetId = makeReferenceAssetId();
  const mimeType = file.type || 'image/png';
  const extension = extensionForMimeType(mimeType);
  const assetPath = `references/${assetId}.${extension}`;
  const absolutePath = await resolveInsideProject(projectRoot, assetPath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()), { flag: 'wx' });

  const reference: ProjectReferenceImage = {
    id: `ref_${nanoid(12)}`,
    assetId,
    assetPath,
    name: file.name || `${assetId}.${extension}`,
    mimeType,
    createdAt: new Date().toISOString(),
  };
  await appendProjectReference(projectRoot, reference);
  return reference;
}

export async function readAsset(projectRoot: string, assetId: string, assetPath: string): Promise<Buffer> {
  assertValidAssetId(assetId);
  const absolutePath = await resolveInsideProject(projectRoot, assetPath);
  return readFile(absolutePath);
}
