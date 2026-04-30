import { mkdtemp, readFile, realpath, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { dataUrlToBuffer, persistImageResult, readAsset } from '@/lib/projects/asset-store';
import { appendProjectReference, createProject, enableLive2DMode, readProjectHistory, readProjectManifest, readProjectSettings, removeProjectReference, updateProjectSettings, writeLive2DManifest } from '@/lib/projects/metadata-store';
import { assertProjectRelativePath, resolveInsideProject } from '@/lib/projects/paths';
import { assertValidAssetId, assertValidProjectId, slugifyProjectName } from '@/lib/projects/validate';

const PNG_1X1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

async function tempProjectRoot() {
  return mkdtemp(path.join(os.tmpdir(), 'bananatape-project-test-'));
}

describe('project validation and path safety', () => {
  it('slugifies user-facing names into project ids', () => {
    expect(slugifyProjectName('My Banana Tape!')).toBe('my-banana-tape');
    expect(slugifyProjectName('***')).toBe('untitled');
    expect(assertValidProjectId('my-project-1')).toBe('my-project-1');
    expect(() => assertValidProjectId('../escape')).toThrow();
    expect(() => assertValidProjectId('Uppercase')).toThrow();
  });

  it('rejects traversal and absolute project-relative paths', () => {
    expect(assertProjectRelativePath('assets/img_12345678.png')).toBe('assets/img_12345678.png');
    expect(() => assertProjectRelativePath('../secret')).toThrow('Path escapes project root');
    expect(() => assertProjectRelativePath('/tmp/secret')).toThrow('project-relative');
    expect(() => assertProjectRelativePath('assets/../../secret')).toThrow('Path escapes project root');
    expect(() => assertValidAssetId('../img_12345678')).toThrow('Invalid asset id');
  });

  it('keeps resolved asset paths inside the real project root', async () => {
    const projectRoot = await tempProjectRoot();
    await createProject(projectRoot, 'Path Safety');

    const inside = await resolveInsideProject(projectRoot, 'assets/file.png');
    expect(inside.startsWith(`${await realpath(projectRoot)}${path.sep}`)).toBe(true);

    await symlink(os.tmpdir(), path.join(projectRoot, 'assets', 'escape'));
    await expect(resolveInsideProject(projectRoot, 'assets/escape/file.png')).rejects.toThrow('Path escapes project root');
  });
});

describe('project metadata and asset persistence', () => {
  it('creates a project manifest and empty history', async () => {
    const projectRoot = await tempProjectRoot();
    const manifest = await createProject(projectRoot, 'Launch Test');

    expect(manifest.id).toBe('launch-test');
    await expect(readProjectManifest(projectRoot)).resolves.toMatchObject({ id: 'launch-test', name: 'Launch Test' });
    await expect(readProjectHistory(projectRoot)).resolves.toMatchObject({ revision: 0, entries: [] });
    await expect(readProjectSettings(projectRoot)).resolves.toEqual({ systemPrompt: '', referenceImages: [], live2d: { enabled: false, selectedHistoryEntryId: null, partLabels: {}, hiddenAreaNotes: [] } });
  });

  it('persists project-level system prompt and reference image metadata', async () => {
    const projectRoot = await tempProjectRoot();
    await createProject(projectRoot, 'Settings Test');

    await updateProjectSettings(projectRoot, { systemPrompt: 'Always use moody lighting.' });
    await appendProjectReference(projectRoot, {
      id: 'ref_meta_1',
      assetId: 'ref_20260427T000000Z_abcdef12',
      assetPath: 'references/ref_20260427T000000Z_abcdef12.png',
      name: 'style.png',
      mimeType: 'image/png',
      createdAt: new Date().toISOString(),
    });

    await expect(readProjectSettings(projectRoot)).resolves.toMatchObject({
      systemPrompt: 'Always use moody lighting.',
      referenceImages: [
        expect.objectContaining({ id: 'ref_meta_1', name: 'style.png' }),
      ],
    });

    await removeProjectReference(projectRoot, 'ref_meta_1');
    await expect(readProjectSettings(projectRoot)).resolves.toMatchObject({
      systemPrompt: 'Always use moody lighting.',
      referenceImages: [],
    });
  });


  it('preserves system prompt when patching only Live2D settings', async () => {
    const projectRoot = await tempProjectRoot();
    await createProject(projectRoot, 'Live2D Settings Patch');
    await updateProjectSettings(projectRoot, { systemPrompt: 'Keep my saved prompt.' });

    const settings = await updateProjectSettings(projectRoot, { live2d: { enabled: true, selectedHistoryEntryId: 'entry-1', partLabels: {}, hiddenAreaNotes: [] } });

    expect(settings.systemPrompt).toBe('Keep my saved prompt.');
    expect(settings.live2d).toEqual({ enabled: true, selectedHistoryEntryId: 'entry-1', partLabels: {}, hiddenAreaNotes: [] });
  });


  it('enables Live2D mode and writes a selected live2d manifest contract', async () => {
    const projectRoot = await tempProjectRoot();
    await createProject(projectRoot, 'Live2D Test');

    const persisted = await persistImageResult({
      projectRoot,
      imageDataUrl: PNG_1X1,
      prompt: 'Live2D part sheet',
      provider: 'god-tibo',
      type: 'generate',
    });

    const settings = await enableLive2DMode(projectRoot);
    expect(settings.live2d.enabled).toBe(true);
    expect(settings.systemPrompt).toContain('Live2D-ready upper-body anime character part sheet');

    const live2dManifest = await writeLive2DManifest(projectRoot, {
      selectedHistoryEntryId: persisted.historyEntry.id,
      boxes: [{ id: 'box_hair', tool: 'box', x: 0.1, y: 0.2, width: 0.3, height: 0.4, color: '#ef4444', status: 'pending' }],
      partLabels: { box_hair: 'hair_front' },
      hiddenAreaNotes: [{ part: 'hair_front', note: 'Face pixels under bangs should exist.' }],
    });
    expect(live2dManifest).toMatchObject({
      schemaVersion: 1,
      selected: {
        historyEntryId: persisted.historyEntry.id,
        assetPath: persisted.historyEntry.assetPath,
        provider: 'god-tibo',
      },
      annotations: [expect.objectContaining({ id: 'box_hair', part: 'hair_front', bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 } })],
      hiddenAreaNotes: [{ part: 'hair_front', note: 'Face pixels under bangs should exist.' }],
    });

    const manifestFile = JSON.parse(await readFile(path.join(projectRoot, 'live2d', 'manifest.json'), 'utf8'));
    expect(manifestFile.selected.historyEntryId).toBe(persisted.historyEntry.id);
    await expect(readProjectSettings(projectRoot)).resolves.toMatchObject({
      live2d: { enabled: true, selectedHistoryEntryId: persisted.historyEntry.id, partLabels: { box_hair: 'hair_front' }, hiddenAreaNotes: [{ part: 'hair_front', note: 'Face pixels under bangs should exist.' }] },
    });
  });


  it('decodes data URLs and persists assets plus history metadata without embedding image data', async () => {
    const projectRoot = await tempProjectRoot();
    await createProject(projectRoot, 'Asset Test');

    const decoded = dataUrlToBuffer(PNG_1X1);
    expect(decoded.mimeType).toBe('image/png');
    expect(decoded.extension).toBe('png');
    expect(decoded.buffer.length).toBeGreaterThan(0);

    const persisted = await persistImageResult({
      projectRoot,
      imageDataUrl: PNG_1X1,
      prompt: 'make a banana poster',
      provider: 'openai',
      type: 'generate',
    });

    expect(persisted.assetUrl).toBe(`/api/projects/assets/${persisted.historyEntry.assetId}`);
    const history = await readProjectHistory(projectRoot);
    expect(history.revision).toBe(1);
    expect(history.entries[0]).toMatchObject({
      prompt: 'make a banana poster',
      provider: 'openai',
      type: 'generate',
      parentId: null,
    });
    expect(JSON.stringify(history)).not.toContain('base64');

    const asset = await readAsset(projectRoot, persisted.historyEntry.assetId, persisted.historyEntry.assetPath);
    expect(asset.equals(decoded.buffer)).toBe(true);
    const historyFile = await readFile(path.join(projectRoot, 'history.json'), 'utf8');
    expect(historyFile).not.toContain(PNG_1X1);
  });

  it('serializes concurrent history writes without corrupting revision order', async () => {
    const projectRoot = await tempProjectRoot();
    await createProject(projectRoot, 'Concurrent Test');

    await Promise.all(Array.from({ length: 5 }, (_, index) => persistImageResult({
      projectRoot,
      imageDataUrl: PNG_1X1,
      prompt: `prompt ${index}`,
      provider: 'god-tibo',
      type: index === 0 ? 'generate' : 'edit',
      parentId: index === 0 ? null : 'hist_parent',
    })));

    const history = await readProjectHistory(projectRoot);
    expect(history.revision).toBe(5);
    expect(history.entries).toHaveLength(5);
    expect(new Set(history.entries.map((entry) => entry.id)).size).toBe(5);
  });
});
