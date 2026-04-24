"use client";

import { useEditorStore } from '@/stores/useEditorStore';
import { Button } from '@/components/ui/button';
import { Hand, Pen, Square, MousePointer, Trash2, ZoomIn, ZoomOut } from 'lucide-react';

const tools = [
  { id: 'pan' as const, icon: Hand, label: 'Pan', shortcut: '1' },
  { id: 'pen' as const, icon: Pen, label: 'Pen', shortcut: '2' },
  { id: 'box' as const, icon: Square, label: 'Box', shortcut: '3' },
  { id: 'select' as const, icon: MousePointer, label: 'Select', shortcut: undefined },
];

export function ToolPalette() {
  const activeTool = useEditorStore((s) => s.activeTool);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const clearAnnotations = useEditorStore((s) => s.clearAnnotations);
  const zoomIn = useEditorStore((s) => s.zoomIn);
  const zoomOut = useEditorStore((s) => s.zoomOut);
  const paths = useEditorStore((s) => s.paths);
  const boxes = useEditorStore((s) => s.boxes);
  const memos = useEditorStore((s) => s.memos);

  const hasAnnotations = paths.length > 0 || boxes.length > 0 || memos.length > 0;

  return (
    <div className="flex items-center gap-1">
      {tools.map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;
        return (
          <Button
            key={tool.id}
            size="icon"
            variant={isActive ? 'default' : 'ghost'}
            className="h-8 w-8"
            onClick={() => setActiveTool(tool.id)}
            title={tool.shortcut ? `${tool.label} (${tool.shortcut})` : tool.label}
          >
            <Icon className="w-4 h-4" />
          </Button>
        );
      })}

      <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-800 mx-1" />

      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        onClick={zoomIn}
        title="Zoom in"
      >
        <ZoomIn className="w-4 h-4" />
      </Button>

      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        onClick={zoomOut}
        title="Zoom out"
      >
        <ZoomOut className="w-4 h-4" />
      </Button>

      <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-800 mx-1" />

      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        onClick={clearAnnotations}
        disabled={!hasAnnotations}
        title="Clear annotations"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}
