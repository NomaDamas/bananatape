"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useCanvasExport } from '@/hooks/useCanvasExport';
import { useToast } from '@/hooks/useToast';
import { useEditorStore } from '@/stores/useEditorStore';
import { useHistoryStore } from '@/stores/useHistoryStore';
import type { Provider } from '@/types';

export interface ReferenceImage {
  id: string;
  file: File;
  previewUrl: string;
}

type ReferenceSource = 'file-picker' | 'paste';

interface PromptComposerContextValue {
  prompt: string;
  setPrompt: (prompt: string) => void;
  referenceImages: ReferenceImage[];
  addReferenceFiles: (files: File[], source?: ReferenceSource) => void;
  removeReferenceImage: (id: string) => void;
  clearReferenceImages: () => void;
  clearPromptComposer: () => void;
  handleGenerate: () => Promise<void>;
  handleEdit: () => Promise<void>;
  canEdit: boolean;
  hasReferenceImages: boolean;
}

const OPENAI_MAX_INPUT_IMAGES = 16;
const EDIT_FLOW_RESERVED_IMAGES = 2;

const PromptComposerContext = createContext<PromptComposerContextValue | null>(null);

export function PromptComposerProvider({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState('');
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const referenceImagesRef = useRef<ReferenceImage[]>([]);

  const provider = useEditorStore((s) => s.provider);
  const setMode = useEditorStore((s) => s.setMode);
  const isGenerating = useEditorStore((s) => s.isGenerating);
  const setIsGenerating = useEditorStore((s) => s.setIsGenerating);
  const baseImage = useEditorStore((s) => s.baseImage);
  const setBaseImage = useEditorStore((s) => s.setBaseImage);
  const clearAnnotations = useEditorStore((s) => s.clearAnnotations);

  const addEntry = useHistoryStore((s) => s.addEntry);
  const { exportAnnotatedImage, exportMask, resizeToSquare1024 } = useCanvasExport();
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

  const addReferenceFiles = useCallback((files: File[], source: ReferenceSource = 'file-picker') => {
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

  const removeReferenceImage = useCallback((id: string) => {
    setReferenceImages((current) => {
      const image = current.find((item) => item.id === id);
      if (image) URL.revokeObjectURL(image.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  }, []);

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

  const appendReferenceImages = useCallback((formData: FormData, fieldName: 'images' | 'referenceImages') => {
    referenceImages.forEach((reference, index) => {
      formData.append(fieldName, reference.file, `reference-${index + 1}-${reference.file.name}`);
    });
  }, [referenceImages]);

  const validateOpenAIReferenceCount = useCallback((reservedImages = 0) => {
    if (provider !== 'openai') return true;

    const maxReferences = OPENAI_MAX_INPUT_IMAGES - reservedImages;
    if (referenceImages.length <= maxReferences) return true;

    addToast(
      `OpenAI supports up to ${OPENAI_MAX_INPUT_IMAGES} total input images. Remove ${referenceImages.length - maxReferences} reference image(s) for this action.`,
      'error',
    );
    return false;
  }, [addToast, provider, referenceImages.length]);

  const handleGenerate = useCallback(async () => {
    const submittedPrompt = prompt.trim();
    if (!submittedPrompt || isGenerating) return;
    if (!validateOpenAIReferenceCount()) return;
    setMode('generate');
    setIsGenerating(true);

    try {
      const request = referenceImages.length > 0
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
  }, [
    addEntry,
    addToast,
    appendReferenceImages,
    clearPromptComposer,
    isGenerating,
    prompt,
    provider,
    referenceImages.length,
    setBaseImage,
    setIsGenerating,
    setMode,
    validateOpenAIReferenceCount,
  ]);

  const handleEdit = useCallback(async () => {
    const submittedPrompt = prompt.trim();
    if (!baseImage || !submittedPrompt || isGenerating) return;
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

      let originalBlob = await fetch(baseImage).then((r) => r.blob());

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
  }, [
    addEntry,
    addToast,
    appendReferenceImages,
    baseImage,
    clearAnnotations,
    clearPromptComposer,
    exportAnnotatedImage,
    exportMask,
    isGenerating,
    prompt,
    provider,
    resizeToSquare1024,
    setBaseImage,
    setIsGenerating,
    setMode,
    validateOpenAIReferenceCount,
  ]);

  const value = useMemo<PromptComposerContextValue>(() => ({
    prompt,
    setPrompt,
    referenceImages,
    addReferenceFiles,
    removeReferenceImage,
    clearReferenceImages,
    clearPromptComposer,
    handleGenerate,
    handleEdit,
    canEdit,
    hasReferenceImages,
  }), [
    addReferenceFiles,
    canEdit,
    clearPromptComposer,
    clearReferenceImages,
    handleEdit,
    handleGenerate,
    hasReferenceImages,
    prompt,
    referenceImages,
    removeReferenceImage,
  ]);

  return (
    <PromptComposerContext.Provider value={value}>
      {children}
    </PromptComposerContext.Provider>
  );
}

export function usePromptComposer() {
  const context = useContext(PromptComposerContext);
  if (!context) {
    throw new Error('usePromptComposer must be used within PromptComposerProvider');
  }
  return context;
}

export function getEnabledProviders(): Array<{ value: Provider; label: string }> {
  return [
    { value: 'openai', label: 'OpenAI' },
    { value: 'god-tibo', label: 'god-tibo-imagen' },
  ];
}
