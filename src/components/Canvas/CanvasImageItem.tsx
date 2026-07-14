"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { EyeOff, Loader2, RefreshCw, Wand2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CanvasContextMenu } from './CanvasContextMenu';
import { useCanvasDrawingPerImage } from '@/hooks/useCanvasDrawingPerImage';
import { useImageDrag } from '@/hooks/useImageDrag';
import { hasMagicLayerChanges } from '@/lib/canvas/magic-layer-changes';
import { useMagicLayerApply } from '@/hooks/useMagicLayerApply';
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
import { DEFAULT_PLACEHOLDER_LAYOUT, type CanvasImage, type MagicLayer } from '@/types/canvas';

interface CanvasImageItemProps {
  image: CanvasImage;
  isFocused: boolean;
  isVisible: boolean;
  onFocus: (id: string, additive: boolean) => void;
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
  const memoEditSnapshotsRef = useRef<Record<string, CanvasImage>>({});

  const rememberMemoSnapshot = useCallback((id: string) => {
    if (memoEditSnapshotsRef.current[id]) return;
    const current = useCanvasStore.getState().images[image.id];
    if (!current) return;
    const memo = current.memos.find((item) => item.id === id);
    if (!memo?.text.trim()) return;
    memoEditSnapshotsRef.current[id] = current;
  }, [image.id]);

