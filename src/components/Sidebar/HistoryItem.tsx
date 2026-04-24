"use client";

import { useState } from 'react';
import type { HistoryEntry } from '@/stores/types';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface HistoryItemProps {
  entry: HistoryEntry;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

export function HistoryItem({ entry, isSelected, onSelect, onDelete }: HistoryItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`group relative rounded-md border cursor-pointer transition-colors ${
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
          : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
      }`}
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative aspect-video overflow-hidden rounded-t-md bg-neutral-100 dark:bg-neutral-900">
        <img
          src={entry.imageDataUrl}
          alt={entry.prompt.slice(0, 50)}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {(isHovered || isSelected) && (
          <button
            className="absolute top-1 right-1 p-1 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(e);
            }}
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="p-2">
        <p className="text-xs text-neutral-700 dark:text-neutral-300 line-clamp-2 leading-snug">
          {entry.prompt}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <Badge variant="outline" className="text-[9px] h-4 px-1">
            {entry.type}
          </Badge>
          <Badge variant="secondary" className="text-[9px] h-4 px-1">
            {entry.provider}
          </Badge>
          <span className="text-[9px] text-neutral-400 ml-auto">
            {new Date(entry.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
