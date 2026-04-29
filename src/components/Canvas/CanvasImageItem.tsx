"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Loader2, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CanvasContextMenu } from './CanvasContextMenu';
import { useCanvasDrawingPerImage } from '@/hooks/useCanvasDrawingPerImage';
import { useImageDrag } from '@/hooks/useImageDrag';
import {
  ACTIVE_BOX_STROKE_WIDTH,
  createCanvasMapper,
  drawAnnotationPath,
  drawBoundingBox,
  estimateStickyMemoSize,
  STICKY_MEMO_FONT_SIZE,
  STICKY_MEMO_LINE_HEIGHT,
} from '@/lib/canvas/annotation-rendering';
import { cn } from '@/lib/utils';
import { useCanvasStore } from '@/stores/useCanvasStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { DEFAULT_PLACEHOLDER_LAYOUT, type CanvasImage } from '@/types/canvas';

interface CanvasImageItemProps {
  image: CanvasImage;
  isFocused: boolean;
  isSelected: boolean;
  isVisible: boolean;
  onSelect: (id: string, additive: boolean) => void;
  onCheckboxToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
}

function getImageSize(image: CanvasImage) {
  return image.size.width > 0 && image.size.height > 0 ? image.size : DEFAULT_PLACEHOLDER_LAYOUT;
}

