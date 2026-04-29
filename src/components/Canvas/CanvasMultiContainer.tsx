"use client";

import { useMemo } from 'react';
import { CanvasImageItem } from './CanvasImageItem';
import { computeViewportBounds, getVisibleImageIds } from '@/lib/canvas/culling';
import { useCanvasStore } from '@/stores/useCanvasStore';
import { DEFAULT_PLACEHOLDER_LAYOUT } from '@/types/canvas';

interface CanvasMultiContainerProps {
  onDeleteImage: (id: string) => void;
  onRetryImage: (id: string) => void;
}

export function CanvasMultiContainer({ onDeleteImage, onRetryImage }: CanvasMultiContainerProps) {
  const images = useCanvasStore((s) => s.images);
  const imageOrder = useCanvasStore((s) => s.imageOrder);
  const selectedImageIds = useCanvasStore((s) => s.selectedImageIds);
  const focusedImageId = useCanvasStore((s) => s.focusedImageId);
  const viewport = useCanvasStore((s) => s.viewport);
  const selectImage = useCanvasStore((s) => s.selectImage);
  const toggleSelection = useCanvasStore((s) => s.toggleSelection);

  const imageBounds = useMemo(() => imageOrder.map((id) => {
    const image = images[id];
    const size = image?.size.width && image.size.height ? image.size : DEFAULT_PLACEHOLDER_LAYOUT;
    return image ? { id, x: image.position.x, y: image.position.y, width: size.width, height: size.height } : null;
  }).filter((item): item is NonNullable<typeof item> => item !== null), [imageOrder, images]);

  const visibleIds = useMemo(() => {
    if (viewport.width <= 0 || viewport.height <= 0) return new Set<string>();
    const bounds = computeViewportBounds({
      panX: viewport.panX,
      panY: viewport.panY,
      zoom: viewport.zoom,
      containerWidth: viewport.width,
      containerHeight: viewport.height,
    });
    return new Set(getVisibleImageIds(imageBounds, bounds, 0.2));
  }, [imageBounds, viewport.height, viewport.panX, viewport.panY, viewport.width, viewport.zoom]);

  return (
    <>
      {imageOrder.map((id) => {
        const image = images[id];
        if (!image) return null;
        return (
          <CanvasImageItem
            key={id}
            image={image}
            isFocused={focusedImageId === id}
            isSelected={selectedImageIds.includes(id)}
            isVisible={visibleIds.has(id)}
            onSelect={selectImage}
            onCheckboxToggle={toggleSelection}
            onDelete={onDeleteImage}
            onRetry={onRetryImage}
          />
        );
      })}
    </>
  );
}
