import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { HistoryEntry } from './types';

export interface HistoryState {
  entries: HistoryEntry[];
  selectedId: string | null;
  addEntry: (entry: Omit<HistoryEntry, 'id' | 'timestamp'> & Partial<Pick<HistoryEntry, 'id' | 'timestamp'>>) => void;
  hydrateEntries: (entries: HistoryEntry[]) => void;
  selectEntry: (id: string) => void;
  deleteEntry: (id: string) => void;
  clearHistory: () => void;
}

export function selectEntriesForImage(state: HistoryState, imageId: string | null): HistoryEntry[] {
  if (imageId === null) return [];
  return state.entries.filter((e) => e.imageId === imageId);
}

export const useHistoryStore = create<HistoryState>()(
  (set) => ({
    entries: [],
    selectedId: null,
    addEntry: (entry) => set((state) => {
      const newEntry: HistoryEntry = {
        ...entry,
        id: entry.id ?? nanoid(),
        timestamp: entry.timestamp ?? Date.now(),
      };
      const entries = [newEntry, ...state.entries].slice(0, 20);
      return { entries, selectedId: newEntry.id };
    }),
    hydrateEntries: (entries) => set({ entries, selectedId: entries[0]?.id ?? null }),
    selectEntry: (id) => set({ selectedId: id }),
    deleteEntry: (id) => set((state) => ({
      entries: state.entries.filter((e) => e.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
    })),
    clearHistory: () => set({ entries: [], selectedId: null }),
  }),
);
