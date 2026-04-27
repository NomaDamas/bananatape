"use client";

import { Download, PanelLeft, Sparkles } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TopBarProps {
  canExport: boolean;
  onExportClick: () => void;
  projectName?: string;
  className?: string;
}

export function TopBar({ canExport, onExportClick, projectName = 'Untitled design', className }: TopBarProps) {
  return (
    <header
      data-testid="standalone-top-bar"
      className={cn(
        'flex h-10 shrink-0 items-center justify-between border-b border-white/10 bg-[#2c2c2c] px-3 text-[#e6e6e6] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <BrandLogo showWordmark={false} className="[&>div]:h-6 [&>div]:w-6 [&_svg]:h-4 [&_svg]:w-4" />
        <div className="hidden h-4 w-px bg-white/15 sm:block" />
        <div className="flex min-w-0 items-center gap-1.5 text-xs">
          <span className="hidden text-[#b3b3b3] sm:inline">BananaTape</span>
          <span className="hidden text-[#666] sm:inline">/</span>
          <span className="truncate font-medium text-white" title={projectName}>{projectName}</span>
        </div>
      </div>

      <div className="hidden items-center rounded-md bg-[#1e1e1e] p-0.5 md:flex" aria-label="Workspace mode">
        <span className="rounded px-3 py-1 text-[11px] font-medium text-white shadow-sm bg-[#3b3b3b]">Canvas</span>
        <span className="px-3 py-1 text-[11px] font-medium text-[#808080]" aria-disabled="true">Slides</span>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 gap-1.5 rounded-md px-2 text-[#b3b3b3] hover:bg-white/10 hover:text-white"
          disabled={!canExport}
          onClick={onExportClick}
          title={canExport ? 'Export current image' : 'Generate or load an image to export'}
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
        <div className="mx-1 h-5 w-px bg-white/10" />
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="h-7 w-7 rounded-md text-[#b3b3b3] hover:bg-white/10 hover:text-white"
          disabled
          title="Panels are fixed in this version"
        >
          <PanelLeft className="h-3.5 w-3.5" />
        </Button>
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#0d99ff] to-[#a78bfa] text-white">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
      </div>
    </header>
  );
}
