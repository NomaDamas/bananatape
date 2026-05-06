"use client";

import { useCallback } from 'react';
import { useCanvasStore } from '@/stores/useCanvasStore';
import { useCanvasDownload } from './useCanvasDownload';

export function useDownload() {
  const focusedImageIds = useCanvasStore((s) => s.focusedImageIds);
  const { downloadCanvasImage } = useCanvasDownload();

  const downloadImage = useCallback(() => {
    const imageId = focusedImageIds[0];
    if (!imageId) return;
    void downloadCanvasImage(imageId);
  }, [downloadCanvasImage, focusedImageIds]);

  return { downloadImage };
}
