"use client";

import { ScrollArea } from '@/components/ui/scroll-area';
import { useHistoryStore } from '@/stores/useHistoryStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { HistoryItem } from './HistoryItem';

export function HistorySidebar() {
  const entries = useHistoryStore((s) => s.entries);
  const selectedId = useHistoryStore((s) => s.selectedId);
  const selectEntry = useHistoryStore((s) => s.selectEntry);
  const deleteEntry = useHistoryStore((s) => s.deleteEntry);
  const setBaseImage = useEditorStore((s) => s.setBaseImage);

  const handleSelect = (id: string) => {
    const entry = entries.find((e) => e.id === id);
    if (entry) {
      selectEntry(id);
      setBaseImage(entry.imageDataUrl, { width: 0, height: 0 });
    }
  };

  return (
    <div className="w-72 border-l border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex flex-col shrink-0">
      <div className="h-10 border-b border-neutral-200 dark:border-neutral-800 flex items-center px-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          History
        </h2>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {entries.length === 0 && (
            <p className="text-xs text-neutral-400 text-center py-8">
              No history yet. Generate or edit an image to see it here.
            </p>
          )}
          {entries.map((entry) => (
            <HistoryItem
              key={entry.id}
              entry={entry}
              isSelected={entry.id === selectedId}
              onSelect={() => handleSelect(entry.id)}
              onDelete={() => deleteEntry(entry.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
