"use client";

import { useRef, useEffect } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';

export function ImageCanvas() {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const baseImage = useEditorStore((s) => s.baseImage);
  const setBaseImage = useEditorStore((s) => s.setBaseImage);

  useEffect(() => {
    if (!baseImage) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setBaseImage(baseImage, { width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = baseImage;
  }, [baseImage, setBaseImage]);

  if (!baseImage) return null;

  return (
    <img
      ref={imgRef}
      src={baseImage}
      alt="Canvas base"
      className="block select-none"
      draggable={false}
      style={{ maxWidth: 'none', maxHeight: 'none' }}
    />
  );
}