function ScopedDrawingLayer({ image }: { image: CanvasImage }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeTool = useEditorStore((s) => s.activeTool);
  const isSpacePressed = useEditorStore((s) => s.isSpacePressed);
  const toolColor = useEditorStore((s) => s.toolColor);
  const { onPointerDown, onPointerMove, onPointerUp, activeBox, activePath } = useCanvasDrawingPerImage({ imageId: image.id, imageSize: image.size });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || image.size.width === 0 || image.size.height === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, image.size.width, image.size.height);
    const toCanvas = createCanvasMapper(image.size);
    image.paths.forEach((path) => drawAnnotationPath(ctx, path, toCanvas));
    if (activePath && activePath.points.length >= 2) drawAnnotationPath(ctx, activePath, toCanvas);
    image.boxes.forEach((box) => drawBoundingBox(ctx, box, image.size));
    if (activeBox) {
      drawBoundingBox(ctx, {
        x: Math.min(activeBox.start.x, activeBox.current.x),
        y: Math.min(activeBox.start.y, activeBox.current.y),
        width: Math.abs(activeBox.current.x - activeBox.start.x),
        height: Math.abs(activeBox.current.y - activeBox.start.y),
        color: toolColor,
      }, image.size, { dashed: true, lineWidth: ACTIVE_BOX_STROKE_WIDTH });
    }
  }, [activeBox, activePath, image.boxes, image.paths, image.size, toolColor]);

  const isPanning = activeTool === 'pan' || activeTool === 'move' || isSpacePressed;

  return (
    <canvas
      ref={canvasRef}
      width={image.size.width}
      height={image.size.height}
      className="absolute inset-0"
      style={{ width: image.size.width, height: image.size.height, pointerEvents: isPanning ? 'none' : 'auto', cursor: isPanning ? 'inherit' : 'crosshair', touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  );
}

function ScopedMemoOverlay({ image, isFocused }: { image: CanvasImage; isFocused: boolean }) {
  const activeMemoId = useEditorStore((s) => s.activeMemoId);
  const setActiveMemoId = useEditorStore((s) => s.setActiveMemoId);

  const handleBlur = useCallback((id: string, text: string) => {
    if (!text.trim()) useCanvasStore.getState().removeMemoFromImage(image.id, id);
    setActiveMemoId(null);
  }, [image.id, setActiveMemoId]);

  if (image.size.width === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0">
      {image.memos.map((memo) => {
        const isActive = memo.id === activeMemoId;
        const memoSize = estimateStickyMemoSize(memo.text);
        return (
          <div key={memo.id} data-testid="sticky-memo" className="pointer-events-auto absolute" style={{ left: memo.x * image.size.width, top: memo.y * image.size.height, zIndex: isActive ? 50 : 10 }}>
            <div className="rounded-lg border border-yellow-500/60 shadow-lg transition-[width,height] duration-100" style={{ backgroundColor: memo.color, width: memoSize.width }}>
              <textarea
                autoFocus={isFocused && isActive}
                value={memo.text}
                spellCheck={false}
                className="w-full resize-none bg-transparent p-3 text-neutral-950 placeholder-yellow-700 outline-none"
                rows={memoSize.rows}
                style={{ minHeight: memoSize.height, fontSize: STICKY_MEMO_FONT_SIZE, lineHeight: `${STICKY_MEMO_LINE_HEIGHT}px` }}
                placeholder="Write edit note..."
                onChange={(event) => useCanvasStore.getState().updateMemoOnImage(image.id, memo.id, { text: event.target.value })}
                onBlur={(event) => handleBlur(memo.id, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    handleBlur(memo.id, (event.target as HTMLTextAreaElement).value);
                  }
                  if (event.key === 'Escape') handleBlur(memo.id, (event.target as HTMLTextAreaElement).value);
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CanvasImageItem({ image, isFocused, isSelected, isVisible, onSelect, onCheckboxToggle, onDelete, onRetry }: CanvasImageItemProps) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const size = getImageSize(image);
  const activeTool = useEditorStore((s) => s.activeTool);
  const moveEnabled = activeTool === 'move';
  const drag = useImageDrag(image, { enabled: moveEnabled });
  const suppressClickRef = useRef(false);

  const effectivePosition = drag.livePosition ?? image.position;

  const handleBodyClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onSelect(image.id, event.shiftKey || event.metaKey || event.ctrlKey);
  }, [image.id, onSelect]);

  const handlePointerUp = useCallback((event: React.PointerEvent) => {
    if (drag.didMove) {
      suppressClickRef.current = true;
    }
    drag.onPointerUp(event);
  }, [drag]);

  const shellClass = cn(
    'group absolute overflow-hidden rounded-xl bg-[#141414] shadow-[0_18px_50px_rgba(0,0,0,0.35)] transition-shadow',
    isFocused ? 'ring-4 ring-[#0d99ff]' : isSelected ? 'ring-2 ring-[#5bb8ff]' : 'ring-1 ring-white/10 hover:ring-white/25',
  );

  const moveCursor = moveEnabled ? (drag.isDragging ? 'grabbing' : 'grab') : undefined;

  return (
    <div
      className={shellClass}
      data-canvas-image-id={image.id}
      style={{
        left: effectivePosition.x,
        top: effectivePosition.y,
        width: size.width,
        height: size.height,
        contentVisibility: 'auto',
        containIntrinsicSize: `${size.width}px ${size.height}px`,
        cursor: moveCursor,
        touchAction: moveEnabled ? 'none' : undefined,
      }}
      onClick={handleBodyClick}
      onPointerDown={moveEnabled ? drag.onPointerDown : undefined}
      onPointerMove={moveEnabled ? drag.onPointerMove : undefined}
      onPointerUp={moveEnabled ? handlePointerUp : undefined}
      onPointerCancel={moveEnabled ? drag.onPointerCancel : undefined}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setMenu({ x: event.clientX, y: event.clientY });
      }}
    >
      {!isVisible && <div className="h-full w-full bg-[#202020] [background-image:linear-gradient(135deg,rgba(255,255,255,0.04)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.04)_50%,rgba(255,255,255,0.04)_75%,transparent_75%,transparent)] [background-size:22px_22px]" />}

      {isVisible && image.status === 'pending' && (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#1c1c1c] text-center text-neutral-300">
          <Loader2 className="h-8 w-8 animate-spin text-[#0d99ff]" />
          <div>
            <p className="text-sm font-semibold">Generating with {image.provider === 'god-tibo' ? 'codex' : 'OpenAI'}</p>
            <p className="mt-1 max-w-72 truncate text-xs text-neutral-500">{image.prompt}</p>
          </div>
        </div>
      )}

      {isVisible && image.status === 'error' && (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-red-950/30 p-6 text-center">
          <div className="rounded-full border border-red-400/30 bg-red-500/15 p-3 text-red-200"><X className="h-6 w-6" /></div>
          <div>
            <p className="text-sm font-semibold text-red-100">Generation failed</p>
            <p className="mt-1 line-clamp-3 text-xs text-red-200/70">{image.error ?? 'Unknown error'}</p>
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={(event) => { event.stopPropagation(); onRetry(image.id); }}>
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      )}

      {isVisible && (image.status === 'ready' || image.status === 'streaming') && (
        <>
          <img src={image.url} alt={image.prompt || 'Canvas image'} className="block select-none" style={{ width: size.width, height: size.height, maxWidth: 'none', maxHeight: 'none' }} decoding="async" loading="lazy" draggable={false} />
          {isFocused && <ScopedDrawingLayer image={image} />}
          <ScopedMemoOverlay image={image} isFocused={isFocused} />
        </>
      )}

      <label
        className="absolute left-2 top-2 z-40 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-white/15 bg-black/55 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 has-[:checked]:opacity-100"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <input type="checkbox" className="peer sr-only" checked={isSelected} onChange={() => onCheckboxToggle(image.id)} />
        <span className="flex h-4 w-4 items-center justify-center rounded border border-white/45 bg-black/30 peer-checked:border-[#0d99ff] peer-checked:bg-[#0d99ff]">
          {isSelected && <Check className="h-3 w-3" />}
        </span>
      </label>

      <button
        type="button"
        className="absolute right-2 top-2 z-40 flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white opacity-0 backdrop-blur transition-opacity hover:bg-red-500 group-hover:opacity-100"
        onClick={(event) => { event.stopPropagation(); onDelete(image.id); }}
        onPointerDown={(event) => event.stopPropagation()}
        aria-label="Delete image"
      >
        <X className="h-4 w-4" />
      </button>

      <CanvasContextMenu open={menu !== null} x={menu?.x ?? 0} y={menu?.y ?? 0} onClose={() => setMenu(null)} onDelete={() => onDelete(image.id)} />
    </div>
  );
}
