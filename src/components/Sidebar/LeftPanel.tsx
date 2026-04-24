"use client";

import { useMemo, useRef, useState } from 'react';
import { ImagePlus, Layers3, Palette, Sparkles, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useEditorStore } from '@/stores/useEditorStore';
import { cn } from '@/lib/utils';
import type { ReferenceImagePreview } from '@/components/Composer/types';

interface LeftPanelProps {
  references: ReferenceImagePreview[];
  onAddReferenceFiles: (files: File[]) => void;
  onRemoveReference: (id: string) => void;
  onClearReferences: () => void;
  systemPrompt: string;
  onSystemPromptChange: (value: string) => void;
  className?: string;
}

const STYLE_PRESETS = [
  'Editorial product shot',
  'Soft studio lighting',
  'Minimal clay render',
  'High contrast poster',
];

export function LeftPanel({
  references,
  onAddReferenceFiles,
  onRemoveReference,
  onClearReferences,
  systemPrompt,
  onSystemPromptChange,
  className,
}: LeftPanelProps) {
  const [tab, setTab] = useState<'context' | 'styles'>('context');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const paths = useEditorStore((s) => s.paths);
  const boxes = useEditorStore((s) => s.boxes);
  const memos = useEditorStore((s) => s.memos);
  const baseImage = useEditorStore((s) => s.baseImage);
  const clearAnnotations = useEditorStore((s) => s.clearAnnotations);

  const layerRows = useMemo(() => [
    { label: 'Image', count: baseImage ? 1 : 0 },
    { label: 'Draw paths', count: paths.length },
    { label: 'Regions', count: boxes.length },
    { label: 'Memos', count: memos.length },
  ], [baseImage, boxes.length, memos.length, paths.length]);

  const annotationCount = paths.length + boxes.length + memos.length;

  return (
    <aside
      data-testid="standalone-left-panel"
      className={cn('flex w-[248px] shrink-0 flex-col border-r border-white/10 bg-[#252525] text-[#e6e6e6]', className)}
    >
      <div className="flex h-9 items-center border-b border-white/10 px-2">
        <button
          type="button"
          className={cn('h-6 rounded px-3 text-[11px] font-semibold', tab === 'context' ? 'bg-[#3b3b3b] text-white' : 'text-[#999] hover:text-white')}
          onClick={() => setTab('context')}
        >
          Context
        </button>
        <button
          type="button"
          className={cn('h-6 rounded px-3 text-[11px] font-semibold', tab === 'styles' ? 'bg-[#3b3b3b] text-white' : 'text-[#999] hover:text-white')}
          onClick={() => setTab('styles')}
        >
          Styles
        </button>
      </div>

      {tab === 'context' ? (
        <div className="flex-1 overflow-y-auto py-2">
          <section className="border-b border-[#1e1e1e] px-3 py-2">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[#999]">
              <Sparkles className="h-3 w-3" />
              System Prompt
              <span className="rounded bg-[#3b2f16] px-1.5 py-0.5 text-[9px] normal-case tracking-normal text-[#fbbf24]">not applied</span>
            </div>
            <Textarea
              value={systemPrompt}
              onChange={(event) => onSystemPromptChange(event.target.value)}
              placeholder="Visible notes only — not submitted with prompts yet."
              className="min-h-20 resize-none border-white/10 bg-[#1e1e1e] text-xs text-[#e6e6e6] placeholder:text-[#666] focus-visible:ring-[#0d99ff]/40"
            />
            <p className="mt-1.5 text-[10px] leading-4 text-[#808080]">
              Guardrail: these notes are not silently prepended to API prompts.
            </p>
          </section>

          <section className="border-b border-[#1e1e1e] px-3 py-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[#999]">
                <ImagePlus className="h-3 w-3" />
                References
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-[#b3b3b3]">{references.length}</span>
              </div>
              {references.length > 0 && (
                <button type="button" className="text-[10px] text-[#808080] hover:text-white" onClick={onClearReferences}>
                  Clear
                </button>
              )}
            </div>
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
            />
            {references.length === 0 ? (
              <button
                type="button"
                className="flex h-24 w-full flex-col items-center justify-center rounded-lg border border-dashed border-white/15 bg-[#1e1e1e] text-xs text-[#808080] hover:border-[#0d99ff]/60 hover:text-[#e6e6e6]"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="mb-2 h-4 w-4" />
                Add reference images
              </button>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {references.map((reference) => (
                  <div key={reference.id} className="group relative aspect-square overflow-hidden rounded-md border border-white/10 bg-[#111]">
                    <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${reference.previewUrl})` }} aria-label={reference.name ?? 'Reference image'} />
                    <button
                      type="button"
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => onRemoveReference(reference.id)}
                      aria-label="Remove reference image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="flex aspect-square items-center justify-center rounded-md border border-dashed border-white/15 text-[#808080] hover:border-[#0d99ff]/60 hover:text-white"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Add more reference images"
                >
                  <ImagePlus className="h-4 w-4" />
                </button>
              </div>
            )}
          </section>

          <section className="px-3 py-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[#999]">
                <Layers3 className="h-3 w-3" />
                Canvas Layers
              </div>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                className="h-6 w-6 text-[#808080] hover:bg-white/10 hover:text-white"
                disabled={annotationCount === 0}
                onClick={clearAnnotations}
                title="Clear annotations"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-1">
              {layerRows.map((row) => (
                <div key={row.label} className="flex h-8 items-center justify-between rounded-md bg-[#1e1e1e] px-2 text-xs">
                  <span className={row.count ? 'text-[#d4d4d4]' : 'text-[#666]'}>{row.label}</span>
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-[#b3b3b3]">{row.count}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[#999]">
            <Palette className="h-3 w-3" />
            Prompt style notes
          </div>
          <div className="space-y-2">
            {STYLE_PRESETS.map((preset) => (
              <div key={preset} className="rounded-lg border border-white/10 bg-[#1e1e1e] p-3">
                <p className="text-xs font-medium text-[#e6e6e6]">{preset}</p>
                <p className="mt-1 text-[10px] text-[#808080]">Preset insertion is coming soon; copy this wording into your prompt manually.</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
