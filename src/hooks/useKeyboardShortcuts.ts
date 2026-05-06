"use client";

import { useEffect } from 'react';
import { useCanvasStore } from '@/stores/useCanvasStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { useDeleteToast } from './useDeleteToast';

export function useKeyboardShortcuts() {
  const showDeleteToast = useDeleteToast();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      const state = useEditorStore.getState();

      if (e.code === 'Space' && !isInput) {
        e.preventDefault();
        state.setIsSpacePressed(true);
        return;
      }

      if (isInput || state.activeMemoId || state.isSpacePressed) return;

      if (e.metaKey || e.ctrlKey) {
        const key = e.key.toLowerCase();
        const canvasState = useCanvasStore.getState();

        if (key === 'z' && e.shiftKey) {
          e.preventDefault();
          canvasState.redoFocusedImage();
          return;
        }

        if (key === 'z') {
          e.preventDefault();
          canvasState.undoFocusedImage();
          return;
        }

        if (key === 'y') {
          e.preventDefault();
          canvasState.redoFocusedImage();
          return;
        }
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        state.setActiveTool('pan');
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const canvasState = useCanvasStore.getState();
        if (canvasState.focusedImageIds.length > 0) {
          e.preventDefault();
          const count = canvasState.focusedImageIds.length;
          canvasState.deleteImages(canvasState.focusedImageIds);
          showDeleteToast(count);
        }
        return;
      }

      if (e.key === '1') {
        e.preventDefault();
        state.setActiveTool('pan');
        return;
      }

      if (e.key === '2') {
        e.preventDefault();
        state.setActiveTool('pen');
        return;
      }

      if (e.key === '3') {
        e.preventDefault();
        state.setActiveTool('box');
        return;
      }

      if (e.key === '4') {
        e.preventDefault();
        state.setActiveTool('arrow');
        return;
      }

      if (e.key === '5') {
        e.preventDefault();
        state.setActiveTool('memo');
        return;
      }

      if (e.key === '6') {
        e.preventDefault();
        state.setActiveTool('move');
        return;
      }

    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        useEditorStore.getState().setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [showDeleteToast]);
}
