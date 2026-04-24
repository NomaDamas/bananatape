"use client";

import { useState } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { useHistoryStore } from '@/stores/useHistoryStore';
import { useCanvasExport } from '@/hooks/useCanvasExport';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Wand2, Pencil, Loader2, Image as ImageIcon, Download } from 'lucide-react';
import { ToolPalette } from './ToolPalette';
import { useDownload } from '@/hooks/useDownload';
import { useToast } from '@/hooks/useToast';

export function TopToolbar() {
  const [prompt, setPrompt] = useState('');

  const provider = useEditorStore((s) => s.provider);
  const setProvider = useEditorStore((s) => s.setProvider);
  const mode = useEditorStore((s) => s.mode);
  const setMode = useEditorStore((s) => s.setMode);
  const isGenerating = useEditorStore((s) => s.isGenerating);
  const setIsGenerating = useEditorStore((s) => s.setIsGenerating);
  const baseImage = useEditorStore((s) => s.baseImage);
  const setBaseImage = useEditorStore((s) => s.setBaseImage);
  const clearAnnotations = useEditorStore((s) => s.clearAnnotations);

  const addEntry = useHistoryStore((s) => s.addEntry);
  const { exportAnnotatedImage, exportMask, resizeToSquare1024 } = useCanvasExport();
  const { downloadImage } = useDownload();
  const { addToast } = useToast();

  const canEdit = !!baseImage;

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    setMode('generate');
    setIsGenerating(true);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, provider }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        addToast(data.error || 'Generation failed', 'error');
        return;
      }
      if (data.imageDataUrl) {
        addEntry({
          imageDataUrl: data.imageDataUrl,
          prompt,
          provider,
          type: 'generate',
        });
        setBaseImage(data.imageDataUrl, { width: 0, height: 0 });
        addToast('Image generated successfully', 'success');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Generation failed';
      addToast(message, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEdit = async () => {
    if (!canEdit || !prompt.trim() || isGenerating) return;
    setMode('edit');
    setIsGenerating(true);

    try {
      const [annotatedBlob, maskBlob] = await Promise.all([
        exportAnnotatedImage(),
        exportMask(),
      ]);

      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('provider', provider);

      let originalBlob = await fetch(baseImage!).then((r) => r.blob());

      if (provider === 'openai') {
        originalBlob = await resizeToSquare1024(originalBlob);
      }

      formData.append('images', originalBlob, 'original.png');
      formData.append('images', annotatedBlob, 'annotated.png');
      formData.append('maskImage', maskBlob, 'mask.png');

      const res = await fetch('/api/edit', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        addToast(data.error || 'Edit failed', 'error');
        return;
      }
      if (data.imageDataUrl) {
        addEntry({
          imageDataUrl: data.imageDataUrl,
          prompt,
          provider,
          type: 'edit',
        });
        setBaseImage(data.imageDataUrl, { width: 0, height: 0 });
        clearAnnotations();
        addToast('Image edited successfully', 'success');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Edit failed';
      addToast(message, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="h-14 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-3 px-4 bg-white dark:bg-neutral-950 shrink-0">
        <div className="flex items-center gap-2 shrink-0">
          <ImageIcon className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
          <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
            CodexDesign
          </span>
        </div>

        <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-800 mx-1" />

        <ToolPalette />

        <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-800 mx-1" />

        <Select value={provider} onValueChange={(v) => setProvider(v as 'openai' | 'god-tibo')} data-testid="provider-select">
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="openai">OpenAI</SelectItem>
            <SelectItem value="god-tibo">god-tibo-imagen</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1 max-w-xl">
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
