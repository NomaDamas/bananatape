import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  clearProjectDesignContext,
  createProject,
  readProjectSettings,
  setProjectDesignContext,
  updateProjectSettings,
} from '@/lib/projects/metadata-store';
import {
  createEmptyProjectSettings,
  normalizeProjectSettings,
} from '@/lib/projects/schema';

async function tempProjectRoot() {
  return mkdtemp(path.join(os.tmpdir(), 'bananatape-design-context-test-'));
}

describe('design context schema', () => {
  it('omits designContext fields from empty settings so legacy project.json still round-trips', () => {
    const empty = createEmptyProjectSettings();
    expect(empty).toEqual({ systemPrompt: '', referenceImages: [], live2d: { enabled: false, selectedHistoryEntryId: null, partLabels: {}, hiddenAreaNotes: [] } });
    expect('designContext' in empty).toBe(false);
    expect('designContextFileName' in empty).toBe(false);
  });

  it('drops empty-string designContext fields during normalization', () => {
    const normalized = normalizeProjectSettings({
      systemPrompt: '',
      referenceImages: [],
      designContext: '',
      designContextFileName: '',
    });
    expect(normalized).toEqual({ systemPrompt: '', referenceImages: [], live2d: { enabled: false, selectedHistoryEntryId: null, partLabels: {}, hiddenAreaNotes: [] } });
  });

  it('preserves non-empty designContext fields during normalization', () => {
    const normalized = normalizeProjectSettings({
      systemPrompt: '',
      referenceImages: [],
      designContext: '# Title\n- one',
      designContextFileName: 'DESIGN.md',
    });
    expect(normalized).toEqual({
      systemPrompt: '',
      referenceImages: [],
      live2d: { enabled: false, selectedHistoryEntryId: null, partLabels: {}, hiddenAreaNotes: [] },
      designContext: '# Title\n- one',
      designContextFileName: 'DESIGN.md',
    });
  });
});

describe('design context store helpers', () => {
  it('persists and clears design context through dedicated helpers', async () => {
    const projectRoot = await tempProjectRoot();
    await createProject(projectRoot, 'Design Context Test');

    const initial = await readProjectSettings(projectRoot);
    expect(initial.designContext).toBeUndefined();
    expect(initial.designContextFileName).toBeUndefined();

    const afterSet = await setProjectDesignContext(projectRoot, {
      content: '# Brand\n- Use bananas, never mangoes.',
      fileName: 'DESIGN.md',
    });
    expect(afterSet.designContext).toBe('# Brand\n- Use bananas, never mangoes.');
    expect(afterSet.designContextFileName).toBe('DESIGN.md');

    const reread = await readProjectSettings(projectRoot);
    expect(reread.designContext).toBe('# Brand\n- Use bananas, never mangoes.');
    expect(reread.designContextFileName).toBe('DESIGN.md');

    const afterClear = await clearProjectDesignContext(projectRoot);
    expect(afterClear.designContext).toBeUndefined();
    expect(afterClear.designContextFileName).toBeUndefined();
  });

  it('updates only the fields named in the patch and leaves the design context alone', async () => {
    const projectRoot = await tempProjectRoot();
    await createProject(projectRoot, 'Patch Isolation');

    await setProjectDesignContext(projectRoot, {
      content: '# Locked\n- Do not delete me.',
      fileName: 'LOCKED.md',
    });

    await updateProjectSettings(projectRoot, { systemPrompt: 'Always stay punchy.' });

    const settings = await readProjectSettings(projectRoot);
    expect(settings.systemPrompt).toBe('Always stay punchy.');
    expect(settings.designContext).toBe('# Locked\n- Do not delete me.');
    expect(settings.designContextFileName).toBe('LOCKED.md');
  });
});
