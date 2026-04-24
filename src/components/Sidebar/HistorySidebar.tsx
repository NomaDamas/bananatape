"use client";

import { Clock3 } from 'lucide-react';
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
    <aside className="flex w-72 shrink-0 flex-col overflow-hidden border-l border-black bg-[#2c2c2c] text-neutral-200">
      <div className="flex h-10 items-center justify-between border-b border-[#1e1e1e] px-3.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.03em] text-white">
          History
        </h2>
        <span className="text-[10.5px] font-medium text-neutral-500">
          {entries.length} {entries.length === 1 ? 'version' : 'versions'}
        </span>
      </div>
      <ScrollArea className="flex-1" data-testid="history-timeline">
        <div className="px-2.5 py-2">
          {entries.length === 0 && (
            <div className="px-4 py-10 text-center text-neutral-500">
              <div className="mx-auto mb-3 flex h-13 w-13 items-center justify-center rounded-xl bg-white/[0.04] text-neutral-600">
                <Clock3 className="h-6 w-6" />
              </div>
              <p className="mb-1 text-xs font-medium text-neutral-300">
                No history yet
              </p>
              <p className="text-[11px] leading-5 text-neutral-500">
                Generate or edit an image to build a version timeline.
              </p>
            </div>
          )}
          {entries.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {entries.map((entry, index) => (
                <HistoryItem
                  key={entry.id}
                  entry={entry}
                  index={index}
                  total={entries.length}
                  isSelected={entry.id === selectedId}
                  onSelect={() => handleSelect(entry.id)}
                  onDelete={() => deleteEntry(entry.id)}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
