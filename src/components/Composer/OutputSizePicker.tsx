"use client";

import { Frame } from 'lucide-react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger } from '@/components/ui/select';
import { useEditorStore } from '@/stores/useEditorStore';
import {
  OUTPUT_SIZE_GROUPS,
  type OutputSize,
} from '@/lib/generation/output-size';

function formatTriggerLabel(size: OutputSize): string {
  if (size === 'auto') return 'Auto';
  const [w, h] = size.split('x');
  return `${w}×${h}`;
}

export function OutputSizePicker() {
  const outputSize = useEditorStore((s) => s.outputSize);
  const setOutputSize = useEditorStore((s) => s.setOutputSize);

  return (
    <Select value={outputSize} onValueChange={(value) => setOutputSize(value as OutputSize)}>
      <SelectTrigger
        className="h-10 min-w-0 border-white/10 bg-[#2c2c2c] text-xs text-[#e6e6e6] sm:w-[120px]"
        data-testid="bottom-output-size-select"
        title="Output size — Auto matches the source image's aspect ratio"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <Frame className="h-3.5 w-3.5 shrink-0 text-[#b3b3b3]" />
          <span className="truncate">{formatTriggerLabel(outputSize)}</span>
        </span>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Auto</SelectLabel>
          <SelectItem value="auto">
            <span className="flex flex-col items-start gap-0.5">
              <span>Auto</span>
              <span className="text-[10px] text-muted-foreground">Follows source aspect</span>
            </span>
          </SelectItem>
        </SelectGroup>
        {OUTPUT_SIZE_GROUPS.map((group) => (
          <SelectGroup key={group.label}>
            <SelectLabel>{group.label}</SelectLabel>
            {group.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <span className="flex flex-col items-start gap-0.5">
                  <span>{option.label}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {option.aspectLabel} · {option.megapixels}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
