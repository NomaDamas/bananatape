export type ConcreteOutputSize =
  | '1024x1024'
  | '1536x1024'
  | '1024x1536'
  | '2048x2048'
  | '2048x1152'
  | '3840x2160'
  | '2160x3840';

export type OutputSize = 'auto' | ConcreteOutputSize;

export const OUTPUT_SIZES: readonly OutputSize[] = [
  'auto',
  '1024x1024',
  '2048x2048',
  '1536x1024',
  '2048x1152',
  '3840x2160',
  '1024x1536',
  '2160x3840',
] as const;

export const CONCRETE_OUTPUT_SIZES: readonly ConcreteOutputSize[] = [
  '1024x1024',
  '2048x2048',
  '1536x1024',
  '2048x1152',
  '3840x2160',
  '1024x1536',
  '2160x3840',
] as const;

export interface OutputSizeOption {
  value: ConcreteOutputSize;
  label: string;
  aspectLabel: string;
  megapixels: string;
}

export const OUTPUT_SIZE_GROUPS: readonly {
  label: 'Square' | 'Landscape' | 'Portrait';
  options: readonly OutputSizeOption[];
}[] = [
  {
    label: 'Square',
    options: [
      { value: '1024x1024', label: '1024 × 1024', aspectLabel: '1:1', megapixels: '1.0 MP' },
      { value: '2048x2048', label: '2048 × 2048', aspectLabel: '1:1', megapixels: '4.2 MP' },
    ],
  },
  {
    label: 'Landscape',
    options: [
      { value: '1536x1024', label: '1536 × 1024', aspectLabel: '3:2', megapixels: '1.6 MP' },
      { value: '2048x1152', label: '2048 × 1152', aspectLabel: '16:9', megapixels: '2.4 MP' },
      { value: '3840x2160', label: '3840 × 2160', aspectLabel: '16:9 · 4K', megapixels: '8.3 MP' },
    ],
  },
  {
    label: 'Portrait',
    options: [
      { value: '1024x1536', label: '1024 × 1536', aspectLabel: '2:3', megapixels: '1.6 MP' },
      { value: '2160x3840', label: '2160 × 3840', aspectLabel: '9:16 · 4K', megapixels: '8.3 MP' },
    ],
  },
] as const;

export function parseOutputSize(input: unknown): OutputSize | null {
  if (typeof input !== 'string') return null;
  if (OUTPUT_SIZES.includes(input as OutputSize)) {
    return input as OutputSize;
  }
  return null;
}

export function parseConcreteOutputSize(input: unknown): ConcreteOutputSize | null {
  const parsed = parseOutputSize(input);
  if (parsed === null || parsed === 'auto') return null;
  return parsed;
}

export function outputSizeToDims(size: ConcreteOutputSize): { width: number; height: number } {
  const [w, h] = size.split('x').map(Number);
  return { width: w, height: h };
}

export function resolveAutoSize(
  parent: { width: number; height: number } | null,
): ConcreteOutputSize {
  if (
    !parent
    || !Number.isFinite(parent.width)
    || !Number.isFinite(parent.height)
    || parent.width <= 0
    || parent.height <= 0
  ) {
    return '1024x1024';
  }

  const targetLogAspect = Math.log(parent.width / parent.height);

  let best: ConcreteOutputSize = '1024x1024';
  let bestDistance = Infinity;
  let bestPixels = Infinity;

  for (const size of CONCRETE_OUTPUT_SIZES) {
    const { width, height } = outputSizeToDims(size);
    const distance = Math.abs(Math.log(width / height) - targetLogAspect);
    const pixels = width * height;

    if (
      distance < bestDistance
      || (distance === bestDistance && pixels < bestPixels)
    ) {
      best = size;
      bestDistance = distance;
      bestPixels = pixels;
    }
  }

  return best;
}
