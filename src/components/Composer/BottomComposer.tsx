"use client";

import { useRef } from 'react';
import { ImagePlus, Loader2, Minus, Plus, Wand2, Pencil, X, Undo2, Redo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ToolPalette } from '@/components/Toolbar/ToolPalette';
import { useCanvasStore } from '@/stores/useCanvasStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { cn } from '@/lib/utils';
import type { Provider } from '@/types';
import type { ReferenceImagePreview } from '@/components/Composer/types';

function formatProviderLabel(provider: Provider) {
  return provider === 'god-tibo' ? 'codex' : 'OpenAI';
}

interface BottomComposerProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  references: ReferenceImagePreview[];
  onAddReferenceFiles: (files: File[]) => void | Promise<void>;
  onRemoveReference: (id: string) => void;
  onGenerate: () => void | Promise<void>;
  onEdit: () => void | Promise<void>;
  live2dEnabled?: boolean;
  className?: string;
}

export function BottomComposer({
  prompt,
  onPromptChange,
  references,
  onAddReferenceFiles,
  onRemoveReference,
  onGenerate,
  onEdit,
  live2dEnabled = false,
  className,
}: BottomComposerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const provider = useEditorStore((s) => s.provider);
  const setProvider = useEditorStore((s) => s.setProvider);
  const isGenerating = useEditorStore((s) => s.isGenerating);
  const mode = useEditorStore((s) => s.mode);
  const setMode = useEditorStore((s) => s.setMode);
  const baseImage = useEditorStore((s) => s.baseImage);
  const paths = useEditorStore((s) => s.paths);
  const boxes = useEditorStore((s) => s.boxes);
  const memos = useEditorStore((s) => s.memos);
  const zoom = useCanvasStore((s) => s.viewport.zoom);
  const zoomIn = useCanvasStore((s) => s.zoomIn);
  const zoomOut = useCanvasStore((s) => s.zoomOut);
  const resetViewport = useCanvasStore((s) => s.resetViewport);
  const focusedImageIds = useCanvasStore((s) => s.focusedImageIds);
  const canUndo = useCanvasStore((s) => s.focusedImageIds.length === 1 && (s.imageHistories[s.focusedImageIds[0]]?.past.length ?? 0) > 0);
  const canRedo = useCanvasStore((s) => s.focusedImageIds.length === 1 && (s.imageHistories[s.focusedImageIds[0]]?.future.length ?? 0) > 0);
  const undo = useCanvasStore((s) => s.undoFocusedImage);
  const redo = useCanvasStore((s) => s.redoFocusedImage);
  const parallelCount = useEditorStore((s) => s.parallelCount);
  const incrementParallelCount = useEditorStore((s) => s.incrementParallelCount);
  const decrementParallelCount = useEditorStore((s) => s.decrementParallelCount);

  const annotationCount = paths.length + boxes.length + memos.filter((memo) => memo.text.trim()).length;
  const canEdit = !!baseImage;
  const shouldEdit = canEdit && (mode === 'edit' || annotationCount > 0);
  const canSubmitEdit = canEdit && (Boolean(prompt.trim()) || annotationCount > 0);
  const primaryLabel = shouldEdit
    ? annotationCount > 0
      ? `Edit · ${annotationCount} region${annotationCount === 1 ? '' : 's'}`
      : 'Apply edit'
    : 'Generate';
  const canSubmitGenerate = Boolean(prompt.trim()) || live2dEnabled;
  const isPrimaryDisabled = isGenerating || (shouldEdit ? !canSubmitEdit : !canSubmitGenerate);

  const submitPrimary = () => {
    if (isPrimaryDisabled) return;
    if (shouldEdit) {
      setMode('edit');
      void onEdit();
      return;
    }
    setMode('generate');
    void onGenerate();
  };

  return (
    <div
      data-testid="standalone-bottom-composer"
      className={cn(
        'pointer-events-none fixed inset-x-3 bottom-3 z-30 flex justify-center sm:inset-x-4 sm:bottom-4 md:left-[264px] md:right-4 xl:right-[304px]',
        className,
      )}
    >
      <div className="pointer-events-auto flex max-h-[min(70vh,24rem)] w-full max-w-5xl flex-col gap-2 overflow-y-auto rounded-2xl border border-white/10 bg-[#2c2c2c]/95 p-2 text-[#e6e6e6] shadow-2xl shadow-black/40 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="max-w-full overflow-hidden rounded-xl border border-white/10 bg-[#1e1e1e] p-1">
            <ToolPalette />
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-xl border border-white/10 bg-[#1e1e1e] p-1">
            <Button type="button" size="icon-xs" variant="ghost" className="text-[#b3b3b3] hover:bg-white/10 hover:text-white" onClick={undo} disabled={!canUndo} aria-label="Undo" title={focusedImageIds.length === 1 ? "Undo selected image (Cmd/Ctrl+Z)" : "Select one image to undo"}>
              <Undo2 className="h-3 w-3" />
            </Button>
            <Button type="button" size="icon-xs" variant="ghost" className="text-[#b3b3b3] hover:bg-white/10 hover:text-white" onClick={redo} disabled={!canRedo} aria-label="Redo" title={focusedImageIds.length === 1 ? "Redo selected image (Cmd/Ctrl+Shift+Z)" : "Select one image to redo"}>
              <Redo2 className="h-3 w-3" />
            </Button>
            <div className="mx-1 h-4 w-px bg-white/10" />
            <Button type="button" size="icon-xs" variant="ghost" className="text-[#b3b3b3] hover:bg-white/10 hover:text-white" onClick={zoomOut} title="Zoom out">
              <Minus className="h-3 w-3" />
            </Button>
            <button type="button" className="min-w-12 rounded px-2 text-center text-[11px] text-[#b3b3b3] hover:bg-white/10 hover:text-white" onClick={resetViewport} title="Reset viewport">
              {Math.round(zoom * 100)}%
            </button>
            <Button type="button" size="icon-xs" variant="ghost" className="text-[#b3b3b3] hover:bg-white/10 hover:text-white" onClick={zoomIn} title="Zoom in">
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#1e1e1e] p-2">
          {references.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5" data-testid="composer-reference-list">
              {references.map((reference) => (
                <div key={reference.id} className="group relative h-9 w-9 overflow-hidden rounded-md border border-white/10 bg-[#111]">
                  <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${reference.previewUrl})` }} aria-label={reference.name ?? 'Reference image'} />
                  <button
                    type="button"
                    className="absolute inset-0 flex items-center justify-center bg-black/65 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => onRemoveReference(reference.id)}
                    aria-label="Remove reference image"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => {
                void onAddReferenceFiles(Array.from(event.target.files ?? []));
                event.currentTarget.value = '';
              }}
              data-testid="bottom-reference-image-input"
            />
            <div className="flex min-w-0 flex-1 items-end gap-2">
              <Button
                type="button"
                size="icon"
                variant={references.length > 0 ? 'secondary' : 'ghost'}
                className="relative h-10 w-10 shrink-0 rounded-lg text-[#b3b3b3] hover:bg-white/10 hover:text-white"
                disabled={isGenerating}
                onClick={() => fileInputRef.current?.click()}
                title="Attach reference image"
              >
                <ImagePlus className="h-4 w-4" />
                {references.length > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#0d99ff] px-1 text-[10px] text-white">
                    {references.length}
                  </span>
                )}
              </Button>

              <Textarea
                value={prompt}
                onChange={(event) => onPromptChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && event.metaKey) {
                    event.preventDefault();
                    submitPrimary();
                  }
                }}
                placeholder={shouldEdit && annotationCount > 0 ? 'Optional — annotations are enough to edit…' : shouldEdit ? 'Describe edits to apply…' : live2dEnabled ? 'Optional — Live2D prompt will be applied…' : 'Describe the image you want to create…'}
                className="max-h-36 min-h-10 min-w-0 flex-1 resize-none border-0 bg-transparent px-1 py-2 text-sm text-[#f5f5f5] placeholder:text-[#666] focus-visible:ring-0"
                data-testid="bottom-prompt-input"
              />
            </div>

            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex sm:items-center lg:shrink-0">
              <Select value={provider} onValueChange={(value) => setProvider(value as Provider)}>
                <SelectTrigger className="h-10 min-w-0 border-white/10 bg-[#2c2c2c] text-xs text-[#e6e6e6] sm:w-[150px]" data-testid="bottom-provider-select">
                  <span className="truncate">{formatProviderLabel(provider)}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="god-tibo">codex</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                </SelectContent>
              </Select>

              <div
                role="spinbutton"
                tabIndex={0}
                aria-label="Parallel generations"
                aria-valuemin={1}
                aria-valuenow={parallelCount}
                aria-valuetext={`${parallelCount} parallel generation${parallelCount === 1 ? '' : 's'}`}
                title="Parallel generations"
                onKeyDown={(event) => {
                  if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    incrementParallelCount();
                  } else if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    decrementParallelCount();
                  }
                }}
                className="flex h-10 items-center gap-1 rounded-lg border border-white/10 bg-[#2c2c2c] px-1.5 text-xs text-neutral-300 outline-none focus-visible:ring-1 focus-visible:ring-[#0d99ff]"
                data-testid="parallel-count-stepper"
              >
                <button
                  type="button"
                  aria-label="Decrease parallel count"
                  onClick={decrementParallelCount}
                  disabled={parallelCount <= 1}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-300 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                  data-testid="parallel-count-decrement"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span
                  className="min-w-[1.25rem] text-center font-mono text-sm font-semibold tabular-nums text-white"
                  data-testid="parallel-count-value"
                >
                  {parallelCount}
                </span>
                <button
                  type="button"
                  aria-label="Increase parallel count"
                  onClick={incrementParallelCount}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
                  data-testid="parallel-count-increment"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              <Button
                type="button"
                size="lg"
                className="h-10 min-w-0 shrink-0 rounded-lg bg-[#0d99ff] px-3 text-white hover:bg-[#0b85df] sm:px-4"
                disabled={isPrimaryDisabled}
                onClick={submitPrimary}
                data-testid="bottom-primary-action"
              >
                {isGenerating ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : shouldEdit ? <Pencil className="h-4 w-4 shrink-0" /> : <Wand2 className="h-4 w-4 shrink-0" />}
                <span className="truncate">{primaryLabel}</span>
              </Button>
            </div>
          </div>

          <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-0 text-[10px] text-[#666] sm:px-12">
            <span>Cmd+Enter to submit · paste images to add references</span>
            <span>{prompt.length} chars</span>
          </div>
        </div>
      </div>
    </div>
  );
}
