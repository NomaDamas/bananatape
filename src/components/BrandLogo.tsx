import { Banana } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  className?: string;
  showWordmark?: boolean;
}

export function BrandLogo({ className, showWordmark = true }: BrandLogoProps) {
  return (
    <div className={cn('flex items-center gap-2', className)} aria-label="BananaTape">
      <div className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl border border-yellow-300/70 bg-yellow-100 shadow-sm dark:border-yellow-500/40 dark:bg-yellow-950/50">
        <Banana className="h-5 w-5 rotate-[-18deg] text-yellow-600 dark:text-yellow-300" aria-hidden="true" />
        <div className="absolute left-[-5px] top-[12px] h-2.5 w-11 rotate-[-24deg] border-y border-neutral-400/45 bg-neutral-300/75 shadow-[0_1px_0_rgba(255,255,255,0.55)_inset] dark:border-neutral-500/45 dark:bg-neutral-500/75" />
        <div className="absolute left-[4px] top-[13px] h-px w-1 bg-neutral-500/45 dark:bg-neutral-300/45" />
        <div className="absolute left-[13px] top-[9px] h-px w-1 bg-neutral-500/45 dark:bg-neutral-300/45" />
        <div className="absolute left-[21px] top-[16px] h-px w-1 bg-neutral-500/45 dark:bg-neutral-300/45" />
      </div>
      {showWordmark && (
        <span className="font-semibold text-sm tracking-tight text-neutral-900 dark:text-neutral-100">
          BananaTape
        </span>
      )}
    </div>
  );
}
