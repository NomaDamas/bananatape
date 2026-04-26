"use client";

import { useRef, useState, useCallback } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import type { ImageSize, NormalizedPoint } from '@/types';
import { screenToNormalized, pointsToBox } from '@/lib/canvas/coordinates';

interface UseCanvasDrawingOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  imageSize: ImageSize;
}

interface ActiveBox {
  start: NormalizedPoint;
  current: NormalizedPoint;
}

export function useCanvasDrawing({ containerRef, imageSize }: UseCanvasDrawingOptions) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeBox, setActiveBox] = useState<ActiveBox | null>(null);
  const activeBoxRef = useRef<ActiveBox | null>(null);

  const activeTool = useEditorStore((s) => s.activeTool);
  const toolColor = useEditorStore((s) => s.toolColor);
  const startPath = useEditorStore((s) => s.startPath);
  const addPathPoint = useEditorStore((s) => s.addPathPoint);
  const commitPath = useEditorStore((s) => s.commitPath);
  const addBox = useEditorStore((s) => s.addBox);
  const addMemo = useEditorStore((s) => s.addMemo);
  const setActiveMemoId = useEditorStore((s) => s.setActiveMemoId);
  const zoom = useEditorStore((s) => s.zoom);
  const panX = useEditorStore((s) => s.panX);
  const panY = useEditorStore((s) => s.panY);

  const getNormalizedPoint = useCallback(
    (clientX: number, clientY: number): NormalizedPoint | null => {
      const container = containerRef.current;
      if (!container) return null;
      const rect = container.getBoundingClientRect();
      const screenX = clientX - rect.left;
      const screenY = clientY - rect.top;
      return screenToNormalized(screenX, screenY, imageSize, { zoom, panX, panY });
    },
    [containerRef, imageSize, zoom, panX, panY]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (activeTool === 'pan') return;
      e.preventDefault();

      const point = getNormalizedPoint(e.clientX, e.clientY);
      if (!point) return;

      if (activeTool === 'memo') {
        const id = addMemo({
          x: point.x,
          y: point.y,
          text: '',
          color: '#fef08a',
        });
        setActiveMemoId(id);
        return;
      }

      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDrawing(true);

      if (activeTool === 'pen' || activeTool === 'arrow') {
        startPath(point, activeTool);
      } else if (activeTool === 'box') {
        const box = { start: point, current: point };
        setActiveBox(box);
        activeBoxRef.current = box;
      }
    },
    [activeTool, getNormalizedPoint, addMemo, setActiveMemoId, startPath]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawing) return;
      e.preventDefault();

      const point = getNormalizedPoint(e.clientX, e.clientY);
      if (!point) return;

      if (activeTool === 'pen' || activeTool === 'arrow') {
        addPathPoint(point);
      } else if (activeTool === 'box') {
        const box = { start: activeBoxRef.current?.start ?? point, current: point };
        setActiveBox(box);
        activeBoxRef.current = box;
      }
    },
    [isDrawing, activeTool, getNormalizedPoint, addPathPoint]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawing) return;
      e.preventDefault();
      e.currentTarget.releasePointerCapture(e.pointerId);

      if (activeTool === 'pen' || activeTool === 'arrow') {
        commitPath();
      } else if (activeTool === 'box' && activeBoxRef.current) {
        const { start, current } = activeBoxRef.current;
        const box = pointsToBox(start, current);
        if (box.width > 0.005 && box.height > 0.005) {
          addBox({
            ...box,
            tool: 'box',
            color: toolColor,
            status: 'pending',
          });
        }
      }

      setIsDrawing(false);
      setActiveBox(null);
      activeBoxRef.current = null;
    },
    [isDrawing, activeTool, commitPath, addBox, toolColor]
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    activeBox,
    isDrawing,
  };
}
