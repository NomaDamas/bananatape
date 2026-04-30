import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '@/stores/useEditorStore';

function resetEditorStore() {
  useEditorStore.temporal.getState().clear();
  useEditorStore.setState({
    baseImage: null,
    imageSize: { width: 0, height: 0 },
    paths: [],
    boxes: [],
    memos: [],
    activeTool: 'pan',
    activePath: null,
    activeMemoId: null,
    toolColor: '#ef4444',
    strokeWidth: 3,
    provider: 'god-tibo',
    mode: 'generate',
    isGenerating: false,
    streamProgress: null,
    zoom: 1,
    panX: 0,
    panY: 0,
    isSpacePressed: false,
  });
  useEditorStore.temporal.getState().clear();
}

describe('useEditorStore undo/redo', () => {
  beforeEach(() => {
    resetEditorStore();
  });

  it('does not save transient pan moves in history', () => {
    useEditorStore.getState().setPan(25, 40, { track: false });

    expect(useEditorStore.getState()).toMatchObject({ panX: 25, panY: 40 });
    expect(useEditorStore.temporal.getState().pastStates).toHaveLength(0);
  });

  it('undoes and redoes a committed pan as one action', () => {
    useEditorStore.getState().setPan(25, 40, { track: false });
    useEditorStore.getState().setPan(25, 40, { historySnapshot: { zoom: 1, panX: 0, panY: 0 } });

    expect(useEditorStore.temporal.getState().pastStates).toHaveLength(1);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState()).toMatchObject({ panX: 0, panY: 0 });

    useEditorStore.getState().redo();
    expect(useEditorStore.getState()).toMatchObject({ panX: 25, panY: 40 });
  });

  it('undoes and redoes zoom plus pan together for wheel zoom', () => {
    useEditorStore.getState().setViewport({ zoom: 2, panX: -50, panY: -25 });

    useEditorStore.getState().undo();
    expect(useEditorStore.getState()).toMatchObject({ zoom: 1, panX: 0, panY: 0 });

    useEditorStore.getState().redo();
    expect(useEditorStore.getState()).toMatchObject({ zoom: 2, panX: -50, panY: -25 });
  });
});
