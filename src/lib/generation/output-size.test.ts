import { describe, it, expect } from 'vitest';
import {
  OUTPUT_SIZES,
  OUTPUT_SIZE_GROUPS,
  outputSizeToDims,
  parseConcreteOutputSize,
  parseOutputSize,
  resolveAutoSize,
} from './output-size';

describe('parseOutputSize', () => {
  it('returns auto for auto', () => {
    expect(parseOutputSize('auto')).toBe('auto');
  });

  it('returns 1024x1024 for 1024x1024', () => {
    expect(parseOutputSize('1024x1024')).toBe('1024x1024');
  });

  it('returns 2048x1152 for 2048x1152', () => {
    expect(parseOutputSize('2048x1152')).toBe('2048x1152');
  });

  it('returns null for foo', () => {
    expect(parseOutputSize('foo')).toBeNull();
  });

  it('returns null for 1024', () => {
    expect(parseOutputSize('1024')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseOutputSize('')).toBeNull();
  });

  it('returns null for null', () => {
    expect(parseOutputSize(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(parseOutputSize(undefined)).toBeNull();
  });

  it('returns null for number input', () => {
    expect(parseOutputSize(42)).toBeNull();
  });

  it('returns null for object input', () => {
    expect(parseOutputSize({ size: '1024x1024' })).toBeNull();
  });
});

describe('parseConcreteOutputSize', () => {
  it('returns 1024x1024 for 1024x1024', () => {
    expect(parseConcreteOutputSize('1024x1024')).toBe('1024x1024');
  });

  it('returns null for auto', () => {
    expect(parseConcreteOutputSize('auto')).toBeNull();
  });

  it('returns null for invalid string', () => {
    expect(parseConcreteOutputSize('bad-size')).toBeNull();
  });
});

describe('outputSizeToDims', () => {
  it('returns dims for 1024x1024', () => {
    expect(outputSizeToDims('1024x1024')).toEqual({ width: 1024, height: 1024 });
  });

  it('returns dims for 1536x1024', () => {
    expect(outputSizeToDims('1536x1024')).toEqual({ width: 1536, height: 1024 });
  });

  it('returns dims for 2160x3840', () => {
    expect(outputSizeToDims('2160x3840')).toEqual({ width: 2160, height: 3840 });
  });

  it('returns dims for 3840x2160', () => {
    expect(outputSizeToDims('3840x2160')).toEqual({ width: 3840, height: 2160 });
  });
});

describe('resolveAutoSize', () => {
  it('returns 1024x1024 for null parent', () => {
    expect(resolveAutoSize(null)).toBe('1024x1024');
  });

  it('returns 1024x1024 for 1:1 parent', () => {
    expect(resolveAutoSize({ width: 1024, height: 1024 })).toBe('1024x1024');
  });

  it('returns 1024x1024 for larger 1:1 parent', () => {
    expect(resolveAutoSize({ width: 2048, height: 2048 })).toBe('1024x1024');
  });

  it('returns 1536x1024 for 3:2 parent', () => {
    expect(resolveAutoSize({ width: 1500, height: 1000 })).toBe('1536x1024');
  });

  it('returns 2048x1152 for 16:9 parent', () => {
    expect(resolveAutoSize({ width: 4000, height: 2250 })).toBe('2048x1152');
  });

  it('returns 1024x1536 for 2:3 parent', () => {
    expect(resolveAutoSize({ width: 800, height: 1200 })).toBe('1024x1536');
  });

  it('returns 2160x3840 for 9:16 parent', () => {
    expect(resolveAutoSize({ width: 1080, height: 1920 })).toBe('2160x3840');
  });

  it('returns 2048x1152 for 2:1 parent', () => {
    expect(resolveAutoSize({ width: 2000, height: 1000 })).toBe('2048x1152');
  });

  it('returns 1024x1024 for zero dimensions', () => {
    expect(resolveAutoSize({ width: 0, height: 0 })).toBe('1024x1024');
  });

  it('returns 1024x1024 for NaN width', () => {
    expect(resolveAutoSize({ width: NaN, height: 1024 })).toBe('1024x1024');
  });

  it('returns 1024x1024 for negative width', () => {
    expect(resolveAutoSize({ width: -100, height: 100 })).toBe('1024x1024');
  });
});

describe('OUTPUT_SIZES and OUTPUT_SIZE_GROUPS', () => {
  it('includes auto plus the 7 concrete sizes', () => {
    expect(OUTPUT_SIZES).toHaveLength(8);
    expect(OUTPUT_SIZES).toContain('auto');
    expect(OUTPUT_SIZES.filter((size) => size !== 'auto')).toEqual([
      '1024x1024',
      '2048x2048',
      '1536x1024',
      '2048x1152',
      '3840x2160',
      '1024x1536',
      '2160x3840',
    ]);
  });

  it('has Square, Landscape, and Portrait groups', () => {
    expect(OUTPUT_SIZE_GROUPS.map((group) => group.label)).toEqual(['Square', 'Landscape', 'Portrait']);
  });

  it('contains each concrete size exactly once across groups', () => {
    const sizes = OUTPUT_SIZE_GROUPS.flatMap((group) => group.options.map((option) => option.value));
    expect(sizes).toHaveLength(7);
    expect(new Set(sizes).size).toBe(7);
    expect(sizes.sort()).toEqual([
      '1024x1024',
      '1024x1536',
      '1536x1024',
      '2048x1152',
      '2048x2048',
      '2160x3840',
      '3840x2160',
    ]);
  });

  it('has the expected option counts per group', () => {
    expect(OUTPUT_SIZE_GROUPS[0].options).toHaveLength(2);
    expect(OUTPUT_SIZE_GROUPS[1].options).toHaveLength(3);
    expect(OUTPUT_SIZE_GROUPS[2].options).toHaveLength(2);
  });
});
