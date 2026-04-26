"use client";

import { useMemo, useState } from 'react';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useToast } from '@/hooks/useToast';
import { useEditorStore } from '@/stores/useEditorStore';
import { CanvasContainer } from './Canvas/CanvasContainer';
import { PromptComposerProvider, usePromptComposer } from './Composer/PromptComposerProvider';
import { BottomComposer } from './Composer/BottomComposer';
import { ExportModal } from './Export/ExportModal';
import { HistorySidebar } from './Sidebar/HistorySidebar';
import { LeftPanel } from './Sidebar/LeftPanel';
import { TopBar } from './Shell/TopBar';
import { ToastContainer } from './ToastContainer';

export function EditorLayout() {
  return (
    <PromptComposerProvider>
      <StandaloneEditorShell />
    </PromptComposerProvider>
  );
}

function StandaloneEditorShell() {
  useKeyboardShortcuts();

  const { toasts, removeToast } = useToast();
  const baseImage = useEditorStore((s) => s.baseImage);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const {
    prompt,
    setPrompt,
    referenceImages,
    systemPrompt,
    setSystemPrompt,
    addReferenceFiles,
    removeReferenceImage,
    clearReferenceImages,
    handleGenerate,
    handleEdit,
  } = usePromptComposer();

  const referencePreviews = useMemo(() => (
    referenceImages.map((reference) => ({
      id: reference.id,
      previewUrl: reference.previewUrl,
      file: reference.file,
      name: reference.file.name,
    }))
  ), [referenceImages]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#1e1e1e] text-[#e6e6e6]">
      <TopBar canExport={!!baseImage} onExportClick={() => setIsExportOpen(true)} />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <LeftPanel
          references={referencePreviews}
          onAddReferenceFiles={addReferenceFiles}
          onRemoveReference={removeReferenceImage}
          onClearReferences={clearReferenceImages}
          systemPrompt={systemPrompt}
          onSystemPromptChange={setSystemPrompt}
        />
        <main className="relative min-w-0 flex-1 overflow-hidden">
          <CanvasContainer className="h-full w-full" />
        </main>
        <HistorySidebar />
      </div>
      <BottomComposer
        prompt={prompt}
        onPromptChange={setPrompt}
        references={referencePreviews}
        onAddReferenceFiles={addReferenceFiles}
        onRemoveReference={removeReferenceImage}
        onGenerate={handleGenerate}
        onEdit={handleEdit}
      />
      <ExportModal open={isExportOpen} onOpenChange={setIsExportOpen} canExport={!!baseImage} />
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
