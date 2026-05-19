export const MAGIC_LAYER_INPAINT_INSTRUCTION =
  "The composition has been rearranged: some objects were moved and some were removed. Inpaint the empty regions where objects used to be so they blend naturally with the surrounding scene. Integrate the moved objects into their new positions with matching lighting, shadows, perspective, and edges. Preserve the moved objects' identity, scale, and new positions. Output a single coherent, photorealistic image.";

export function composeMagicLayerPrompt(originalPrompt: string | undefined): string {
  const trimmedOriginal = originalPrompt?.trim();

  if (!trimmedOriginal) {
    return MAGIC_LAYER_INPAINT_INSTRUCTION;
  }

  return `${trimmedOriginal}\n\n${MAGIC_LAYER_INPAINT_INSTRUCTION}`;
}
