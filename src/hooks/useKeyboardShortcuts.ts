"use client";

import { useEffect } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';

export function useKeyboardShortcuts() {
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
        const temporalState = useEditorStore.temporal.getState();

        if (key === 'z' && e.shiftKey) {
          e.preventDefault();
          temporalState.redo();
          return;
        }

        if (key === 'z') {
          e.preventDefault();
          temporalState.undo();
          return;
        }

        if (key === 'y') {
          e.preventDefault();
          temporalState.redo();
          return;
        }
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        state.setActiveTool('pan');
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
  }, []);
}
