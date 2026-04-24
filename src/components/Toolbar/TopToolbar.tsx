"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
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
import { Wand2, Pencil, Loader2, Download, ImagePlus, X } from 'lucide-react';
import { ToolPalette } from './ToolPalette';
import { useDownload } from '@/hooks/useDownload';
import { useToast } from '@/hooks/useToast';
import { BrandLogo } from '@/components/BrandLogo';

interface ReferenceImage {
  id: string;
  file: File;
  previewUrl: string;
}

const OPENAI_MAX_INPUT_IMAGES = 16;
const EDIT_FLOW_RESERVED_IMAGES = 2;

export function TopToolbar() {
  const [prompt, setPrompt] = useState('');
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const referenceImagesRef = useRef<ReferenceImage[]>([]);
  const referenceInputRef = useRef<HTMLInputElement | null>(null);

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
  const hasReferenceImages = referenceImages.length > 0;

  useEffect(() => {
    referenceImagesRef.current = referenceImages;
  }, [referenceImages]);

  useEffect(() => {
    return () => {
      referenceImagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    };
  }, []);

  const addReferenceFiles = useCallback((files: File[], source: 'file-picker' | 'paste' = 'file-picker') => {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    setReferenceImages((current) => [
      ...current,
      ...imageFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);

    if (source === 'paste') {
      addToast(
        imageFiles.length === 1
          ? 'Pasted image added as a reference'
          : `${imageFiles.length} pasted images added as references`,
        'success',
      );
    }
  }, [addToast]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (isGenerating) return;

      const clipboardData = event.clipboardData;
      if (!clipboardData) return;

      const itemFiles = Array.from(clipboardData.items ?? [])
        .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((file): file is File => file instanceof File);
      const files = itemFiles.length > 0
        ? itemFiles
        : Array.from(clipboardData.files ?? []).filter((file) => file.type.startsWith('image/'));

      if (files.length === 0) return;

      event.preventDefault();
      addReferenceFiles(files, 'paste');
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [addReferenceFiles, isGenerating]);

  const handleReferenceImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    addReferenceFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  };

  const removeReferenceImage = (id: string) => {
    setReferenceImages((current) => {
      const image = current.find((item) => item.id === id);
      if (image) URL.revokeObjectURL(image.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  };

  const clearReferenceImages = useCallback(() => {
    setReferenceImages((current) => {
      current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      return [];
    });
  }, []);

  const clearPromptComposer = useCallback(() => {
    setPrompt('');
    clearReferenceImages();
  }, [clearReferenceImages]);

  const appendReferenceImages = (formData: FormData, fieldName: 'images' | 'referenceImages') => {
    referenceImages.forEach((reference, index) => {
      formData.append(fieldName, reference.file, `reference-${index + 1}-${reference.file.name}`);
    });
  };

  const validateOpenAIReferenceCount = (reservedImages = 0) => {
    if (provider !== 'openai') return true;

    const maxReferences = OPENAI_MAX_INPUT_IMAGES - reservedImages;
    if (referenceImages.length <= maxReferences) return true;

    addToast(
      `OpenAI supports up to ${OPENAI_MAX_INPUT_IMAGES} total input images. Remove ${referenceImages.length - maxReferences} reference image(s) for this action.`,
      'error',
    );
    return false;
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    if (!validateOpenAIReferenceCount()) return;
    setMode('generate');
    setIsGenerating(true);

    try {
      const request = hasReferenceImages
        ? (() => {
            const formData = new FormData();
            formData.append('prompt', prompt);
            formData.append('provider', provider);
            appendReferenceImages(formData, 'referenceImages');
            return fetch('/api/generate', {
              method: 'POST',
              body: formData,
            });
          })()
        : fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, provider }),
          });

      const res = await request;
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
        clearPromptComposer();
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
    if (!validateOpenAIReferenceCount(EDIT_FLOW_RESERVED_IMAGES)) return;
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
      appendReferenceImages(formData, 'images');
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
        clearPromptComposer();
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
        <BrandLogo className="shrink-0" />

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
