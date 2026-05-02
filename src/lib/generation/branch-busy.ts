import type { CanvasImage } from '@/types/canvas';

export function isGenerationPending(image: CanvasImage | undefined): boolean {
  return image?.status === 'pending';
}

export function isEditableGenerationSource(image: CanvasImage | undefined): boolean {
  return image?.status === 'ready' || image?.status === 'streaming';
}

export function countImageAnnotations(image: CanvasImage | undefined): number {
  if (!image) return 0;
  return image.paths.length
    + image.boxes.length
    + image.memos.filter((memo) => memo.text.trim()).length;
}

export function countFocusedAnnotations(images: Record<string, CanvasImage>, focusedImageIds: string[]): number {
  return focusedImageIds.reduce((count, imageId) => count + countImageAnnotations(images[imageId]), 0);
}

export function isImageBranchGenerating(images: Record<string, CanvasImage>, imageId: string): boolean {
  const visited = new Set<string>();
  const stack = [imageId];

  while (stack.length > 0) {
    const currentId = stack.pop();
    if (!currentId || visited.has(currentId)) continue;
    visited.add(currentId);

    if (isGenerationPending(images[currentId])) return true;

    for (const image of Object.values(images)) {
      if (image.parentId === currentId) {
        stack.push(image.id);
      }
    }
  }

  return false;
}

export function hasBusyFocusedBranches(images: Record<string, CanvasImage>, focusedImageIds: string[]): boolean {
  return focusedImageIds.some((imageId) => isImageBranchGenerating(images, imageId));
}
