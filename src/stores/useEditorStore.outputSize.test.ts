import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from './useEditorStore';

describe('useEditorStore.outputSize', () => {
  beforeEach(() => {
    useEditorStore.getState().setOutputSize('auto');
  });

  it('initial value is auto', () => {
    expect(useEditorStore.getState().outputSize).toBe('auto');
  });

  it('setOutputSize updates the value', () => {
    useEditorStore.getState().setOutputSize('1536x1024');
    expect(useEditorStore.getState().outputSize).toBe('1536x1024');
  });

  it('outputSize survives undo', () => {
    useEditorStore.getState().setOutputSize('2048x1152');
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().outputSize).toBe('2048x1152');
  });

  it('accepts all 7 concrete sizes plus auto', () => {
    const sizes = ['auto', '1024x1024', '1536x1024', '1024x1536', '2048x2048', '2048x1152', '3840x2160', '2160x3840'] as const;
    for (const size of sizes) {
      useEditorStore.getState().setOutputSize(size);
      expect(useEditorStore.getState().outputSize).toBe(size);
    }
  });
});
