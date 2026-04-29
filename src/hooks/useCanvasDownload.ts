"use client";

import { useCallback } from 'react';
import { useCanvasExport } from './useCanvasExport';

export function useCanvasDownload() {
  const { exportImageWithAnnotations } = useCanvasExport();

  const downloadCanvasImage = useCallback(async (imageId: string) => {
    const { annotated } = await exportImageWithAnnotations(imageId);
    const url = URL.createObjectURL(annotated);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bananatape-${imageId.slice(0, 8)}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [exportImageWithAnnotations]);

  return { downloadCanvasImage };
}
