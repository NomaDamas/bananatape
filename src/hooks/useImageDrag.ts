"use client";

import { useCallback, useRef, useState } from 'react';
import type React from 'react';
import { useCanvasStore } from '@/stores/useCanvasStore';
import type { CanvasImage } from '@/types/canvas';

const MOVE_THRESHOLD_PX = 4;

interface DragStart {
  clientX: number;
  clientY: number;
  posX: number;
  posY: number;
  pointerId: number;
}

export interface ImageDragApi {
  onPointerDown: (event: React.PointerEvent) => void;
  onPointerMove: (event: React.PointerEvent) => void;
  onPointerUp: (event: React.PointerEvent) => void;
  onPointerCancel: (event: React.PointerEvent) => void;
  livePosition: { x: number; y: number } | null;
  isDragging: boolean;
  didMove: boolean;
}

interface UseImageDragOptions {
  enabled: boolean;
}

const noop = () => {};

export function useImageDrag(image: CanvasImage, { enabled }: UseImageDragOptions): ImageDragApi {
  const [isDragging, setIsDragging] = useState(false);
  const [didMove, setDidMove] = useState(false);
  const [livePosition, setLivePosition] = useState<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<DragStart | null>(null);
  const livePositionRef = useRef<{ x: number; y: number } | null>(null);

  const reset = useCallback(() => {
    dragStartRef.current = null;
    livePositionRef.current = null;
    setIsDragging(false);
    setDidMove(false);
    setLivePosition(null);
  }, []);

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    if (!enabled) return;
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* JSDOM and some test environments lack pointer capture; safe to ignore. */
    }

    dragStartRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      posX: image.position.x,
      posY: image.position.y,
      pointerId: event.pointerId,
    };
    livePositionRef.current = { x: image.position.x, y: image.position.y };
    setIsDragging(true);
    setDidMove(false);
    setLivePosition({ x: image.position.x, y: image.position.y });
  }, [enabled, image.position.x, image.position.y]);

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    if (!enabled) return;
    const start = dragStartRef.current;
    if (!start) return;
    if (event.pointerId !== start.pointerId) return;

    event.preventDefault();
    event.stopPropagation();

    const dxScreen = event.clientX - start.clientX;
    const dyScreen = event.clientY - start.clientY;

    if (!didMove && (Math.abs(dxScreen) > MOVE_THRESHOLD_PX || Math.abs(dyScreen) > MOVE_THRESHOLD_PX)) {
      setDidMove(true);
    }

    // Read zoom imperatively so the latest value is always used (no stale closure).
    const zoom = useCanvasStore.getState().viewport.zoom || 1;
    const next = {
      x: start.posX + dxScreen / zoom,
      y: start.posY + dyScreen / zoom,
    };
    livePositionRef.current = next;
    setLivePosition(next);
  }, [enabled, didMove]);

  const onPointerUp = useCallback((event: React.PointerEvent) => {
    if (!enabled) return;
    const start = dragStartRef.current;
    if (!start) return;
    if (event.pointerId !== start.pointerId) return;

    event.preventDefault();
    event.stopPropagation();

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* See pointerdown. */
    }

    const movedFar = didMove;
    const finalPos = livePositionRef.current;

    if (movedFar && finalPos) {
      // One updateImage call per drag → one zundo undo entry per drag.
      useCanvasStore.getState().updateImage(image.id, {
        position: { x: finalPos.x, y: finalPos.y },
      });
    }

    reset();
  }, [enabled, didMove, image.id, reset]);

  const onPointerCancel = useCallback((event: React.PointerEvent) => {
    if (!enabled) return;
    const start = dragStartRef.current;
    if (!start) return;
    if (event.pointerId !== start.pointerId) return;

    event.preventDefault();
    event.stopPropagation();

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* See pointerdown. */
    }

    reset();
  }, [enabled, reset]);

  if (!enabled) {
    return {
      onPointerDown: noop,
      onPointerMove: noop,
      onPointerUp: noop,
      onPointerCancel: noop,
      livePosition: null,
      isDragging: false,
      didMove: false,
    };
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    livePosition,
    isDragging,
    didMove,
  };
}
