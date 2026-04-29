import { describe, it, expect } from 'vitest';
import { migrateProjectV0ToV1, migrateHistoryEntries } from './migrate';
import type { ProjectFileV1, LegacyHistoryEntry } from './migrate';
import { createEmptyProjectSettings } from '@/lib/projects/schema';
import type { DrawingPath, BoundingBox, TextMemo } from '@/types';

const defaultSettings = createEmptyProjectSettings();

const samplePath: DrawingPath = {
  id: 'path-1',
  tool: 'pen',
  points: [{ x: 0.1, y: 0.2 }],
  color: '#ff0000',
  strokeWidth: 2,
};

const sampleBox: BoundingBox = {
  id: 'box-1',
  tool: 'box',
  x: 10,
  y: 20,
  width: 100,
  height: 50,
  color: '#00ff00',
  status: 'pending',
};

const sampleMemo: TextMemo = {
  id: 'memo-1',
  x: 5,
  y: 5,
  text: 'hello',
  color: '#0000ff',
};

describe('migrateProjectV0ToV1', () => {
  it('empty project with only settings returns empty canvas', () => {
    const result = migrateProjectV0ToV1({ settings: defaultSettings });

    expect(result.schemaVersion).toBe(1);
    expect(result.settings).toEqual(defaultSettings);
    expect(result.canvas.images).toEqual({});
    expect(result.canvas.imageOrder).toEqual([]);
    expect(result.canvas.focusedImageId).toBeNull();
    expect(result.canvas.selectedImageIds).toEqual([]);
  });

  it('v0 with baseImage absorbs paths, boxes, memos into root image', () => {
    const input = {
      settings: defaultSettings,
      baseImage: 'data:image/png;base64,abc',
      imageSize: { width: 512, height: 768 },
      paths: [samplePath],
      boxes: [sampleBox],
      memos: [sampleMemo],
    };

    const result = migrateProjectV0ToV1(input);

    expect(result.schemaVersion).toBe(1);
    expect(result.canvas.imageOrder).toHaveLength(1);

    const id = result.canvas.imageOrder[0];
    expect(result.canvas.focusedImageId).toBe(id);
    expect(result.canvas.selectedImageIds).toEqual([id]);

    const img = result.canvas.images[id];
    expect(img.url).toBe('data:image/png;base64,abc');
    expect(img.size).toEqual({ width: 512, height: 768 });
    expect(img.position).toEqual({ x: 0, y: 0 });
    expect(img.parentId).toBeNull();
    expect(img.generationIndex).toBe(0);
    expect(img.prompt).toBe('');
    expect(img.provider).toBe('openai');
    expect(img.type).toBe('generate');
    expect(img.status).toBe('ready');
    expect(img.paths).toEqual([samplePath]);
    expect(img.boxes).toEqual([sampleBox]);
    expect(img.memos).toEqual([sampleMemo]);
  });

  it('v0 with baseImage but no annotations produces root image with empty arrays', () => {
    const input = {
      settings: defaultSettings,
      baseImage: 'https://example.com/img.png',
    };

    const result = migrateProjectV0ToV1(input);

    const id = result.canvas.imageOrder[0];
    const img = result.canvas.images[id];
    expect(img.paths).toEqual([]);
    expect(img.boxes).toEqual([]);
    expect(img.memos).toEqual([]);
  });

  it('v0 with baseImage uses default size when imageSize is absent', () => {
    const input = {
      settings: defaultSettings,
      baseImage: 'https://example.com/img.png',
    };

    const result = migrateProjectV0ToV1(input);
    const id = result.canvas.imageOrder[0];
    expect(result.canvas.images[id].size).toEqual({ width: 1024, height: 1024 });
  });

  it('already v1 passthrough returns structurally identical output', () => {
    const v1Input: ProjectFileV1 = {
      schemaVersion: 1,
      settings: defaultSettings,
      canvas: {
        images: {},
        imageOrder: [],
        focusedImageId: null,
        selectedImageIds: [],
      },
    };

    const result = migrateProjectV0ToV1(v1Input);

    expect(result.schemaVersion).toBe(1);
    expect(result.settings).toEqual(v1Input.settings);
    expect(result.canvas).toEqual(v1Input.canvas);
  });

  it('already v1 with images passthrough preserves all image data', () => {
    const existingImage = {
      id: 'existing-id',
      url: 'https://example.com/existing.png',
      size: { width: 1024, height: 1024 },
      position: { x: 0, y: 0 },
      parentId: null,
      generationIndex: 0,
      prompt: 'test',
      provider: 'openai' as const,
      type: 'generate' as const,
      createdAt: 1000,
      paths: [],
      boxes: [],
      memos: [],
      status: 'ready' as const,
    };

    const v1Input: ProjectFileV1 = {
      schemaVersion: 1,
      settings: defaultSettings,
      canvas: {
        images: { 'existing-id': existingImage },
        imageOrder: ['existing-id'],
        focusedImageId: 'existing-id',
        selectedImageIds: ['existing-id'],
      },
    };

    const result = migrateProjectV0ToV1(v1Input);
    expect(result.canvas.images['existing-id']).toEqual(existingImage);
    expect(result.canvas.imageOrder).toEqual(['existing-id']);
    expect(result.canvas.focusedImageId).toBe('existing-id');
  });

  it('no baseImage but has paths produces empty canvas (orphaned paths ignored)', () => {
    const input = {
      settings: defaultSettings,
      paths: [samplePath],
      boxes: [sampleBox],
    };

    const result = migrateProjectV0ToV1(input);

    expect(result.canvas.images).toEqual({});
    expect(result.canvas.imageOrder).toEqual([]);
    expect(result.canvas.focusedImageId).toBeNull();
  });

  it('null input returns empty v1', () => {
    const result = migrateProjectV0ToV1(null);
    expect(result.schemaVersion).toBe(1);
    expect(result.canvas).toEqual({
      images: {},
      imageOrder: [],
      focusedImageId: null,
      selectedImageIds: [],
    });
  });

  it('does not mutate the input object', () => {
    const input = {
      settings: { ...defaultSettings },
      baseImage: 'https://example.com/img.png',
      paths: [{ ...samplePath }],
    };
    const inputCopy = JSON.parse(JSON.stringify(input));

    migrateProjectV0ToV1(input);

    expect(input).toEqual(inputCopy);
  });

  it('idempotence: migrate(migrate(x)) deep-equals migrate(x) for v0 with baseImage', () => {
    const input = {
      settings: defaultSettings,
      baseImage: 'https://example.com/img.png',
      paths: [samplePath],
    };

    const once = migrateProjectV0ToV1(input);
    const twice = migrateProjectV0ToV1(once);

    expect(twice.schemaVersion).toBe(1);
    expect(twice.settings).toEqual(once.settings);
    expect(twice.canvas.imageOrder).toEqual(once.canvas.imageOrder);
    expect(twice.canvas.focusedImageId).toBe(once.canvas.focusedImageId);
    expect(twice.canvas.selectedImageIds).toEqual(once.canvas.selectedImageIds);
    expect(Object.keys(twice.canvas.images)).toEqual(Object.keys(once.canvas.images));

    const onceId = once.canvas.imageOrder[0];
    const twiceId = twice.canvas.imageOrder[0];
    expect(twice.canvas.images[twiceId].url).toBe(once.canvas.images[onceId].url);
    expect(twice.canvas.images[twiceId].paths).toEqual(once.canvas.images[onceId].paths);
  });
});

