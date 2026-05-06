import { describe, it, expect, beforeEach } from 'vitest';
import { useHistoryStore, selectEntriesForImage } from './useHistoryStore';
import type { HistoryEntry } from './types';

function makeEntry(overrides: Partial<HistoryEntry> = {}): Omit<HistoryEntry, 'id' | 'timestamp'> {
  return {
    prompt: 'test prompt',
    provider: 'openai',
    type: 'generate',
    ...overrides,
  };
}

beforeEach(() => {
  useHistoryStore.getState().clearHistory();
});

describe('addEntry', () => {
  it('stores imageId when provided', () => {
    useHistoryStore.getState().addEntry({ ...makeEntry(), imageId: 'img-1' });
    const { entries } = useHistoryStore.getState();
    expect(entries).toHaveLength(1);
    expect(entries[0].imageId).toBe('img-1');
  });

  it('works without imageId (field is undefined)', () => {
    useHistoryStore.getState().addEntry(makeEntry());
    const { entries } = useHistoryStore.getState();
    expect(entries).toHaveLength(1);
    expect(entries[0].imageId).toBeUndefined();
  });

  it('works with imageId explicitly null', () => {
    useHistoryStore.getState().addEntry({ ...makeEntry(), imageId: null });
    const { entries } = useHistoryStore.getState();
    expect(entries[0].imageId).toBeNull();
  });

  it('assigns id and timestamp automatically', () => {
    useHistoryStore.getState().addEntry(makeEntry());
    const { entries } = useHistoryStore.getState();
    expect(typeof entries[0].id).toBe('string');
    expect(entries[0].id.length).toBeGreaterThan(0);
    expect(typeof entries[0].timestamp).toBe('number');
  });

  it('sets selectedId to the new entry', () => {
    useHistoryStore.getState().addEntry(makeEntry());
    const { entries, selectedId } = useHistoryStore.getState();
    expect(selectedId).toBe(entries[0].id);
  });

  it('prepends new entries and caps at 20', () => {
    for (let i = 0; i < 22; i++) {
      useHistoryStore.getState().addEntry({ ...makeEntry(), prompt: `prompt-${i}` });
    }
    const { entries } = useHistoryStore.getState();
    expect(entries).toHaveLength(20);
    expect(entries[0].prompt).toBe('prompt-21');
  });
});

describe('selectEntriesForImage', () => {
  it('returns only entries matching imageId', () => {
    useHistoryStore.getState().addEntry({ ...makeEntry(), imageId: 'img-1' });
    useHistoryStore.getState().addEntry({ ...makeEntry(), imageId: 'img-2' });
    useHistoryStore.getState().addEntry({ ...makeEntry(), imageId: 'img-1' });

    const state = useHistoryStore.getState();
    const result = selectEntriesForImage(state, 'img-1');
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.imageId === 'img-1')).toBe(true);
  });

  it('returns empty array when imageId is null', () => {
    useHistoryStore.getState().addEntry({ ...makeEntry(), imageId: 'img-1' });
    const state = useHistoryStore.getState();
    expect(selectEntriesForImage(state, null)).toEqual([]);
  });

  it('returns empty array when no entries match', () => {
    useHistoryStore.getState().addEntry({ ...makeEntry(), imageId: 'img-1' });
    const state = useHistoryStore.getState();
    expect(selectEntriesForImage(state, 'img-999')).toEqual([]);
  });

  it('preserves order from entries array', () => {
    useHistoryStore.getState().addEntry({ ...makeEntry(), imageId: 'img-1', prompt: 'first' });
    useHistoryStore.getState().addEntry({ ...makeEntry(), imageId: 'img-1', prompt: 'second' });
    useHistoryStore.getState().addEntry({ ...makeEntry(), imageId: 'img-1', prompt: 'third' });

    const state = useHistoryStore.getState();
    const result = selectEntriesForImage(state, 'img-1');
    expect(result.map((e) => e.prompt)).toEqual(['third', 'second', 'first']);
  });

  it('returns empty array when store has no entries', () => {
    const state = useHistoryStore.getState();
    expect(selectEntriesForImage(state, 'img-1')).toEqual([]);
  });
});

