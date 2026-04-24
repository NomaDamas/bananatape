"use client";

import { useRef, useCallback, useState } from 'react';
import type { ImageSize } from '@/types';

interface UseCanvasImageReturn {
  imageRef: React.RefObject<HTMLImageElement | null>;
  imageSize: ImageSize;
  loadImage: (url: string) => Promise<void>;
  clearImage: () => void;
  drawToCanvas: (ctx: CanvasRenderingContext2D, destWidth: number, destHeight: number) => void;
}

export function useCanvasImage(): UseCanvasImageReturn {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imageSize, setImageSize] = useState<ImageSize>({ width: 0, height: 0 });

  const loadImage = useCallback(async (url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imageRef.current = img;
        setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
        resolve();
      };
      img.onerror = reject;
      img.src = url;
    });
  }, []);

  const clearImage = useCallback(() => {
    imageRef.current = null;
    setImageSize({ width: 0, height: 0 });
  }, []);

  const drawToCanvas = useCallback(
    (ctx: CanvasRenderingContext2D, destWidth: number, destHeight: number) => {
      const img = imageRef.current;
      if (!img || !img.complete) return;

      const scale = Math.min(destWidth / img.naturalWidth, destHeight / img.naturalHeight, 1);
      const drawWidth = img.naturalWidth * scale;
      const drawHeight = img.naturalHeight * scale;
      const x = (destWidth - drawWidth) / 2;
      const y = (destHeight - drawHeight) / 2;

      ctx.drawImage(img, x, y, drawWidth, drawHeight);
    },
    []
  );

  return { imageRef, imageSize, loadImage, clearImage, drawToCanvas };
}