  const handleBlur = useCallback((id: string, text: string) => {
    const snapshot = memoEditSnapshotsRef.current[id];
    delete memoEditSnapshotsRef.current[id];

    if (!text.trim()) {
      useCanvasStore.getState().removeMemoFromImage(image.id, id, snapshot ? { historySnapshot: snapshot } : undefined);
      setActiveMemoId(null);
      return;
    }

    if (snapshot) {
      useCanvasStore.getState().commitMemoTextOnImage(image.id, id, text, { historySnapshot: snapshot });
    }
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
	                autoCorrect="off"
	                autoCapitalize="off"
	                data-gramm="false"
	                data-gramm_editor="false"
	                data-enable-grammarly="false"
	                className="w-full resize-none bg-transparent p-3 text-neutral-950 placeholder-yellow-700 outline-none"
                rows={memoSize.rows}
                style={{ minHeight: memoSize.height, fontSize: STICKY_MEMO_FONT_SIZE, lineHeight: `${STICKY_MEMO_LINE_HEIGHT}px` }}
                placeholder="Write edit note..."
                onFocus={() => rememberMemoSnapshot(memo.id)}
                onChange={(event) => useCanvasStore.getState().updateMemoOnImage(image.id, memo.id, { text: event.target.value }, { track: false })}
                onBlur={(event) => handleBlur(memo.id, event.target.value)}
	                onKeyDown={(event) => {
	                  if (event.key === 'Enter' && !event.shiftKey) {
	                    event.preventDefault();
	                    handleBlur(memo.id, (event.target as HTMLTextAreaElement).value);
	                    (event.target as HTMLTextAreaElement).blur();
	                  }
	                  if (event.key === 'Escape') {
	                    handleBlur(memo.id, (event.target as HTMLTextAreaElement).value);
	                    (event.target as HTMLTextAreaElement).blur();
	                  }
	                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}


function MagicLayerOverlay({ image, enabled }: { image: CanvasImage; enabled: boolean }) {
  const [draggingLayerId, setDraggingLayerId] = useState<string | null>(null);
  const [livePositions, setLivePositions] = useState<Record<string, { x: number; y: number }>>({});
  const livePositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  const dragStartRef = useRef<{ layerId: string; pointerId: number; clientX: number; clientY: number; startX: number; startY: number } | null>(null);
  const layers = image.magicLayers ?? [];

  const { apply } = useMagicLayerApply();
  const [isApplying, setIsApplying] = useState(false);
  const changesPending = hasMagicLayerChanges(image);
  const canApply = enabled && changesPending && image.status === 'ready' && !isApplying;
  const handleApply = useCallback(async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!canApply) return;
    setIsApplying(true);
    try {
      await apply(image.id);
    } finally {
      setIsApplying(false);
    }
  }, [apply, canApply, image.id]);

  const startDrag = useCallback((event: React.PointerEvent, layer: MagicLayer) => {
    if (!enabled || layer.hidden) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is unavailable in some test environments.
    }
    useCanvasStore.getState().selectMagicLayer(image.id, layer.id);
    dragStartRef.current = {
      layerId: layer.id,
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      startX: layer.position.x,
      startY: layer.position.y,
    };
    setDraggingLayerId(layer.id);
  }, [enabled, image.id]);

  const moveDrag = useCallback((event: React.PointerEvent) => {
    const start = dragStartRef.current;
    if (!start || event.pointerId !== start.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const zoom = useCanvasStore.getState().viewport.zoom || 1;
    const next = {
      x: start.startX + (event.clientX - start.clientX) / zoom,
      y: start.startY + (event.clientY - start.clientY) / zoom,
    };
    livePositionsRef.current = { ...livePositionsRef.current, [start.layerId]: next };
    setLivePositions(livePositionsRef.current);
  }, []);

  const endDrag = useCallback((event: React.PointerEvent) => {
    const start = dragStartRef.current;
    if (!start || event.pointerId !== start.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // See pointerdown.
    }
    const finalPosition = livePositionsRef.current[start.layerId];
    if (finalPosition) {
      useCanvasStore.getState().updateMagicLayer(image.id, start.layerId, { position: finalPosition });
    }
    dragStartRef.current = null;
    setDraggingLayerId(null);
    const nextLivePositions = { ...livePositionsRef.current };
    delete nextLivePositions[start.layerId];
    livePositionsRef.current = nextLivePositions;
    setLivePositions(nextLivePositions);
  }, [image.id]);

  if (layers.length === 0) return null;

  return (
    <div className="absolute inset-0" data-testid="magic-layer-overlay" style={{ pointerEvents: enabled ? 'auto' : 'none' }}>
      {layers.map((layer) => {
        if (layer.hidden) return null;
        const isSelected = image.selectedMagicLayerId === layer.id;
        const position = livePositions[layer.id] ?? layer.position;
        return (
          <div
            key={layer.id}
            data-testid="magic-layer-item"
            data-magic-layer-id={layer.id}
            className={cn(
              'group/magic absolute rounded-md',
              isSelected ? 'ring-2 ring-fuchsia-400 ring-offset-2 ring-offset-transparent' : enabled ? 'hover:ring-2 hover:ring-white/80' : '',
            )}
            style={{
              left: position.x,
              top: position.y,
              width: layer.sourceBounds.width,
              height: layer.sourceBounds.height,
              cursor: enabled ? (draggingLayerId === layer.id ? 'grabbing' : 'grab') : undefined,
              touchAction: enabled ? 'none' : undefined,
            }}
            title={layer.name}
            onPointerDown={(event) => startDrag(event, layer)}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <img src={layer.cutoutDataUrl} alt={layer.name} className="block h-full w-full select-none object-contain" draggable={false} />
            {enabled && isSelected && (
              <button
                type="button"
                aria-label={`Hide ${layer.name}`}
                className="absolute -right-2 -top-2 z-50 flex h-6 w-6 items-center justify-center rounded-full bg-fuchsia-600 text-white shadow-lg"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  useCanvasStore.getState().hideMagicLayer(image.id, layer.id);
                }}
              >
                <EyeOff className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      })}
      {enabled && (changesPending || isApplying) && (
        <button
          type="button"
          data-testid="magic-layer-apply"
          aria-label="Apply Magic Layer changes"
          disabled={!canApply}
          onClick={handleApply}
          className={cn(
            'absolute right-11 top-2 z-50 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-xl ring-1 ring-fuchsia-300/40 backdrop-blur transition-all',
            canApply
              ? 'bg-fuchsia-600 text-white hover:bg-fuchsia-500 hover:shadow-fuchsia-500/30'
              : 'bg-fuchsia-600/60 text-white/80 cursor-not-allowed opacity-60',
          )}
        >
          {isApplying ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Applying…
            </>
          ) : (
            <>
              <Wand2 className="h-3.5 w-3.5" />
              Apply
            </>
          )}
        </button>
      )}
    </div>
  );
}

export function CanvasImageItem({ image, isFocused, isVisible, onFocus, onDelete, onRetry }: CanvasImageItemProps) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const size = getImageSize(image);
  const activeTool = useEditorStore((s) => s.activeTool);
  const moveEnabled = activeTool === 'move';
  const magicLayerEnabled = activeTool === 'magic-layer' && isFocused;
  const drag = useImageDrag(image, { enabled: moveEnabled });
  const suppressClickRef = useRef(false);

  const effectivePosition = drag.livePosition ?? image.position;

  const handleBodyClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onFocus(image.id, event.shiftKey || event.metaKey || event.ctrlKey);
  }, [image.id, onFocus]);

  const handlePointerUp = useCallback((event: React.PointerEvent) => {
    if (drag.didMove) {
      suppressClickRef.current = true;
    }
    drag.onPointerUp(event);
  }, [drag]);

  const shellClass = cn(
    'group absolute overflow-hidden rounded-xl bg-[#141414] shadow-[0_18px_50px_rgba(0,0,0,0.35)] transition-shadow',
    isFocused ? 'ring-4 ring-[#0d99ff]' : 'ring-1 ring-white/10 hover:ring-white/25',
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
          <img src={image.magicLayerBaseUrl ?? image.url} alt="Canvas base" className="block select-none" style={{ width: size.width, height: size.height, maxWidth: 'none', maxHeight: 'none' }} decoding="async" loading="lazy" draggable={false} />
          <MagicLayerOverlay image={image} enabled={magicLayerEnabled} />
          {isFocused && !magicLayerEnabled && <ScopedDrawingLayer image={image} />}
          <ScopedMemoOverlay image={image} isFocused={isFocused} />
        </>
      )}

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
