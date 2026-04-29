import type { HistoryEntry } from '@/stores/types';
import type { CanvasImage } from '@/types/canvas';

export interface HistoryTreeSection {
  image: CanvasImage;
  entries: HistoryEntry[];
}

export function buildHistoryTree(
  images: Record<string, CanvasImage>,
  entries: HistoryEntry[],
  focusedId: string,
): HistoryTreeSection[] {
  const chain: CanvasImage[] = [];
  const visited = new Set<string>();
  let current: CanvasImage | undefined = images[focusedId];

  while (current && !visited.has(current.id)) {
    chain.push(current);
    visited.add(current.id);
    current = current.parentId ? images[current.parentId] : undefined;
  }

  return chain.reverse().map((image) => ({
    image,
    entries: entries.filter((entry) => entry.imageId === image.id),
  }));
}
