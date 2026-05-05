"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
} from 'react';
import { useCanvasExport } from '@/hooks/useCanvasExport';
import { useParallelGenerate } from '@/hooks/useParallelGenerate';
import { normalizeReferenceFiles } from '@/lib/images/normalize-reference-files';
import { SUPPORTED_REFERENCE_IMAGE_FORMAT_LABEL } from '@/lib/images/reference-image-formats';
import { buildSubmittedPrompt as buildPromptPure } from '@/lib/prompt/build';
import { countFocusedAnnotations, hasBusyFocusedBranches, isEditableGenerationSource } from '@/lib/generation/branch-busy';
import { useToast } from '@/hooks/useToast';
import { useEditorStore } from '@/stores/useEditorStore';
import { useCanvasStore } from '@/stores/useCanvasStore';
import { useHistoryStore } from '@/stores/useHistoryStore';
import { LIVE2D_DEFAULT_USER_PROMPT } from '@/lib/live2d/contract';
import type { Live2DHiddenAreaNote } from '@/lib/live2d/contract';
import type { Provider } from '@/types';
import { outputSizeToDims, resolveAutoSize } from '@/lib/generation/output-size';

export interface ReferenceImage {
  id: string;
  file: File;
  previewUrl: string;
  persistedReferenceId?: string;
  ownsPreviewUrl?: boolean;
}

type ReferenceSource = 'file-picker' | 'paste';

interface PromptComposerContextValue {
  prompt: string;
  setPrompt: (prompt: string) => void;
  referenceImages: ReferenceImage[];
  systemPrompt: string;
  setSystemPrompt: (prompt: string) => void;
  designContext: string;
  designContextFileName: string;
  live2dEnabled: boolean;
  live2dPartLabels: Record<string, string>;
  live2dHiddenAreaNotes: Live2DHiddenAreaNote[];
  enableLive2D: () => Promise<void>;
  setLive2DPartLabels: (labels: Record<string, string>) => void;
  setLive2DHiddenAreaNotes: (notes: Live2DHiddenAreaNote[]) => void;
  replaceDesignContext: (file: File) => Promise<void>;
  clearDesignContext: () => Promise<void>;
  addReferenceFiles: (files: File[], source?: ReferenceSource) => Promise<void>;
  removeReferenceImage: (id: string) => void;
  clearReferenceImages: () => void;
  clearPromptComposer: () => void;
  handleGenerate: () => Promise<void>;
  handleEdit: () => Promise<void>;
  canEdit: boolean;
  hasReferenceImages: boolean;
  hasDesignContext: boolean;
}

const OPENAI_MAX_INPUT_IMAGES = 16;
const EDIT_FLOW_RESERVED_IMAGES = 2;
const ANNOTATION_ONLY_EDIT_PROMPT = 'Apply the changes indicated by the annotations on the image.';

const PromptComposerContext = createContext<PromptComposerContextValue | null>(null);

