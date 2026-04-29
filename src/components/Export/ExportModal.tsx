"use client";

import { Download, FileImage, Images } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCanvasDownload } from '@/hooks/useCanvasDownload';
import { useCanvasStore } from '@/stores/useCanvasStore';

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canExport: boolean;
}

export function ExportModal({ open, onOpenChange, canExport }: ExportModalProps) {
  const focusedImageIds = useCanvasStore((s) => s.focusedImageIds);
  const images = useCanvasStore((s) => s.images);
  const { downloadCanvasImage } = useCanvasDownload();
  const focusedImages = focusedImageIds.map((id) => images[id]).filter((image) => image !== undefined);

  const handleDownload = (imageId: string) => {
    if (!canExport) return;
    void downloadCanvasImage(imageId);
  };

  const handleDownloadAll = async () => {
    if (!canExport) return;
    for (const image of focusedImages) {
      await downloadCanvasImage(image.id);
      await new Promise((resolve) => { window.setTimeout(resolve, 200); });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-white/10 bg-[#252525] text-[#e6e6e6] sm:max-w-md" data-testid="export-modal">
        <DialogHeader>
          <DialogTitle className="text-white">Export focused images</DialogTitle>
          <DialogDescription className="text-[#999]">
            Download annotated PNGs for images currently focused on the canvas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {focusedImages.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-[#1e1e1e] p-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] text-neutral-500">
                <FileImage className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-white">Focus an image on the canvas to export it</p>
              <p className="mt-1 text-xs text-[#999]">Click an image, then export its annotated PNG.</p>
            </div>
          )}

          {focusedImages.length > 1 && (
            <Button type="button" className="w-full bg-[#0d99ff] text-white hover:bg-[#0b85df]" onClick={() => void handleDownloadAll()}>
              <Images className="h-4 w-4" />
              Download all ({focusedImages.length})
            </Button>
          )}

          <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {focusedImages.map((image) => (
              <div key={image.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#1e1e1e] p-2.5">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-black">
                  <img src={image.url} alt={image.prompt || 'Focused image'} className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">PNG · {image.id.slice(0, 8)}</p>
                  <p className="line-clamp-2 text-xs leading-5 text-[#999]">{image.prompt || 'No prompt'}</p>
                </div>
                <Button type="button" size="sm" variant="secondary" onClick={() => handleDownload(image.id)}>
                  <Download className="h-4 w-4" />
                  PNG
                </Button>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="border-white/10 bg-[#1e1e1e]">
          <Button type="button" variant="ghost" className="text-[#b3b3b3] hover:bg-white/10 hover:text-white" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" className="bg-[#0d99ff] text-white hover:bg-[#0b85df]" disabled={!canExport || focusedImages.length === 0} onClick={() => focusedImages[0] && handleDownload(focusedImages[0].id)}>
            <Download className="h-4 w-4" />
            Download PNG{focusedImages.length > 1 ? ' (first)' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
