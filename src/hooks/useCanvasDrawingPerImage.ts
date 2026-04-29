"use client";

import { useCallback, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { clientToNormalized, pointsToBox } from '@/lib/canvas/coordinates';
import { useCanvasStore } from '@/stores/useCanvasStore';
import { useEditorStore } from '@/stores/useEditorStore';
import type { DrawingPath, ImageSize, NormalizedPoint } from '@/types';

interface UseCanvasDrawingPerImageOptions {
  imageId: string;
  imageSize: ImageSize;
}

interface ActiveBox {
  start: NormalizedPoint;
  current: NormalizedPoint;
}

export function useCanvasDrawingPerImage({ imageId, imageSize }: UseCanvasDrawingPerImageOptions) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeBox, setActiveBox] = useState<ActiveBox | null>(null);
  const [activePath, setActivePath] = useState<DrawingPath | null>(null);
  const activeBoxRef = useRef<ActiveBox | null>(null);
  const activePathRef = useRef<DrawingPath | null>(null);

  const activeTool = useEditorStore((s) => s.activeTool);
  const toolColor = useEditorStore((s) => s.toolColor);
  const strokeWidth = useEditorStore((s) => s.strokeWidth);
  const setActiveMemoId = useEditorStore((s) => s.setActiveMemoId);

  const getPoint = useCallback((event: React.PointerEvent): NormalizedPoint => {
    return clientToNormalized(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
  }, []);

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    if (activeTool === 'pan') return;
    event.preventDefault();
    event.stopPropagation();

    const point = getPoint(event);

    if (activeTool === 'memo') {
      const id = nanoid();
      useCanvasStore.getState().addMemoToImage(imageId, {
        id,
        x: point.x,
        y: point.y,
        text: '',
        color: '#fef08a',
      });
      setActiveMemoId(id);
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDrawing(true);

    if (activeTool === 'pen' || activeTool === 'arrow') {
      const path = { id: nanoid(), tool: activeTool, points: [point], color: toolColor, strokeWidth };
      activePathRef.current = path;
      setActivePath(path);
      return;
    }

    if (activeTool === 'box') {
      const box = { start: point, current: point };
      activeBoxRef.current = box;
      setActiveBox(box);
    }
  }, [activeTool, getPoint, imageId, setActiveMemoId, strokeWidth, toolColor]);

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    if (!isDrawing) return;
    event.preventDefault();
    event.stopPropagation();

    const point = getPoint(event);

    if (activeTool === 'pen' || activeTool === 'arrow') {
      const nextPath = activePathRef.current
        ? { ...activePathRef.current, points: [...activePathRef.current.points, point] }
        : null;
      activePathRef.current = nextPath;
      setActivePath(nextPath);
      return;
    }

    if (activeTool === 'box') {
      const box = { start: activeBoxRef.current?.start ?? point, current: point };
      activeBoxRef.current = box;
      setActiveBox(box);
    }
  }, [activeTool, getPoint, isDrawing]);

  const onPointerUp = useCallback((event: React.PointerEvent) => {
    if (!isDrawing) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.releasePointerCapture(event.pointerId);

    if ((activeTool === 'pen' || activeTool === 'arrow') && activePathRef.current && activePathRef.current.points.length >= 2) {
      useCanvasStore.getState().addPathToImage(imageId, activePathRef.current);
    }

    if (activeTool === 'box' && activeBoxRef.current) {
      const { start, current } = activeBoxRef.current;
      const box = pointsToBox(start, current);
      if (box.width > 0.005 && box.height > 0.005) {
        useCanvasStore.getState().addBoxToImage(imageId, {
          id: nanoid(),
          ...box,
          tool: 'box',
          color: toolColor,
          status: 'pending',
        });
      }
    }

    setIsDrawing(false);
    setActiveBox(null);
    setActivePath(null);
    activeBoxRef.current = null;
    activePathRef.current = null;
  }, [activeTool, imageId, isDrawing, toolColor]);

  return { onPointerDown, onPointerMove, onPointerUp, activeBox, activePath, isDrawing, imageSize };
}