export function PromptComposerProvider({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState('');
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [designContext, setDesignContext] = useState('');
  const [designContextFileName, setDesignContextFileName] = useState('');
  const [live2dEnabled, setLive2DEnabled] = useState(false);
  const [live2dPartLabels, setLive2DPartLabels] = useState<Record<string, string>>({});
  const [live2dHiddenAreaNotes, setLive2DHiddenAreaNotes] = useState<Live2DHiddenAreaNote[]>([]);
  const referenceImagesRef = useRef<ReferenceImage[]>([]);
  const didLoadProjectSettingsRef = useRef(false);

  const provider = useEditorStore((s) => s.provider);
  const parallelCount = useEditorStore((s) => s.parallelCount);
  const outputSize = useEditorStore((s) => s.outputSize);
  const setMode = useEditorStore((s) => s.setMode);
  const isGenerating = useEditorStore((s) => s.isGenerating);
  const setIsGenerating = useEditorStore((s) => s.setIsGenerating);
  const baseImage = useEditorStore((s) => s.baseImage);
  const setBaseImage = useEditorStore((s) => s.setBaseImage);
  const clearAnnotations = useEditorStore((s) => s.clearAnnotations);
  const paths = useEditorStore((s) => s.paths);
  const boxes = useEditorStore((s) => s.boxes);
  const memos = useEditorStore((s) => s.memos);

  const addEntry = useHistoryStore((s) => s.addEntry);
  const selectedHistoryId = useHistoryStore((s) => s.selectedId);
  const { exportAnnotatedImage, exportMask, resizeToSize } = useCanvasExport();
  const parallelGenerate = useParallelGenerate();
  const { addToast } = useToast();
  const focusedImageIds = useCanvasStore((s) => s.focusedImageIds);
  const focusedImagePromptValue = useCanvasStore((s) =>
    s.focusedImageIds.length === 1 ? s.images[s.focusedImageIds[0]]?.prompt ?? '' : null,
  );
  const focusedBranchGenerating = useCanvasStore((s) => hasBusyFocusedBranches(s.images, s.focusedImageIds));
  const focusedReadyImageCount = useCanvasStore((s) => s.focusedImageIds.filter((id) => isEditableGenerationSource(s.images[id])).length);
  const focusedAnnotationCount = useCanvasStore((s) => countFocusedAnnotations(s.images, s.focusedImageIds));
  const viewportPanX = useCanvasStore((s) => s.viewport.panX);
  const viewportPanY = useCanvasStore((s) => s.viewport.panY);
  const viewportZoom = useCanvasStore((s) => s.viewport.zoom);

  const canEdit = !!baseImage || focusedReadyImageCount > 0;
  const hasReferenceImages = referenceImages.length > 0;
  const hasDesignContext = designContext.trim().length > 0;
  const hasAnnotations = paths.length > 0 || boxes.length > 0 || memos.some((memo) => memo.text.trim()) || focusedAnnotationCount > 0;

  useEffect(() => {
    referenceImagesRef.current = referenceImages;
  }, [referenceImages]);

  useEffect(() => {
    if (focusedImagePromptValue === null) return;
    startTransition(() => {
      setPrompt((current) => (current === focusedImagePromptValue ? current : focusedImagePromptValue));
    });
  }, [focusedImageIds, focusedImagePromptValue]);

  useEffect(() => {
    if (focusedImageIds.length !== 1) return;
    const focusedImageId = focusedImageIds[0];
    const timeout = window.setTimeout(() => {
      const current = useCanvasStore.getState().images[focusedImageId];
      if (!current || current.prompt === prompt) return;
      useCanvasStore.getState().updateImage(focusedImageId, { prompt }, { track: false });
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [focusedImageIds, prompt]);

  useEffect(() => {
    return () => {
      referenceImagesRef.current.forEach((image) => {
        if (image.ownsPreviewUrl) URL.revokeObjectURL(image.previewUrl);
      });
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrateProjectSettings() {
      try {
        const response = await fetch('/api/projects/settings', { cache: 'no-store' });
        if (!response.ok) return;
        const settings = await response.json();
        if (cancelled) return;

        setSystemPrompt(typeof settings.systemPrompt === 'string' ? settings.systemPrompt : '');
        setDesignContext(typeof settings.designContext === 'string' ? settings.designContext : '');
        setDesignContextFileName(typeof settings.designContextFileName === 'string' ? settings.designContextFileName : '');
        setLive2DEnabled(settings.live2d?.enabled === true);
        setLive2DPartLabels(settings.live2d?.partLabels && typeof settings.live2d.partLabels === 'object' ? settings.live2d.partLabels : {});
        setLive2DHiddenAreaNotes(Array.isArray(settings.live2d?.hiddenAreaNotes) ? settings.live2d.hiddenAreaNotes : []);

        if (Array.isArray(settings.referenceImages)) {
          const persistedReferences = await Promise.all(settings.referenceImages.map(async (reference: {
            id: string;
            assetUrl: string;
            name: string;
            mimeType: string;
          }) => {
            const blob = await fetch(reference.assetUrl, { cache: 'no-store' }).then((assetResponse) => assetResponse.blob());
            return {
              id: reference.id,
              persistedReferenceId: reference.id,
              file: new File([blob], reference.name || 'reference.png', { type: reference.mimeType || blob.type || 'image/png' }),
              previewUrl: reference.assetUrl,
              ownsPreviewUrl: false,
            } satisfies ReferenceImage;
          }));
          if (!cancelled) setReferenceImages(persistedReferences);
        }
      } catch {
        // No active project settings endpoint in no-project/dev mode.
      } finally {
        didLoadProjectSettingsRef.current = true;
      }
    }

    void hydrateProjectSettings();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!didLoadProjectSettingsRef.current) return;
    const timeout = window.setTimeout(() => {
      void fetch('/api/projects/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt }),
      }).catch(() => {
        // No-project/dev mode keeps the system prompt in memory only.
      });
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [systemPrompt]);

  const addReferenceFiles = useCallback(async (files: File[], source: ReferenceSource = 'file-picker') => {
    const result = await normalizeReferenceFiles(files);

    if (result.rejectedCount > 0) {
      addToast(
        `Some images could not be converted. Please use ${SUPPORTED_REFERENCE_IMAGE_FORMAT_LABEL}.`,
        'error',
      );
    } else if (result.ignoredCount > 0 && result.files.length === 0) {
      addToast(
        `Please attach an image in ${SUPPORTED_REFERENCE_IMAGE_FORMAT_LABEL} format.`,
        'error',
      );
    }

    if (result.files.length === 0) return;

    const localReferences = result.files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      ownsPreviewUrl: true,
    }));

    setReferenceImages((current) => [...current, ...localReferences]);

    void (async () => {
      try {
        const formData = new FormData();
        result.files.forEach((file) => formData.append('referenceImages', file, file.name));
        const response = await fetch('/api/projects/references', { method: 'POST', body: formData });
        if (!response.ok) return;
        const payload = await response.json();
        if (!Array.isArray(payload.referenceImages)) return;
        setReferenceImages((current) => current.map((reference) => {
          const localIndex = localReferences.findIndex((local) => local.id === reference.id);
          const persisted = payload.referenceImages[localIndex];
          return persisted ? {
            ...reference,
            persistedReferenceId: persisted.id,
          } : reference;
        }));
      } catch {
        // No-project/dev mode keeps reference images in memory only.
      }
    })();

    if (result.convertedCount > 0) {
      addToast(
        result.convertedCount === 1
          ? 'Converted image to PNG for upload.'
          : `Converted ${result.convertedCount} images to PNG for upload.`,
        'success',
      );
    } else if (source === 'paste') {
      addToast(
        result.files.length === 1
          ? 'Pasted image added as a reference'
          : `${result.files.length} pasted images added as references`,
        'success',
      );
    }
  }, [addToast]);

  useLayoutEffect(() => {
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
      void addReferenceFiles(files, 'paste');
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [addReferenceFiles, isGenerating]);

  const removeReferenceImage = useCallback((id: string) => {
    setReferenceImages((current) => {
      const image = current.find((item) => item.id === id);
      if (image?.ownsPreviewUrl) URL.revokeObjectURL(image.previewUrl);
      if (image?.persistedReferenceId) {
        void fetch(`/api/projects/references?referenceId=${encodeURIComponent(image.persistedReferenceId)}`, {
          method: 'DELETE',
        }).catch(() => undefined);
      }
      return current.filter((item) => item.id !== id);
    });
  }, []);

  const clearReferenceImages = useCallback(() => {
    setReferenceImages((current) => {
      current.forEach((image) => {
        if (image.ownsPreviewUrl) URL.revokeObjectURL(image.previewUrl);
      });
      void fetch('/api/projects/references', { method: 'DELETE' }).catch(() => undefined);
      return [];
    });
  }, []);

  const clearPromptComposer = useCallback(() => {
    setPrompt('');
  }, []);

  const enableLive2D = useCallback(async () => {
    setLive2DEnabled(true);
    try {
      const response = await fetch('/api/projects/live2d/manifest', { method: 'PUT' });
      if (!response.ok && response.status !== 404) {
        const payload = await response.json().catch(() => ({}));
        addToast(typeof payload?.error === 'string' ? payload.error : 'Could not enable Live2D mode', 'error');
        return;
      }
      if (response.ok) {
        const payload = await response.json().catch(() => null);
        if (payload?.settings) {
          setSystemPrompt(typeof payload.settings.systemPrompt === 'string' ? payload.settings.systemPrompt : systemPrompt);
          setLive2DEnabled(payload.settings.live2d?.enabled === true);
          setLive2DPartLabels(payload.settings.live2d?.partLabels ?? {});
          setLive2DHiddenAreaNotes(payload.settings.live2d?.hiddenAreaNotes ?? []);
        }
        addToast('Live2D handoff mode enabled', 'success');
      }
    } catch {
      // No-project/dev mode keeps Live2D state in memory only.
    }
  }, [addToast, systemPrompt]);

  const replaceDesignContext = useCallback(async (file: File) => {
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.md') && !lowerName.endsWith('.markdown')) {
      addToast('Design context must be a .md or .markdown file', 'error');
      return;
    }

    let nextContent: string;
    try {
      nextContent = await file.text();
    } catch {
      addToast('Could not read the design context file', 'error');
      return;
    }

    setDesignContext(nextContent);
    setDesignContextFileName(file.name);

    try {
      const formData = new FormData();
      formData.append('designContext', file, file.name);
      const response = await fetch('/api/projects/design-context', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok && response.status !== 404) {
        const payload = await response.json().catch(() => ({}));
        addToast(typeof payload?.error === 'string' ? payload.error : 'Could not save design context', 'error');
        return;
      }
      if (response.ok) {
        const payload = await response.json().catch(() => null);
        if (payload && typeof payload.designContext === 'string') {
          setDesignContext(payload.designContext);
          setDesignContextFileName(typeof payload.designContextFileName === 'string' ? payload.designContextFileName : file.name);
        }
        addToast('Design context updated', 'success');
      }
    } catch {
      // No-project/dev mode keeps the design context in memory only.
    }
  }, [addToast]);

  const clearDesignContext = useCallback(async () => {
    setDesignContext('');
    setDesignContextFileName('');
    try {
      await fetch('/api/projects/design-context', { method: 'DELETE' });
    } catch {
      // No-project/dev mode keeps state in memory only.
    }
  }, []);

  const buildSubmittedPrompt = useCallback(
    (fallbackPrompt?: string) => buildPromptPure({
      userPrompt: prompt,
      systemPrompt,
      designContext,
      fallbackPrompt: fallbackPrompt ?? (live2dEnabled ? LIVE2D_DEFAULT_USER_PROMPT : undefined),
    }),
    [designContext, live2dEnabled, prompt, systemPrompt],
  );

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
    const submittedPrompt = prompt.trim() || (live2dEnabled ? LIVE2D_DEFAULT_USER_PROMPT : '');
    if (!submittedPrompt) return;
    if (focusedImageIds.length > 0 && focusedBranchGenerating) return;
    if (!validateOpenAIReferenceCount()) return;
    setMode('generate');

    try {
      const rootOrigin = {
        x: (-viewportPanX + 96) / viewportZoom,
        y: (-viewportPanY + 96) / viewportZoom,
      };
      await parallelGenerate.generate({
        count: parallelCount,
        prompt: submittedPrompt,
        systemPrompt,
        designContext,
        referenceImages: referenceImages.map((reference) => ({ file: reference.file, id: reference.id })),
        parentIds: focusedImageIds,
        rootOrigin,
        outputSize,
      });
      startTransition(() => {
        setMode('edit');
        clearPromptComposer();
      });
      addToast('Generation started', 'success');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Generation failed';
      addToast(message, 'error');
    }
  }, [
    addToast,
    clearPromptComposer,
    designContext,
    focusedBranchGenerating,
    parallelCount,
    parallelGenerate,
    live2dEnabled,
    prompt,
    referenceImages,
    focusedImageIds,
    outputSize,
    setMode,
    systemPrompt,
    validateOpenAIReferenceCount,
    viewportPanX,
    viewportPanY,
    viewportZoom,
  ]);

  const handleEdit = useCallback(async () => {
    const submittedPrompt = prompt.trim() || (hasAnnotations ? ANNOTATION_ONLY_EDIT_PROMPT : '');
    if (!submittedPrompt) return;
    if (!validateOpenAIReferenceCount(EDIT_FLOW_RESERVED_IMAGES)) return;
    setMode('edit');

    if (focusedImageIds.length > 0) {
      if (focusedBranchGenerating) return;
      try {
        await parallelGenerate.generate({
          count: parallelCount,
          prompt: submittedPrompt,
          systemPrompt,
          designContext,
          referenceImages: referenceImages.map((reference) => ({ file: reference.file, id: reference.id })),
          parentIds: focusedImageIds,
          outputSize,
        });
        startTransition(() => {
          clearPromptComposer();
        });
        addToast('Generation started', 'success');
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Edit failed';
        addToast(message, 'error');
      }
      return;
    }

    if (!baseImage || isGenerating) return;
    setIsGenerating(true);

    try {
      const [annotatedBlob, maskBlob] = await Promise.all([
        exportAnnotatedImage(),
        exportMask(),
      ]);

      const formData = new FormData();
      formData.append('prompt', buildSubmittedPrompt(ANNOTATION_ONLY_EDIT_PROMPT));
      formData.append('provider', provider);
      if (selectedHistoryId) formData.append('parentId', selectedHistoryId);

      let originalBlob = await fetch(baseImage).then((r) => r.blob());
      let resizedAnnotated = annotatedBlob;
      let resizedMask = maskBlob;

      const imageSize = useEditorStore.getState().imageSize;
      const baseDims = imageSize.width > 0 && imageSize.height > 0
        ? imageSize
        : null;
      const resolvedSize = outputSize === 'auto' ? resolveAutoSize(baseDims) : outputSize;

      const { width, height } = outputSizeToDims(resolvedSize);
      originalBlob = await resizeToSize(originalBlob, width, height);
      resizedAnnotated = await resizeToSize(annotatedBlob, width, height);
      resizedMask = await resizeToSize(maskBlob, width, height);

      formData.append('images', originalBlob, 'original.png');
      formData.append('images', resizedAnnotated, 'annotated.png');
      appendReferenceImages(formData, 'images');
      formData.append('maskImage', resizedMask, 'mask.png');
      formData.append('size', resolvedSize);

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
          id: data.metadata?.id,
          timestamp: data.metadata?.timestamp,
          imageDataUrl: data.imageDataUrl,
          assetId: data.assetId,
          assetUrl: data.assetUrl,
          prompt: submittedPrompt,
          provider,
          type: 'edit',
          parentId: data.metadata?.parentId,
        });
        setBaseImage(data.assetUrl ?? data.imageDataUrl, { width: 0, height: 0 });
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
    buildSubmittedPrompt,
    clearAnnotations,
    clearPromptComposer,
    exportAnnotatedImage,
    exportMask,
    designContext,
    focusedBranchGenerating,
    focusedImageIds,
    hasAnnotations,
    isGenerating,
    outputSize,
    parallelCount,
    parallelGenerate,
    prompt,
    provider,
    referenceImages,
    resizeToSize,
    selectedHistoryId,
    setBaseImage,
    setIsGenerating,
    setMode,
    systemPrompt,
    validateOpenAIReferenceCount,
  ]);

  const value = useMemo<PromptComposerContextValue>(() => ({
    prompt,
    setPrompt,
    referenceImages,
    systemPrompt,
    setSystemPrompt,
    designContext,
    designContextFileName,
    live2dEnabled,
    live2dPartLabels,
    live2dHiddenAreaNotes,
    enableLive2D,
    setLive2DPartLabels,
    setLive2DHiddenAreaNotes,
    replaceDesignContext,
    clearDesignContext,
    addReferenceFiles,
    removeReferenceImage,
    clearReferenceImages,
    clearPromptComposer,
    handleGenerate,
    handleEdit,
    canEdit,
    hasReferenceImages,
    hasDesignContext,
  }), [
    addReferenceFiles,
    canEdit,
    clearDesignContext,
    clearPromptComposer,
    clearReferenceImages,
    designContext,
    designContextFileName,
    enableLive2D,
    live2dEnabled,
    live2dPartLabels,
    live2dHiddenAreaNotes,
    handleEdit,
    handleGenerate,
    hasDesignContext,
    hasReferenceImages,
    prompt,
    referenceImages,
    replaceDesignContext,
    systemPrompt,
    setSystemPrompt,
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
    { value: 'god-tibo', label: 'codex' },
    { value: 'openai', label: 'OpenAI' },
  ];
}
