"use client";

import { useRef, useState, useEffect, useCallback } from 'react';
import { ImageIcon, Loader2, Sparkles } from 'lucide-react';
import { CanvasMultiContainer } from './CanvasMultiContainer';
import { useDeleteToast } from '@/hooks/useDeleteToast';
import { useParallelGenerate } from '@/hooks/useParallelGenerate';
import { useCanvasStore } from '@/stores/useCanvasStore';
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

  const isGenerating = useEditorStore((s) => s.isGenerating);
  const activeTool = useEditorStore((s) => s.activeTool);
  const isSpacePressed = useEditorStore((s) => s.isSpacePressed);
  const imageOrderLength = useCanvasStore((s) => s.imageOrder.length);
  const panX = useCanvasStore((s) => s.viewport.panX);
  const panY = useCanvasStore((s) => s.viewport.panY);
  const zoom = useCanvasStore((s) => s.viewport.zoom);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const clearSelection = useCanvasStore((s) => s.clearSelection);
  const deleteImage = useCanvasStore((s) => s.deleteImage);
  const { generate, cancel } = useParallelGenerate();
  const showDeleteToast = useDeleteToast();

  const effectivePan = isSpacePressed || activeTool === 'pan';

  const updateRect = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setContainerRect(rect);
      setViewport({ width: rect.width, height: rect.height });
    }
  }, [setViewport]);

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

    setViewport({ zoom: newZoom, panX: newPanX, panY: newPanY });
  }, [containerRect, zoom, panX, panY, setViewport]);

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
    setViewport({ panX: dragStartRef.current.panX + dx, panY: dragStartRef.current.panY + dy });
  }, [isDragging, setViewport]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const cursor = effectivePan
    ? (isDragging ? 'grabbing' : 'grab')
    : 'default';

  const hasImage = imageOrderLength > 0;

  const handleDeleteImage = useCallback((id: string) => {
    cancel(id);
    const exists = Boolean(useCanvasStore.getState().images[id]);
    if (exists) {
      deleteImage(id);
      showDeleteToast(1);
    }
  }, [cancel, deleteImage, showDeleteToast]);

  const handleRetryImage = useCallback((id: string) => {
    const image = useCanvasStore.getState().images[id];
    if (!image) return;
    deleteImage(id);
    void generate({ count: 1, prompt: image.prompt, parentIds: image.parentId ? [image.parentId] : [] });
  }, [deleteImage, generate]);

  return (
    <div
      ref={containerRef}
      data-testid="canvas-container"
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onClick={(event) => {
        if (event.target === event.currentTarget) clearSelection();
      }}
      className={`relative overflow-hidden bg-[#1e1e1e] text-neutral-200 ${className || ''}`}
      style={{ cursor, touchAction: 'none' }}
    >
      <div
        data-testid="canvas-dot-grid"
        className="pointer-events-none absolute inset-0 opacity-100 [background-image:radial-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:20px_20px]"
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04),transparent_55%)]" />

      {hasImage && (
        <div
          data-testid="transform-wrapper"
          data-zoom={zoom}
          data-pan-x={panX}
          data-pan-y={panY}
          className="relative h-[1px] w-[1px]"
          style={{
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            transformOrigin: '0 0',
            willChange: 'transform',
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) clearSelection();
          }}
        >
          <div className="absolute -top-7 left-0 flex items-center gap-1.5 whitespace-nowrap text-[10.5px] font-medium tracking-tight text-neutral-300">
            <ImageIcon className="h-3.5 w-3.5 text-[#0d99ff]" />
            Infinite canvas
            <span className="font-mono text-[10px] text-neutral-500">{imageOrderLength} image{imageOrderLength === 1 ? '' : 's'}</span>
          </div>
          <CanvasMultiContainer onDeleteImage={handleDeleteImage} onRetryImage={handleRetryImage} />
        </div>
      )}

      {!hasImage && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-5 pb-64 text-center text-neutral-500">
          <div className="mb-5 flex h-22 w-22 items-center justify-center rounded-2xl border border-neutral-700 bg-gradient-to-br from-[#2c2c2c] to-[#3b3b3b] text-neutral-500 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
            <ImageIcon className="h-9 w-9" />
          </div>
          <h2 className="mb-2 text-lg font-semibold tracking-tight text-neutral-200">No image loaded</h2>
          <p className="max-w-sm text-sm leading-6 text-neutral-400">
            Describe what you want to create, or attach a reference image to start a new canvas.
          </p>
          <div className="mt-5 flex items-center gap-2 text-xs text-neutral-500">
            <kbd className="rounded border border-neutral-700 bg-[#2c2c2c] px-1.5 py-1 font-mono text-[10px] text-neutral-300">⌘</kbd>
            <kbd className="rounded border border-neutral-700 bg-[#2c2c2c] px-1.5 py-1 font-mono text-[10px] text-neutral-300">Enter</kbd>
            <span>to generate</span>
          </div>
        </div>
      )}

      {isGenerating && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-50 flex -translate-x-1/2 items-center justify-center">
          <div className="flex items-center gap-4 rounded-[10px] border border-neutral-700 bg-[#2c2c2c] px-6 py-4 shadow-[0_16px_48px_rgba(0,0,0,0.5)]">
            <Loader2 className="h-6 w-6 animate-spin text-[#0d99ff]" />
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Sparkles className="h-3.5 w-3.5 text-[#0d99ff]" />
                Generating image...
              </div>
              <p className="mt-1 text-xs text-neutral-400">BananaTape is rendering your prompt.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
