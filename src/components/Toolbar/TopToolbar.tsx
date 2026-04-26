"use client";

import { useRef } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Wand2, Pencil, Loader2, Download, ImagePlus, X } from 'lucide-react';
import { ToolPalette } from './ToolPalette';
import { useDownload } from '@/hooks/useDownload';
import { BrandLogo } from '@/components/BrandLogo';
import { getEnabledProviders, usePromptComposer } from '@/components/Composer/PromptComposerProvider';
import type { Provider } from '@/types';

function formatProviderLabel(provider: Provider) {
  return provider === 'god-tibo' ? 'codex' : 'OpenAI';
}

export function TopToolbar() {
  const referenceInputRef = useRef<HTMLInputElement | null>(null);

  const {
    prompt,
    setPrompt,
    referenceImages,
    addReferenceFiles,
    removeReferenceImage,
    handleGenerate,
    handleEdit,
    canEdit,
    hasReferenceImages,
  } = usePromptComposer();

  const provider = useEditorStore((s) => s.provider);
  const setProvider = useEditorStore((s) => s.setProvider);
  const mode = useEditorStore((s) => s.mode);
  const isGenerating = useEditorStore((s) => s.isGenerating);
  const baseImage = useEditorStore((s) => s.baseImage);

  const { downloadImage } = useDownload();
  const providers = getEnabledProviders();

  const handleReferenceImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    void addReferenceFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  };

  return (
    <TooltipProvider>
      <div className="h-14 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-3 px-4 bg-white dark:bg-neutral-950 shrink-0">
        <BrandLogo className="shrink-0" />

        <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-800 mx-1" />

        <ToolPalette />

        <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-800 mx-1" />

        <Select value={provider} onValueChange={(v) => setProvider(v as Provider)} data-testid="provider-select">
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <span className="truncate">{formatProviderLabel(provider)}</span>
          </SelectTrigger>
          <SelectContent>
            {providers.map((item) => (
              <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1 max-w-xl flex items-center gap-2">
          <Input
            placeholder={mode === 'edit' ? 'Describe edits to apply...' : 'Describe what to generate...'}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.metaKey) {
                if (mode === 'edit') {
                  handleEdit();
                } else {
                  handleGenerate();
                }
              }
            }}
          />

          <input
            ref={referenceInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleReferenceImageChange}
            data-testid="reference-image-input"
          />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant={hasReferenceImages ? 'secondary' : 'ghost'}
                className="relative h-8 w-8 shrink-0"
                onClick={() => referenceInputRef.current?.click()}
                disabled={isGenerating}
                title="Add reference image"
              >
                <ImagePlus className="w-4 h-4" />
                {hasReferenceImages && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-medium text-white">
                    {referenceImages.length}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add reference image to this prompt</TooltipContent>
          </Tooltip>

          {hasReferenceImages && (
            <div className="flex items-center gap-1 shrink-0" data-testid="reference-image-list">
              {referenceImages.map((reference) => (
                <div
                  key={reference.id}
                  className="group relative h-8 w-8 overflow-hidden rounded border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <div
                    aria-label="Reference"
                    className="h-full w-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${reference.previewUrl})` }}
                  />
                  <button
                    type="button"
                    className="absolute inset-0 flex items-center justify-center bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => removeReferenceImage(reference.id)}
                    aria-label="Remove reference image"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="default"
              className="h-8 gap-1.5"
              disabled={isGenerating || !prompt.trim()}
              onClick={handleGenerate}
            >
              {isGenerating && mode === 'generate' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Wand2 className="w-3.5 h-3.5" />
              )}
              Generate
            </Button>
          </TooltipTrigger>
          <TooltipContent>Cmd+Enter</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                disabled={!canEdit || isGenerating || !prompt.trim()}
                onClick={handleEdit}
              >
                {isGenerating && mode === 'edit' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Pencil className="w-3.5 h-3.5" />
                )}
                Edit
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {!baseImage ? 'Load an image first' : 'Edit selected regions'}
          </TooltipContent>
        </Tooltip>

        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 px-0"
          disabled={!baseImage}
          onClick={downloadImage}
          title="Download image"
        >
          <Download className="w-4 h-4" />
        </Button>
      </div>
    </TooltipProvider>
  );
}
