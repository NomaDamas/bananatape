"use client";

import { useRef, useEffect } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { useCanvasDrawing } from '@/hooks/useCanvasDrawing';
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
  const strokeWidth = useEditorStore((s) => s.strokeWidth);
  const isSpacePressed = useEditorStore((s) => s.isSpacePressed);

  const isPanning = activeTool === 'pan' || isSpacePressed;
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

    const toCanvas = (nx: number, ny: number) => ({
      x: nx * width,
      y: ny * height,
    });

    paths.forEach((path) => {
      if (path.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const start = toCanvas(path.points[0].x, path.points[0].y);
      ctx.moveTo(start.x, start.y);
      for (let i = 1; i < path.points.length; i++) {
        const p = toCanvas(path.points[i].x, path.points[i].y);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    });

    if (activePath && activePath.points.length >= 2) {
      ctx.beginPath();
      ctx.strokeStyle = activePath.color;
      ctx.lineWidth = activePath.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const start = toCanvas(activePath.points[0].x, activePath.points[0].y);
      ctx.moveTo(start.x, start.y);
      for (let i = 1; i < activePath.points.length; i++) {
        const p = toCanvas(activePath.points[i].x, activePath.points[i].y);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    boxes.forEach((box) => {
      const pos = toCanvas(box.x, box.y);
      const w = box.width * width;
      const h = box.height * height;
      ctx.strokeStyle = box.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(pos.x, pos.y, w, h);
    });

    if (activeBox) {
      const box = {
        x: Math.min(activeBox.start.x, activeBox.current.x),
        y: Math.min(activeBox.start.y, activeBox.current.y),
        width: Math.abs(activeBox.current.x - activeBox.start.x),
        height: Math.abs(activeBox.current.y - activeBox.start.y),
      };
      const pos = toCanvas(box.x, box.y);
      const w = box.width * width;
      const h = box.height * height;
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = toolColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(pos.x, pos.y, w, h);
      ctx.setLineDash([]);
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
