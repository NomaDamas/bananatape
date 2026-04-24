"use client";

import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useToast } from '@/hooks/useToast';
import { CanvasContainer } from './Canvas/CanvasContainer';
import { TopToolbar } from './Toolbar/TopToolbar';
import { HistorySidebar } from './Sidebar/HistorySidebar';
import { ToastContainer } from './ToastContainer';
import { PromptComposerProvider } from './Composer/PromptComposerProvider';

export function EditorLayout() {
  useKeyboardShortcuts();
  const { toasts, removeToast } = useToast();

  return (
    <PromptComposerProvider>
      <div className="flex flex-col h-screen w-screen bg-white dark:bg-neutral-950 overflow-hidden">
        <TopToolbar />
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 relative">
            <CanvasContainer className="absolute inset-0" />
          </div>
          <HistorySidebar />
        </div>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </div>
    </PromptComposerProvider>
  );
}
