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

  it('does not save viewport operations in history', () => {
    useEditorStore.getState().setPan(25, 40);
    useEditorStore.getState().setViewport({ zoom: 2, panX: -50, panY: -25 });
    useEditorStore.getState().zoomIn();
    useEditorStore.getState().zoomOut();
    useEditorStore.getState().resetViewport();

    expect(useEditorStore.getState()).toMatchObject({ zoom: 1, panX: 0, panY: 0 });
    expect(useEditorStore.temporal.getState().pastStates).toHaveLength(0);
  });
  it('does not save non-undoable tool changes in history', () => {
    useEditorStore.getState().setActiveTool('box');

    expect(useEditorStore.getState().activeTool).toBe('box');
    expect(useEditorStore.temporal.getState().pastStates).toHaveLength(0);
  });

  it('undoes and redoes a bounding box as one action', () => {
    useEditorStore.getState().addBox({
      x: 0.1,
      y: 0.2,
      width: 0.3,
      height: 0.4,
      tool: 'box',
      color: '#ef4444',
      status: 'pending',
    });

    expect(useEditorStore.getState().boxes).toHaveLength(1);
    expect(useEditorStore.temporal.getState().pastStates).toHaveLength(1);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().boxes).toHaveLength(0);

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().boxes).toHaveLength(1);
  });

  it('undoes and redoes a new memo with typed text as one action', () => {
    const id = useEditorStore.getState().addMemo({ x: 0.25, y: 0.5, text: '', color: '#fef08a' });
    useEditorStore.getState().updateMemo(id, 'h', { track: false });
    useEditorStore.getState().updateMemo(id, 'hello', { track: false });

    expect(useEditorStore.getState().memos).toMatchObject([{ id, text: 'hello' }]);
    expect(useEditorStore.temporal.getState().pastStates).toHaveLength(1);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().memos).toHaveLength(0);

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().memos).toMatchObject([{ id, text: 'hello' }]);
  });

  it('undoes and redoes an existing memo edit as one action', () => {
    const id = useEditorStore.getState().addMemo({ x: 0.25, y: 0.5, text: 'old', color: '#fef08a' });
    useEditorStore.temporal.getState().clear();
    const startMemos = useEditorStore.getState().memos;

    useEditorStore.getState().updateMemo(id, 'new', { track: false });
    useEditorStore.getState().commitMemoText(id, 'new', { historySnapshot: { memos: startMemos } });

    expect(useEditorStore.getState().memos).toMatchObject([{ id, text: 'new' }]);
    expect(useEditorStore.temporal.getState().pastStates).toHaveLength(1);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().memos).toMatchObject([{ id, text: 'old' }]);

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().memos).toMatchObject([{ id, text: 'new' }]);
  });

  it('clears redo history after undo followed by a new action', () => {
    useEditorStore.getState().addBox({
      x: 0.1,
      y: 0.1,
      width: 0.2,
      height: 0.2,
      tool: 'box',
      color: '#ef4444',
      status: 'pending',
    });
    useEditorStore.getState().addBox({
      x: 0.4,
      y: 0.4,
      width: 0.2,
      height: 0.2,
      tool: 'box',
      color: '#ef4444',
      status: 'pending',
    });

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().boxes).toHaveLength(1);
    expect(useEditorStore.temporal.getState().futureStates).toHaveLength(1);

    useEditorStore.getState().addMemo({ x: 0.5, y: 0.5, text: 'new branch', color: '#fef08a' });

    expect(useEditorStore.temporal.getState().futureStates).toHaveLength(0);
    expect(useEditorStore.getState().boxes).toHaveLength(1);
    expect(useEditorStore.getState().memos).toHaveLength(1);
  });

});
