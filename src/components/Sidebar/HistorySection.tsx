"use client";

import { GitBranch } from 'lucide-react';
import { HistoryItem } from './HistoryItem';
import type { HistoryEntry } from '@/stores/types';
import type { CanvasImage } from '@/types/canvas';

interface HistorySectionProps {
  depth: number;
  image: CanvasImage;
  entries: HistoryEntry[];
  selectedId: string | null;
  onSelectEntry: (entry: HistoryEntry, image: CanvasImage) => void;
  onDeleteEntry: (id: string) => void;
}

function getImageLabel(image: CanvasImage, depth: number): string {
  if (depth === 0 || image.type === 'generate') return 'Root';
  return 'Edit';
}

export function HistorySection({ depth, image, entries, selectedId, onSelectEntry, onDeleteEntry }: HistorySectionProps) {
  return (
    <section className="relative pb-2" style={{ paddingLeft: depth * 16 }}>
      <div className="mb-2 flex items-center gap-2 rounded-lg border border-white/10 bg-[#242424] p-2">
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-black ring-1 ring-white/10">
          <img src={image.url} alt={image.prompt || getImageLabel(image, depth)} className="h-full w-full object-cover" loading="lazy" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-[#0d99ff]">
            <GitBranch className="h-3 w-3" />
            {getImageLabel(image, depth)} · Generation {depth}
          </div>
          <p className="mt-0.5 truncate text-[11px] text-neutral-400">{image.prompt || 'No prompt'}</p>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="mb-2 rounded-lg border border-dashed border-white/10 bg-black/10 px-3 py-2 text-[11px] text-neutral-500">
          No saved versions for this image yet.
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {entries.map((entry, index) => (
            <HistoryItem
              key={entry.id}
              entry={entry}
              index={index}
              total={entries.length}
              depth={depth}
              isSelected={entry.id === selectedId}
              onSelect={() => onSelectEntry(entry, image)}
              onDelete={() => onDeleteEntry(entry.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
