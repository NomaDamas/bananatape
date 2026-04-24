"use client";

import { useRef } from 'react';
import { ImagePlus, Loader2, Wand2, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ToolPalette } from '@/components/Toolbar/ToolPalette';
import { useEditorStore } from '@/stores/useEditorStore';
import { cn } from '@/lib/utils';
import type { Provider } from '@/types';
import type { ReferenceImagePreview } from '@/components/Composer/types';

interface BottomComposerProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  references: ReferenceImagePreview[];
  onAddReferenceFiles: (files: File[]) => void;
  onRemoveReference: (id: string) => void;
  onGenerate: () => void | Promise<void>;
  onEdit: () => void | Promise<void>;
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

  const annotationCount = paths.length + boxes.length + memos.length;
  const canEdit = !!baseImage;
  const shouldEdit = canEdit && (mode === 'edit' || annotationCount > 0);
  const primaryLabel = shouldEdit
    ? annotationCount > 0
      ? `Edit · ${annotationCount} region${annotationCount === 1 ? '' : 's'}`
      : 'Apply edit'
    : 'Generate';
  const isPrimaryDisabled = isGenerating || !prompt.trim() || (shouldEdit && !canEdit);

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
      className={cn('pointer-events-none fixed inset-x-[288px] bottom-5 z-30 flex justify-center px-6', className)}
    >
      <div className="pointer-events-auto flex w-full max-w-5xl flex-col gap-2 rounded-2xl border border-white/10 bg-[#2c2c2c]/95 p-2 text-[#e6e6e6] shadow-2xl shadow-black/40 backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="rounded-xl border border-white/10 bg-[#1e1e1e] p-1">
            <ToolPalette />
          </div>

        </div>

        <div className="rounded-xl border border-white/10 bg-[#1e1e1e] p-2">
          {references.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5" data-testid="reference-image-list">
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

          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => {
                onAddReferenceFiles(Array.from(event.target.files ?? []));
                event.currentTarget.value = '';
              }}
              data-testid="reference-image-input"
            />
            <Button
              type="button"
              size="icon"
              variant={references.length > 0 ? 'secondary' : 'ghost'}
              className="relative h-10 w-10 shrink-0 rounded-lg text-[#b3b3b3] hover:bg-white/10 hover:text-white"
              disabled={isGenerating}
              onClick={() => fileInputRef.current?.click()}
              title="Add reference image"
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
              placeholder={shouldEdit ? 'Describe edits for the annotated regions…' : 'Describe the image you want to create…'}
              className="max-h-36 min-h-10 resize-none border-0 bg-transparent px-1 py-2 text-sm text-[#f5f5f5] placeholder:text-[#666] focus-visible:ring-0"
              data-testid="bottom-prompt-input"
            />

            <Select value={provider} onValueChange={(value) => setProvider(value as Provider)}>
              <SelectTrigger className="h-10 w-[150px] shrink-0 border-white/10 bg-[#2c2c2c] text-xs text-[#e6e6e6]" data-testid="bottom-provider-select">
                <SelectValue />
                <span>{provider === 'openai' ? 'OpenAI' : 'god-tibo-imagen'}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="god-tibo">god-tibo-imagen</SelectItem>
              </SelectContent>
            </Select>

            {canEdit && !shouldEdit && (
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="h-10 shrink-0 rounded-lg border-white/10 bg-[#2c2c2c] px-3 text-[#e6e6e6] hover:bg-white/10 hover:text-white"
                disabled={isGenerating || !prompt.trim()}
                onClick={() => {
                  setMode('edit');
                  void onEdit();
                }}
              >
                <Pencil className="h-4 w-4" />
                Apply edit
              </Button>
            )}

            <Button
              type="button"
              size="lg"
              className="h-10 shrink-0 rounded-lg bg-[#0d99ff] px-4 text-white hover:bg-[#0b85df]"
              disabled={isPrimaryDisabled}
              onClick={submitPrimary}
              data-testid="bottom-primary-action"
            >
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : shouldEdit ? <Pencil className="h-4 w-4" /> : <Wand2 className="h-4 w-4" />}
              {primaryLabel}
            </Button>
          </div>

          <div className="mt-1 flex items-center justify-between px-12 text-[10px] text-[#666]">
            <span>Cmd+Enter to submit · paste images to add references</span>
            <span>{prompt.length} chars</span>
          </div>
        </div>
      </div>
    </div>
  );
}