describe('hydrateEntries', () => {
  it('accepts entries with imageId', () => {
    const entries: HistoryEntry[] = [
      { id: 'e1', prompt: 'p1', provider: 'openai', type: 'generate', timestamp: 1, imageId: 'img-1' },
    ];
    useHistoryStore.getState().hydrateEntries(entries);
    expect(useHistoryStore.getState().entries[0].imageId).toBe('img-1');
  });

  it('accepts entries without imageId (legacy)', () => {
    const entries: HistoryEntry[] = [
      { id: 'e1', prompt: 'p1', provider: 'openai', type: 'generate', timestamp: 1 },
    ];
    useHistoryStore.getState().hydrateEntries(entries);
    expect(useHistoryStore.getState().entries[0].imageId).toBeUndefined();
  });

  it('accepts mixed entries (with and without imageId)', () => {
    const entries: HistoryEntry[] = [
      { id: 'e1', prompt: 'p1', provider: 'openai', type: 'generate', timestamp: 1, imageId: 'img-1' },
      { id: 'e2', prompt: 'p2', provider: 'openai', type: 'edit', timestamp: 2 },
    ];
    useHistoryStore.getState().hydrateEntries(entries);
    const state = useHistoryStore.getState();
    expect(state.entries).toHaveLength(2);
    expect(state.entries[0].imageId).toBe('img-1');
    expect(state.entries[1].imageId).toBeUndefined();
  });

  it('sets selectedId to first entry', () => {
    const entries: HistoryEntry[] = [
      { id: 'e1', prompt: 'p1', provider: 'openai', type: 'generate', timestamp: 1 },
      { id: 'e2', prompt: 'p2', provider: 'openai', type: 'edit', timestamp: 2 },
    ];
    useHistoryStore.getState().hydrateEntries(entries);
    expect(useHistoryStore.getState().selectedId).toBe('e1');
  });
});

describe('deleteEntry', () => {
  it('removes the entry by id', () => {
    useHistoryStore.getState().addEntry(makeEntry());
    const { entries } = useHistoryStore.getState();
    const id = entries[0].id;
    useHistoryStore.getState().deleteEntry(id);
    expect(useHistoryStore.getState().entries).toHaveLength(0);
  });

  it('clears selectedId when selected entry is deleted', () => {
    useHistoryStore.getState().addEntry(makeEntry());
    const { entries } = useHistoryStore.getState();
    const id = entries[0].id;
    useHistoryStore.getState().deleteEntry(id);
    expect(useHistoryStore.getState().selectedId).toBeNull();
  });

  it('preserves selectedId when a different entry is deleted', () => {
    useHistoryStore.getState().addEntry({ ...makeEntry(), prompt: 'a' });
    useHistoryStore.getState().addEntry({ ...makeEntry(), prompt: 'b' });
    const { entries, selectedId } = useHistoryStore.getState();
    const otherId = entries.find((e) => e.id !== selectedId)!.id;
    useHistoryStore.getState().deleteEntry(otherId);
    expect(useHistoryStore.getState().selectedId).toBe(selectedId);
  });
});

describe('selectEntry', () => {
  it('updates selectedId', () => {
    useHistoryStore.getState().addEntry({ ...makeEntry(), prompt: 'a' });
    useHistoryStore.getState().addEntry({ ...makeEntry(), prompt: 'b' });
    const { entries } = useHistoryStore.getState();
    const targetId = entries[1].id;
    useHistoryStore.getState().selectEntry(targetId);
    expect(useHistoryStore.getState().selectedId).toBe(targetId);
  });
});

describe('clearHistory', () => {
  it('empties entries and resets selectedId', () => {
    useHistoryStore.getState().addEntry(makeEntry());
    useHistoryStore.getState().clearHistory();
    const state = useHistoryStore.getState();
    expect(state.entries).toHaveLength(0);
    expect(state.selectedId).toBeNull();
  });
});
