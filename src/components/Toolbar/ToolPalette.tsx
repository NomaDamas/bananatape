"use client";

import { useEditorStore } from '@/stores/useEditorStore';
import { useCanvasStore } from '@/stores/useCanvasStore';
import { Button } from '@/components/ui/button';
import { ArrowUpRight, Hand, MousePointer2, Pen, Square, StickyNote, Trash2 } from 'lucide-react';

const tools = [
  { id: 'pan' as const, icon: Hand, label: 'Pan', shortcut: '1' },
  { id: 'pen' as const, icon: Pen, label: 'Pen', shortcut: '2' },
  { id: 'box' as const, icon: Square, label: 'Box', shortcut: '3' },
  { id: 'arrow' as const, icon: ArrowUpRight, label: 'Arrow', shortcut: '4' },
  { id: 'memo' as const, icon: StickyNote, label: 'Sticky memo', shortcut: '5' },
  { id: 'move' as const, icon: MousePointer2, label: 'Move image', shortcut: '6' },
];

export function ToolPalette() {
  const activeTool = useEditorStore((s) => s.activeTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const clearEditorAnnotations = useEditorStore((s) => s.clearAnnotations);
  const paths = useEditorStore((s) => s.paths);
  const boxes = useEditorStore((s) => s.boxes);
  const memos = useEditorStore((s) => s.memos);
  const focusedImageIds = useCanvasStore((s) => s.focusedImageIds);
  const focusedImageAnnotations = useCanvasStore((s) => {
    if (s.focusedImageIds.length !== 1) return 0;
    const image = s.images[s.focusedImageIds[0]];
    return image ? image.paths.length + image.boxes.length + image.memos.length : 0;
  });

  const hasAnnotations = paths.length > 0 || boxes.length > 0 || memos.length > 0 || focusedImageAnnotations > 0;

  const clearAnnotations = () => {
    if (focusedImageIds.length === 1) {
      useCanvasStore.getState().clearAnnotationsOnImage(focusedImageIds[0]);
    }
    clearEditorAnnotations();
  };

  return (
    <div className="flex max-w-full items-center gap-1 overflow-x-auto">
      {tools.map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;
        return (
          <Button
            key={tool.id}
            size="icon"
            variant={isActive ? 'default' : 'ghost'}
            className="h-8 w-8 shrink-0"
            onClick={() => setActiveTool(tool.id)}
            title={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}
          >
            <Icon className="w-4 h-4" />
          </Button>
        );
      })}

      <div className="mx-1 h-5 w-px shrink-0 bg-neutral-200 dark:bg-neutral-800" />

      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 shrink-0"
        onClick={clearAnnotations}
        disabled={!hasAnnotations}
        title="Clear annotations"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}
