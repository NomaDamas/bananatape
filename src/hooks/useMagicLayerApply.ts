"use client";

import { useCallback } from 'react';
import { useCanvasStore } from '@/stores/useCanvasStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { useParallelGenerate } from '@/hooks/useParallelGenerate';
import { usePromptComposer } from '@/components/Composer/PromptComposerProvider';
import { useToast } from '@/hooks/useToast';
import { composeMagicLayerPrompt } from '@/lib/prompt/magic-layer-inpaint';
import { hasMagicLayerChanges } from '@/lib/canvas/magic-layer-changes';

export interface UseMagicLayerApplyApi {
  apply: (imageId: string) => Promise<void>;
}

export function useMagicLayerApply(): UseMagicLayerApplyApi {
  const parallelGenerate = useParallelGenerate();
  const { systemPrompt, designContext, referenceImages } = usePromptComposer();
  const { addToast } = useToast();

  const apply = useCallback(async (imageId: string): Promise<void> => {
    const image = useCanvasStore.getState().images[imageId];
    if (!image) {
      addToast('Image not found', 'error');
      return;
    }

    if (!hasMagicLayerChanges(image)) {
      addToast('Move or hide a Magic Layer before applying', 'info');
      return;
    }

    if (image.status === 'pending' || image.status === 'streaming') {
      addToast('Image is still generating', 'info');
      return;
    }

    const composedPrompt = composeMagicLayerPrompt(image.prompt);
    const { parallelCount, outputSize } = useEditorStore.getState();

    try {
      await parallelGenerate.generate({
        count: parallelCount,
        prompt: composedPrompt,
        systemPrompt,
        designContext,
        referenceImages: referenceImages.map((r) => ({ file: r.file, id: r.id })),
        parentIds: [imageId],
        outputSize,
      });
      useCanvasStore.getState().selectMagicLayer(imageId, null);
      addToast('Magic Layer applied', 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Apply failed', 'error');
    }
  }, [parallelGenerate, systemPrompt, designContext, referenceImages, addToast]);

  return { apply };
}
