import { describe, expect, it } from 'vitest';
import { MAGIC_LAYER_INPAINT_INSTRUCTION, composeMagicLayerPrompt } from './magic-layer-inpaint';

describe('composeMagicLayerPrompt', () => {
  it('returns only the instruction when input is undefined', () => {
    expect(composeMagicLayerPrompt(undefined)).toBe(MAGIC_LAYER_INPAINT_INSTRUCTION);
  });

  it('returns only the instruction when input is an empty string', () => {
    expect(composeMagicLayerPrompt('')).toBe(MAGIC_LAYER_INPAINT_INSTRUCTION);
  });

  it('returns only the instruction when input is whitespace-only', () => {
    expect(composeMagicLayerPrompt('   \n\t  ')).toBe(MAGIC_LAYER_INPAINT_INSTRUCTION);
  });

  it('appends the instruction to a normal prompt', () => {
    expect(composeMagicLayerPrompt('Make the scene feel brighter')).toBe(
      `Make the scene feel brighter\n\n${MAGIC_LAYER_INPAINT_INSTRUCTION}`,
    );
  });

  it('trims surrounding whitespace from the original prompt', () => {
    expect(composeMagicLayerPrompt('  Keep the red chair in place  \n')).toBe(
      `Keep the red chair in place\n\n${MAGIC_LAYER_INPAINT_INSTRUCTION}`,
    );
  });
});
