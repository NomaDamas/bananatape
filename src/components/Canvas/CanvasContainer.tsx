"use client";

import { useRef, useState, useEffect, useCallback } from 'react';
import { ImageIcon, Loader2, Sparkles } from 'lucide-react';
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
          className="relative inline-block bg-white shadow-[0_12px_40px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.05)]"
          style={{
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            transformOrigin: '0 0',
            willChange: 'transform',
          }}
        >
          <div className="absolute -top-7 left-0 flex items-center gap-1.5 whitespace-nowrap text-[10.5px] font-medium tracking-tight text-neutral-300">
            <ImageIcon className="h-3.5 w-3.5 text-[#0d99ff]" />
            Canvas frame
            {imageSize.width > 0 && imageSize.height > 0 && (
              <span className="font-mono text-[10px] text-neutral-500">
                {imageSize.width} × {imageSize.height}
              </span>
            )}
          </div>
          <ImageCanvas />
          <DrawingLayer
            containerRef={containerRef}
            imageSize={imageSize}
          />
          <MemoOverlay imageSize={imageSize} />
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
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#1e1e1e]/60 backdrop-blur-sm">
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
