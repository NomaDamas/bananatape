import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { HistoryEntry } from './types';

interface HistoryState {
  entries: HistoryEntry[];
  selectedId: string | null;
  addEntry: (entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => void;
  selectEntry: (id: string) => void;
  deleteEntry: (id: string) => void;
  clearHistory: () => void;
}

export const useHistoryStore = create<HistoryState>()(
  (set) => ({
    entries: [],
    selectedId: null,
    addEntry: (entry) => set((state) => {
      const newEntry: HistoryEntry = {
        ...entry,
        id: nanoid(),
        timestamp: Date.now(),
      };
      const entries = [newEntry, ...state.entries].slice(0, 20);
      return { entries, selectedId: newEntry.id };
    }),
    selectEntry: (id) => set({ selectedId: id }),
    deleteEntry: (id) => set((state) => ({
      entries: state.entries.filter((e) => e.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
    })),
    clearHistory: () => set({ entries: [], selectedId: null }),
  }),
);
