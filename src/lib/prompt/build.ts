export interface BuildPromptInput {
  userPrompt: string;
  systemPrompt?: string;
  designContext?: string;
  fallbackPrompt?: string;
}

/**
 * Combines design context + system prompt + user prompt into a single submitted string.
 * Behavior is byte-for-byte identical to the original PromptComposerProvider callback.
 */
export function buildSubmittedPrompt(input: BuildPromptInput): string {
  const trimmedPrompt = input.userPrompt.trim() || input.fallbackPrompt?.trim() || '';
  const trimmedSystemPrompt = input.systemPrompt?.trim() ?? '';
  const trimmedDesignContext = input.designContext?.trim() ?? '';

  if (!trimmedSystemPrompt && !trimmedDesignContext) {
    return trimmedPrompt;
  }

  const sections: string[] = [];
  if (trimmedDesignContext) sections.push(`Design context:\n${trimmedDesignContext}`);
  if (trimmedSystemPrompt) sections.push(`System prompt:\n${trimmedSystemPrompt}`);
  sections.push(`User prompt:\n${trimmedPrompt}`);
  return sections.join('\n\n');
}
