"use client";

import { useCallback } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { useCanvasStore } from '@/stores/useCanvasStore';
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

async function resizeToSize(blob: Blob, width: number, height: number): Promise<Blob> {
  const img = await loadImageFromBlob(blob);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
  const scaledWidth = img.naturalWidth * scale;
  const scaledHeight = img.naturalHeight * scale;
  const offsetX = (width - scaledWidth) / 2;
  const offsetY = (height - scaledHeight) / 2;

  ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);

  return canvasToBlob(canvas, 'image/png');
}

async function resizeToSquare1024(blob: Blob): Promise<Blob> {
  return resizeToSize(blob, 1024, 1024);
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

  const exportImageWithAnnotations = useCallback(async (imageId: string): Promise<{
    original: Blob;
    annotated: Blob;
    mask: Blob;
    size: { width: number; height: number };
  }> => {
    const image = useCanvasStore.getState().images[imageId];
    if (!image) {
      throw new Error(`Canvas image ${imageId} was not found`);
    }
    if (!image.url) {
      throw new Error(`Canvas image ${imageId} does not have source pixels`);
    }

    const response = await fetch(image.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch pixels for canvas image ${imageId}`);
    }

    const original = await response.blob();
    const baseImage = await loadImageFromBlob(original);
    const naturalSize = image.size.width > 0 && image.size.height > 0
      ? image.size
      : { width: baseImage.naturalWidth, height: baseImage.naturalHeight };

    const annotatedCanvas = overlayAnnotations({
      baseImage,
      paths: image.paths,
      boxes: image.boxes,
      memos: image.memos,
      naturalSize,
    });
    const maskCanvas = generateMask({
      paths: image.paths,
      boxes: image.boxes,
      naturalSize,
    });

    return {
      original,
      annotated: await canvasToBlob(annotatedCanvas),
      mask: await canvasToBlob(maskCanvas),
      size: naturalSize,
    };
  }, []);

  return { exportAnnotatedImage, exportMask, exportImageWithAnnotations, resizeToSquare1024, resizeToSize };
}
