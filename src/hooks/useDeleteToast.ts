"use client";

import { useCallback } from 'react';
import { useToast } from '@/hooks/useToast';
import { useCanvasStore } from '@/stores/useCanvasStore';

export function useDeleteToast() {
  const { addToast } = useToast();

  return useCallback((count: number) => {
    if (count <= 0) return;
    addToast(
      count === 1 ? 'Deleted 1 image' : `Deleted ${count} images`,
      'info',
      {
        durationMs: 5000,
        action: {
          label: 'Undo',
          onClick: () => useCanvasStore.temporal.getState().undo(),
        },
      },
    );
  }, [addToast]);
}
