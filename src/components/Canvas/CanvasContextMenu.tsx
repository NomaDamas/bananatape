"use client";

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';

interface CanvasContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onDelete: () => void;
}

export function CanvasContextMenu({ open, x, y, onClose, onDelete }: CanvasContextMenuProps) {
  useEffect(() => {
    if (!open) return;
    const close = () => onClose();
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', close);
    };
  }, [onClose, open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed z-[120] min-w-36 overflow-hidden rounded-lg border border-white/10 bg-[#252525] p-1 text-sm text-neutral-100 shadow-2xl shadow-black/50"
      style={{ left: x, top: y }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-red-200 hover:bg-red-500/15 hover:text-red-100"
        onClick={() => {
          onDelete();
          onClose();
        }}
      >
        <Trash2 className="h-4 w-4" />
        Delete image
      </button>
    </div>,
    document.body,
  );
}
