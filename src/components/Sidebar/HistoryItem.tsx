"use client";

import { useState } from 'react';
import type { HistoryEntry } from '@/stores/types';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles, Wand2, X } from 'lucide-react';

interface HistoryItemProps {
  entry: HistoryEntry;
  index: number;
  total: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

function formatProvider(provider: HistoryEntry['provider']) {
  return provider === 'god-tibo' ? 'codex' : 'OpenAI';
}

export function HistoryItem({ entry, index, total, isSelected, onSelect, onDelete }: HistoryItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const TypeIcon = entry.type === 'edit' ? Wand2 : Sparkles;

  return (
    <div className="flex items-stretch gap-2" data-testid="history-timeline-row">
      <div className="flex w-3.5 shrink-0 flex-col items-center">
        <div className={`w-0.5 flex-1 bg-[#3b3b3b] ${isFirst ? 'opacity-0' : ''}`} />
        <div
          className={`flex h-3 w-3 shrink-0 items-center justify-center rounded-full border-2 bg-[#2c2c2c] ${
            isSelected
              ? 'border-[#0d99ff] shadow-[0_0_0_3px_rgba(13,153,255,0.2)]'
              : 'border-neutral-500'
          }`}
          aria-hidden="true"
        >
          <span className={`h-1 w-1 rounded-full ${isSelected ? 'bg-[#0d99ff]' : 'bg-neutral-500'}`} />
        </div>
        <div className={`w-0.5 flex-1 bg-[#3b3b3b] ${isLast ? 'opacity-0' : ''}`} />
      </div>

      <div
        className={`group relative flex-1 cursor-pointer overflow-hidden rounded-lg border bg-[#1e1e1e] transition-colors ${
          isSelected
            ? 'border-[#0d99ff] shadow-[0_0_0_1px_#0d99ff,0_4px_20px_rgba(13,153,255,0.18)]'
            : 'border-transparent hover:border-neutral-600'
        }`}
        onClick={onSelect}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {isSelected && <div className="absolute inset-x-0 top-0 z-10 h-0.5 bg-[#0d99ff]" />}
        <div className="relative aspect-[4/5] overflow-hidden bg-black">
          <img
            src={entry.imageDataUrl}
            alt={entry.prompt.slice(0, 50)}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          {isSelected && (
            <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[10px] font-medium text-white backdrop-blur">
              <Check className="h-3 w-3 text-[#0d99ff]" />
              Viewing
            </div>
          )}
          {(isHovered || isSelected) && (
            <button
              className="absolute right-2 top-2 rounded bg-black/60 p-1 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 focus:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(e);
              }}
              aria-label="Delete history entry"
              title="Delete history entry"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="space-y-2 p-2.5">
          <p className="line-clamp-2 text-[11.5px] leading-snug text-neutral-300">
            {entry.prompt}
          </p>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="h-5 border-neutral-700 bg-transparent px-1.5 text-[9px] uppercase text-neutral-300">
              <TypeIcon className="mr-1 h-2.5 w-2.5" />
              {entry.type}
            </Badge>
            <Badge variant="secondary" className="h-5 bg-neutral-800 px-1.5 text-[9px] text-neutral-300">
              {formatProvider(entry.provider)}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-[10px] text-neutral-500">
            <span>v{total - index}</span>
            <time dateTime={new Date(entry.timestamp).toISOString()}>
              {new Date(entry.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
          </div>
        </div>
      </div>
    </div>
  );
}
