"use client";

import { useRef, useEffect } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { useCanvasDrawing } from '@/hooks/useCanvasDrawing';
import {
  ACTIVE_BOX_STROKE_WIDTH,
  createCanvasMapper,
  drawAnnotationPath,
  drawBoundingBox,
} from '@/lib/canvas/annotation-rendering';
import type { ImageSize } from '@/types';

interface DrawingLayerProps {
  containerRef: React.RefObject<HTMLElement | null>;
  imageSize: ImageSize;
}

export function DrawingLayer({ containerRef, imageSize }: DrawingLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const activeTool = useEditorStore((s) => s.activeTool);
  const paths = useEditorStore((s) => s.paths);
  const boxes = useEditorStore((s) => s.boxes);
  const activePath = useEditorStore((s) => s.activePath);
  const toolColor = useEditorStore((s) => s.toolColor);
  const isSpacePressed = useEditorStore((s) => s.isSpacePressed);

  const isPanning = activeTool === 'pan' || activeTool === 'move' || isSpacePressed;
  const pointerEvents = isPanning ? 'none' : 'auto';

  const { onPointerDown, onPointerMove, onPointerUp, activeBox } = useCanvasDrawing({
    containerRef,
    imageSize,
  });

  const width = imageSize.width;
  const height = imageSize.height;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0 || height === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    const naturalSize = { width, height };
    const toCanvas = createCanvasMapper(naturalSize);

    paths.forEach((path) => drawAnnotationPath(ctx, path, toCanvas));

    if (activePath && activePath.points.length >= 2) {
      drawAnnotationPath(ctx, activePath, toCanvas);
    }

    boxes.forEach((box) => drawBoundingBox(ctx, box, naturalSize));

    if (activeBox) {
      const box = {
        x: Math.min(activeBox.start.x, activeBox.current.x),
        y: Math.min(activeBox.start.y, activeBox.current.y),
        width: Math.abs(activeBox.current.x - activeBox.start.x),
        height: Math.abs(activeBox.current.y - activeBox.start.y),
        color: toolColor,
      };
      drawBoundingBox(ctx, box, naturalSize, {
        dashed: true,
        lineWidth: ACTIVE_BOX_STROKE_WIDTH,
      });
    }
  }, [paths, boxes, activePath, activeBox, width, height, toolColor]);

  const cursor = isPanning ? 'inherit' : 'crosshair';

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents,
        touchAction: 'none',
        cursor,
      }}
    />
  );
}
