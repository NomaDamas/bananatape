"use client";

import { useCallback } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { overlayAnnotations } from '@/lib/canvas/annotate';
import { generateMask } from '@/lib/canvas/mask';

function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob failed'));
    }, type);
  });
}

function loadImageFromDataUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image from blob'));
    };
    img.src = url;
  });
}

async function resizeToSquare1024(blob: Blob): Promise<Blob> {
  const img = await loadImageFromBlob(blob);
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1024, 1024);

  const scale = Math.max(1024 / img.naturalWidth, 1024 / img.naturalHeight);
  const scaledWidth = img.naturalWidth * scale;
  const scaledHeight = img.naturalHeight * scale;
  const offsetX = (1024 - scaledWidth) / 2;
  const offsetY = (1024 - scaledHeight) / 2;

  ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);

  return canvasToBlob(canvas, 'image/png');
}

export function useCanvasExport() {
  const baseImage = useEditorStore((s) => s.baseImage);
  const paths = useEditorStore((s) => s.paths);
  const boxes = useEditorStore((s) => s.boxes);
  const memos = useEditorStore((s) => s.memos);
  const imageSize = useEditorStore((s) => s.imageSize);

  const exportAnnotatedImage = useCallback(async (): Promise<Blob> => {
    if (!baseImage || !imageSize.width) {
      throw new Error('No image loaded');
    }
    const img = await loadImageFromDataUrl(baseImage);
    const canvas = overlayAnnotations({
      baseImage: img,
      paths,
      boxes,
      memos,
      naturalSize: imageSize,
    });
    return canvasToBlob(canvas);
  }, [baseImage, paths, boxes, memos, imageSize]);

  const exportMask = useCallback(async (): Promise<Blob> => {
    if (!imageSize.width) {
      throw new Error('No image loaded');
    }
    const canvas = generateMask({
      paths,
      boxes,
      naturalSize: imageSize,
    });
    return canvasToBlob(canvas);
  }, [paths, boxes, imageSize]);

  return { exportAnnotatedImage, exportMask, resizeToSquare1024 };
}
