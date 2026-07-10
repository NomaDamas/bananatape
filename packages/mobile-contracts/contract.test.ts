import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CORRUPT_FIXTURE_NAMES,
  FIXTURE_IMAGE_NAMES,
  VALIDATION_ERROR_CODE,
  VALID_FIXTURE_NAMES,
  roundTripProject,
  validateFixtureProject,
  type CanvasImage,
} from './src';

const fixturesRoot = path.join(__dirname, 'fixtures');

function fixturePath(name: string): string {
  return path.join(fixturesRoot, name);
}

function getMagicLayerImage(images: Record<string, CanvasImage>): CanvasImage {
  const image = images['img-magic-generate-1'];
  if (image === undefined) throw new Error('Magic Layer fixture image missing');
  return image;
}

describe('mobile contract fixtures', () => {
  it('validates all golden project fixtures when they match desktop project semantics', async () => {
    const results = await Promise.all(VALID_FIXTURE_NAMES.map((name) => validateFixtureProject(fixturePath(name))));

    expect(results).toHaveLength(VALID_FIXTURE_NAMES.length);
    for (const result of results) {
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.project.manifest.schemaVersion).toBe(1);
        expect(result.project.history.schemaVersion).toBe(1);
        expect(result.project.history.entries.length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps the fixture inventory stable for downstream native tests', async () => {
    const entries = await readdir(fixturesRoot);

    expect(entries).toEqual(expect.arrayContaining([...VALID_FIXTURE_NAMES, ...CORRUPT_FIXTURE_NAMES, ...FIXTURE_IMAGE_NAMES]));
  });

  it('returns a stable validation issue for a corrupt project without throwing', async () => {
    const result = await validateFixtureProject(fixturePath('corrupt-project-missing-history'));

    expect(result).toEqual({
      ok: false,
      issues: [
        {
          code: VALIDATION_ERROR_CODE.historyMissing,
          path: path.join(fixturePath('corrupt-project-missing-history'), 'history.json'),
          message: 'Missing history.json',
        },
      ],
    });
  });

  it('preserves desktop Magic Layer fields through JSON round-trip serialization', async () => {
    const result = await validateFixtureProject(fixturePath('desktop-project-with-magic-layer-fields'));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Magic Layer fixture failed validation');
    expect(result.project.canvas).toBeDefined();

    const before = getMagicLayerImage(result.project.canvas?.canvas.images ?? {});
    expect(before.magicLayers).toHaveLength(2);
    expect(before.magicLayerBaseUrl).toBe('/api/projects/assets/img_magic_generate_1');
    expect(before.magicLayerStatus).toBe('ready');
    expect(before.selectedMagicLayerId).toBe('layer-banana-foreground');

    const after = getMagicLayerImage(roundTripProject(result.project).canvas?.canvas.images ?? {});
    expect(after.magicLayers).toEqual(before.magicLayers);
    expect(after.magicLayerBaseUrl).toBe(before.magicLayerBaseUrl);
    expect(after.magicLayerStatus).toBe(before.magicLayerStatus);
    expect(after.selectedMagicLayerId).toBe(before.selectedMagicLayerId);
  });
});
