"use client";

import { useMemo, useState } from 'react';
import { BoxSelect, CheckCircle2, Download, WandSparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LIVE2D_HIDDEN_AREA_PRESETS, LIVE2D_PART_LABELS, LIVE2D_REQUIRED_PARTS } from '@/lib/live2d/parts';
import { useCanvasStore } from '@/stores/useCanvasStore';
import { useHistoryStore } from '@/stores/useHistoryStore';

interface Live2DPanelProps {
  live2dEnabled: boolean;
  onEnableLive2D: () => Promise<void> | void;
  partLabels: Record<string, string>;
  onPartLabelsChange: (labels: Record<string, string>) => void;
  hiddenAreaNotes: Array<{ part: string; note: string }>;
  onHiddenAreaNotesChange: (notes: Array<{ part: string; note: string }>) => void;
}

export function Live2DPanel({
  live2dEnabled,
  onEnableLive2D,
  partLabels,
  onPartLabelsChange,
  hiddenAreaNotes,
  onHiddenAreaNotesChange,
}: Live2DPanelProps) {
  const [isWriting, setIsWriting] = useState(false);
  const selectedImageId = useCanvasStore((s) => {
    if (s.focusedImageIds.length === 1) return s.focusedImageIds[0];
    return s.imageOrder.find((id) => s.images[id]?.status === 'ready') ?? null;
  });
  const selectedImage = useCanvasStore((s) => (selectedImageId ? s.images[selectedImageId] : undefined));
  const boxes = selectedImage?.boxes ?? [];
  const entries = useHistoryStore((s) => s.entries);

  const selectedHistoryEntryId = selectedImageId
    ? entries.find((entry) => entry.imageId === selectedImageId)?.id ?? null
    : null;
  const assignedCount = boxes.filter((box) => partLabels[box.id]).length;
  const missingParts = useMemo(() => (
    LIVE2D_REQUIRED_PARTS.filter((part) => !Object.values(partLabels).includes(part))
  ), [partLabels]);

  const setPartForBox = (boxId: string, part: string) => {
    onPartLabelsChange({ ...partLabels, [boxId]: part });
  };

  const applyHiddenAreaPresets = () => {
    const existing = new Set(hiddenAreaNotes.map((note) => `${note.part}:${note.note}`));
    const next = [...hiddenAreaNotes];
    LIVE2D_HIDDEN_AREA_PRESETS.forEach((preset) => {
      const key = `${preset.part}:${preset.note}`;
      if (!existing.has(key)) next.push(preset);
    });
    onHiddenAreaNotesChange(next);
  };

  const writeManifest = async () => {
    setIsWriting(true);
    try {
      await fetch('/api/projects/live2d/manifest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedHistoryEntryId,
          boxes,
          partLabels,
          hiddenAreaNotes,
        }),
      });
    } finally {
      setIsWriting(false);
    }
  };

  return (
    <section data-testid="live2d-panel" className="border-b border-[#1e1e1e] px-3 py-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[#999]">
          <WandSparkles className="h-3 w-3" />
          Live2D handoff
          {live2dEnabled && (
            <span className="rounded bg-[#14351f] px-1.5 py-0.5 text-[9px] normal-case tracking-normal text-[#86efac]">
              enabled
            </span>
          )}
        </div>
        {!live2dEnabled && (
          <Button type="button" size="xs" className="h-6 bg-[#0d99ff] text-[10px] text-white hover:bg-[#0b85df]" onClick={() => void onEnableLive2D()}>
            Enable
          </Button>
        )}
      </div>

      <p className="mb-2 text-[10px] leading-4 text-[#808080]">
        Enable this, attach reference image(s), then Generate can run even with an empty prompt using the enforced Live2D part-sheet prompt. Use canvas boxes as Live2D part bboxes, then write <code className="rounded bg-[#1e1e1e] px-1 text-[#cfcfcf]">live2d/manifest.json</code> for WaifuGenerator.
      </p>

      <div className="mb-2 grid grid-cols-3 gap-1 text-center text-[10px]">
        <div className="rounded bg-[#1e1e1e] p-1.5 text-[#b3b3b3]"><b className="text-white">{boxes.length}</b><br />boxes</div>
        <div className="rounded bg-[#1e1e1e] p-1.5 text-[#b3b3b3]"><b className="text-white">{assignedCount}</b><br />mapped</div>
        <div className="rounded bg-[#1e1e1e] p-1.5 text-[#b3b3b3]"><b className="text-white">{missingParts.length}</b><br />missing</div>
      </div>

      <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
        {boxes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/15 bg-[#1e1e1e] p-3 text-center text-[10px] text-[#808080]">
            <BoxSelect className="mx-auto mb-1 h-4 w-4" />
            Select one image and draw boxes around visible parts first.
          </div>
        ) : boxes.map((box, index) => (
          <div key={box.id} className="rounded-lg border border-white/10 bg-[#1e1e1e] p-2">
            <div className="mb-1 flex items-center justify-between text-[10px] text-[#999]">
              <span>Box {index + 1}</span>
              {partLabels[box.id] && <CheckCircle2 className="h-3 w-3 text-[#86efac]" />}
            </div>
            <Select value={partLabels[box.id] ?? ''} onValueChange={(value) => { if (value) setPartForBox(box.id, value); }}>
              <SelectTrigger size="sm" className="h-7 w-full border-white/10 bg-[#252525] text-xs text-[#e6e6e6]">
                <SelectValue placeholder="Map to Live2D part" />
              </SelectTrigger>
              <SelectContent className="max-h-72 border-white/10 bg-[#252525] text-[#e6e6e6]">
                {LIVE2D_REQUIRED_PARTS.map((part) => (
                  <SelectItem key={part} value={part}>
                    {LIVE2D_PART_LABELS[part]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        <Button type="button" size="xs" variant="secondary" className="flex-1 bg-[#2a2a2a] text-[10px] text-[#cfcfcf] hover:bg-[#3b3b3b]" onClick={applyHiddenAreaPresets}>
          Hidden notes
        </Button>
        <Button type="button" size="xs" className="flex-1 bg-[#0d99ff] text-[10px] text-white hover:bg-[#0b85df]" disabled={!selectedImageId || !selectedHistoryEntryId || isWriting} onClick={() => void writeManifest()}>
          <Download className="h-3 w-3" />
          Write manifest
        </Button>
      </div>
    </section>
  );
}
