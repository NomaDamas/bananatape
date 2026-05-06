/** @vitest-environment jsdom */

import { describe, it, expect, beforeEach } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { OutputSizePicker } from './OutputSizePicker';
import { useEditorStore } from '@/stores/useEditorStore';

describe('OutputSizePicker', () => {
  beforeEach(() => {
    useEditorStore.getState().setOutputSize('auto');
  });

  it('renders with the trigger label "Auto" by default', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => {
      root.render(createElement(OutputSizePicker));
    });

    const trigger = host.querySelector('[data-testid="bottom-output-size-select"]');
    expect(trigger).not.toBeNull();
    expect(trigger?.textContent).toContain('Auto');

    act(() => root.unmount());
    host.remove();
  });

  it('reflects store changes in the trigger label', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    act(() => {
      useEditorStore.getState().setOutputSize('1536x1024');
      root.render(createElement(OutputSizePicker));
    });

    const trigger = host.querySelector('[data-testid="bottom-output-size-select"]');
    expect(trigger?.textContent).toContain('1536×1024');

    act(() => root.unmount());
    host.remove();
  });

  it('reflects all 7 concrete sizes plus auto in the trigger label', () => {
    const sizes = [
      { value: 'auto', expected: 'Auto' },
      { value: '1024x1024', expected: '1024×1024' },
      { value: '1536x1024', expected: '1536×1024' },
      { value: '1024x1536', expected: '1024×1536' },
      { value: '2048x2048', expected: '2048×2048' },
      { value: '2048x1152', expected: '2048×1152' },
      { value: '3840x2160', expected: '3840×2160' },
      { value: '2160x3840', expected: '2160×3840' },
    ] as const;

    for (const { value, expected } of sizes) {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const root = createRoot(host);
      act(() => {
        useEditorStore.getState().setOutputSize(value);
        root.render(createElement(OutputSizePicker));
      });

      const trigger = host.querySelector('[data-testid="bottom-output-size-select"]');
      expect(trigger?.textContent, `for size ${value}`).toContain(expected);

      act(() => root.unmount());
      host.remove();
    }
  });
});
