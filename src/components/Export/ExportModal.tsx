"use client";

import { Download, FileImage, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDownload } from '@/hooks/useDownload';

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canExport: boolean;
}

export function ExportModal({ open, onOpenChange, canExport }: ExportModalProps) {
  const { downloadImage } = useDownload();

  const handleDownload = () => {
    if (!canExport) return;
    downloadImage();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-white/10 bg-[#252525] text-[#e6e6e6] sm:max-w-md" data-testid="export-modal">
        <DialogHeader>
          <DialogTitle className="text-white">Export image</DialogTitle>
          <DialogDescription className="text-[#999]">
            Download the active BananaTape image using the implemented export path.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex w-full items-center gap-3 rounded-xl border border-[#0d99ff]/50 bg-[#0d99ff]/10 p-3 text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0d99ff] text-white">
              <FileImage className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">PNG · current image</p>
              <p className="text-xs text-[#999]">Uses the existing download behavior for the active image.</p>
            </div>
            <Download className="h-4 w-4 text-[#b3b3b3]" />
          </div>

          <div className="rounded-xl border border-white/10 bg-[#1e1e1e] p-3">
            <div className="flex items-start gap-2 text-xs text-[#999]">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#fbbf24]" />
              <p>
                JPG, WebP, SVG, scale controls, copy links, and sharing are omitted until real implementations exist.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="border-white/10 bg-[#1e1e1e]">
          <Button type="button" variant="ghost" className="text-[#b3b3b3] hover:bg-white/10 hover:text-white" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" className="bg-[#0d99ff] text-white hover:bg-[#0b85df]" disabled={!canExport} onClick={handleDownload}>
            <Download className="h-4 w-4" />
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