describe('migrateHistoryEntries', () => {
  const rootId = 'root-image-id';

  const legacyEntry: LegacyHistoryEntry = {
    id: 'entry-1',
    prompt: 'a cat',
    provider: 'openai',
    type: 'generate',
    timestamp: 1000,
  };

  it('adds rootImageId to legacy entries without imageId', () => {
    const result = migrateHistoryEntries([legacyEntry], rootId);
    expect(result[0].imageId).toBe(rootId);
  });

  it('preserves existing imageId on entries that already have one', () => {
    const entryWithId: LegacyHistoryEntry = {
      ...legacyEntry,
      imageId: 'other-image-id',
    };

    const result = migrateHistoryEntries([entryWithId], rootId);
    expect(result[0].imageId).toBe('other-image-id');
  });

  it('handles mixed entries correctly', () => {
    const entries: LegacyHistoryEntry[] = [
      { ...legacyEntry, id: 'e1' },
      { ...legacyEntry, id: 'e2', imageId: 'custom-id' },
      { ...legacyEntry, id: 'e3' },
    ];

    const result = migrateHistoryEntries(entries, rootId);
    expect(result[0].imageId).toBe(rootId);
    expect(result[1].imageId).toBe('custom-id');
    expect(result[2].imageId).toBe(rootId);
  });

  it('does not mutate input entries', () => {
    const entries: LegacyHistoryEntry[] = [{ ...legacyEntry }];
    const entriesCopy = JSON.parse(JSON.stringify(entries));

    migrateHistoryEntries(entries, rootId);

    expect(entries).toEqual(entriesCopy);
  });

  it('returns empty array for empty input', () => {
    expect(migrateHistoryEntries([], rootId)).toEqual([]);
  });

  it('preserves all other entry fields unchanged', () => {
    const result = migrateHistoryEntries([legacyEntry], rootId);
    expect(result[0].id).toBe(legacyEntry.id);
    expect(result[0].prompt).toBe(legacyEntry.prompt);
    expect(result[0].provider).toBe(legacyEntry.provider);
    expect(result[0].type).toBe(legacyEntry.type);
    expect(result[0].timestamp).toBe(legacyEntry.timestamp);
  });
});
