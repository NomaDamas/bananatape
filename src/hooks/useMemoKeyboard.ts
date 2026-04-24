"use client";

import { useEffect, useRef, useCallback } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { clientToNormalized } from '@/lib/canvas/coordinates';

interface UseMemoKeyboardOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  imageSize: { width: number; height: number };
  enabled: boolean;
}

export function useMemoKeyboard({ containerRef, imageSize, enabled }: UseMemoKeyboardOptions) {
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const addMemo = useEditorStore((s) => s.addMemo);
  const setActiveMemoId = useEditorStore((s) => s.setActiveMemoId);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    mousePosRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (!enabled) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.length !== 1) return;

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const { x, y } = mousePosRef.current;

      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        return;
      }

      const point = clientToNormalized(x, y, rect);

      const memoId = crypto.randomUUID();
      addMemo({
        x: point.x,
        y: point.y,
        text: '',
        color: '#fef08a',
      });
      setActiveMemoId(memoId);

      e.preventDefault();
    },
    [enabled, containerRef, imageSize, addMemo, setActiveMemoId]
  );

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleMouseMove, handleKeyDown]);

  return mousePosRef;
}
