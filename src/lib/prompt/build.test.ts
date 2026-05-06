import { describe, expect, it } from 'vitest';
import { buildSubmittedPrompt } from './build';

describe('buildSubmittedPrompt', () => {
  it('returns empty string when all inputs are empty', () => {
    expect(buildSubmittedPrompt({ userPrompt: '' })).toBe('');
  });

  it('returns trimmed user prompt when only userPrompt is provided', () => {
    expect(buildSubmittedPrompt({ userPrompt: '  Hello world  ' })).toBe('Hello world');
  });

  it('trims whitespace from userPrompt', () => {
    expect(buildSubmittedPrompt({ userPrompt: '\n  Hello world\t ' })).toBe('Hello world');
  });

  it('uses fallbackPrompt when userPrompt is blank', () => {
    expect(buildSubmittedPrompt({ userPrompt: '   ', fallbackPrompt: '  Fallback prompt  ' })).toBe('Fallback prompt');
  });

  it('builds a two-section output with systemPrompt only', () => {
    expect(buildSubmittedPrompt({ userPrompt: 'User prompt', systemPrompt: 'System prompt' })).toBe(
      'System prompt:\nSystem prompt\n\nUser prompt:\nUser prompt',
    );
  });

  it('builds a two-section output with designContext only', () => {
    expect(buildSubmittedPrompt({ userPrompt: 'User prompt', designContext: 'Design context' })).toBe(
      'Design context:\nDesign context\n\nUser prompt:\nUser prompt',
    );
  });

  it('builds a three-section output in design, system, user order', () => {
    expect(buildSubmittedPrompt({
      userPrompt: 'User prompt',
      systemPrompt: 'System prompt',
      designContext: 'Design context',
    })).toBe(
      'Design context:\nDesign context\n\nSystem prompt:\nSystem prompt\n\nUser prompt:\nUser prompt',
    );
  });

  it('preserves empty user prompt section when designContext and systemPrompt are present', () => {
    expect(buildSubmittedPrompt({
      userPrompt: '   ',
      systemPrompt: 'System prompt',
      designContext: 'Design context',
    })).toBe('Design context:\nDesign context\n\nSystem prompt:\nSystem prompt\n\nUser prompt:\n');
  });

  it('matches the snapshot for a representative full input', () => {
    expect(buildSubmittedPrompt({
      userPrompt: '  Generate a poster  ',
      systemPrompt: '  Follow the brand guide  ',
      designContext: '  Use the attached reference as layout inspiration.  ',
    })).toMatchInlineSnapshot(`
      "Design context:\nUse the attached reference as layout inspiration.\n\nSystem prompt:\nFollow the brand guide\n\nUser prompt:\nGenerate a poster"
    `);
  });
});
