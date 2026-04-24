"use client";

import { useRef, useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { ImageCanvas } from './ImageCanvas';
import { DrawingLayer } from './DrawingLayer';
import { MemoOverlay } from './MemoOverlay';
import { useEditorStore } from '@/stores/useEditorStore';

interface CanvasContainerProps {
  className?: string;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_FACTOR = 1.15;

export function CanvasContainer({ className }: CanvasContainerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const imageSize = useEditorStore((s) => s.imageSize);
  const baseImage = useEditorStore((s) => s.baseImage);
  const isGenerating = useEditorStore((s) => s.isGenerating);
  const zoom = useEditorStore((s) => s.zoom);
  const panX = useEditorStore((s) => s.panX);
  const panY = useEditorStore((s) => s.panY);
  const setZoom = useEditorStore((s) => s.setZoom);
  const setPan = useEditorStore((s) => s.setPan);
  const activeTool = useEditorStore((s) => s.activeTool);
  const isSpacePressed = useEditorStore((s) => s.isSpacePressed);

  const effectivePan = isSpacePressed || activeTool === 'pan';

  const updateRect = useCallback(() => {
    if (containerRef.current) {
      setContainerRect(containerRef.current.getBoundingClientRect());
    }
  }, []);

  useEffect(() => {
    updateRect();
    const observer = new ResizeObserver(updateRect);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener('resize', updateRect);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateRect);
    };
  }, [updateRect]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRect) return;

    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;

    const factor = Math.pow(ZOOM_FACTOR, -e.deltaY / 100);
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));

    const imageX = (mouseX - panX) / zoom;
    const imageY = (mouseY - panY) / zoom;
    const newPanX = mouseX - imageX * newZoom;
    const newPanY = mouseY - imageY * newZoom;

    setZoom(newZoom);
    setPan(newPanX, newPanY);
  }, [containerRect, zoom, panX, panY, setZoom, setPan]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!effectivePan) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX,
      panY,
    };
  }, [effectivePan, panX, panY]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan(dragStartRef.current.panX + dx, dragStartRef.current.panY + dy);
  }, [isDragging, setPan]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const cursor = effectivePan
    ? (isDragging ? 'grabbing' : 'grab')
    : 'default';

  const hasImage = !!baseImage;

  return (
    <div
      ref={containerRef}
      data-testid="canvas-container"
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className={`relative overflow-hidden bg-neutral-50 dark:bg-neutral-950 ${className || ''}`}
      style={{ cursor, touchAction: 'none' }}
    >
      {hasImage && (
        <div
          data-testid="transform-wrapper"
          data-zoom={zoom}
          data-pan-x={panX}
          data-pan-y={panY}
          style={{
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            transformOrigin: '0 0',
            willChange: 'transform',
          }}
        >
          <ImageCanvas />
          <DrawingLayer
            containerRef={containerRef}
            imageSize={imageSize}
          />
          <MemoOverlay imageSize={imageSize} />
        </div>
      )}

      {!hasImage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-neutral-400 text-sm">No image loaded</p>
        </div>
      )}

      {isGenerating && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 dark:bg-black/60 z-50">
          <Loader2 className="w-10 h-10 animate-spin text-neutral-700 dark:text-neutral-300" />
          <span className="mt-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Generating image...
          </span>
        </div>
      )}
    </div>
  );
}
