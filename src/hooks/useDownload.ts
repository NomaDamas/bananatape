"use client";

import { useCallback } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';

export function useDownload() {
  const baseImage = useEditorStore((s) => s.baseImage);

  const downloadImage = useCallback(() => {
    if (!baseImage) return;

    const link = document.createElement('a');
    link.href = baseImage;
    link.download = `codexdesign-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [baseImage]);

  return { downloadImage };
}
