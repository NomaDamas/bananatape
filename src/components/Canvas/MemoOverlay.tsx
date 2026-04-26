"use client";

import { useCallback } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import {
  estimateStickyMemoSize,
  STICKY_MEMO_FONT_SIZE,
  STICKY_MEMO_LINE_HEIGHT,
} from '@/lib/canvas/annotation-rendering';

interface MemoOverlayProps {
  imageSize: { width: number; height: number };
}

export function MemoOverlay({ imageSize }: MemoOverlayProps) {
  const memos = useEditorStore((s) => s.memos);
  const activeMemoId = useEditorStore((s) => s.activeMemoId);
  const updateMemo = useEditorStore((s) => s.updateMemo);
  const setActiveMemoId = useEditorStore((s) => s.setActiveMemoId);
  const deleteMemo = useEditorStore((s) => s.deleteMemo);

  const handleBlur = useCallback(
    (id: string, text: string) => {
      if (!text.trim()) {
        deleteMemo(id);
      }
      setActiveMemoId(null);
    },
    [deleteMemo, setActiveMemoId]
  );

  if (!imageSize.width) return null;

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
      {memos.map((memo) => {
        const x = memo.x * imageSize.width;
        const y = memo.y * imageSize.height;
        const isActive = memo.id === activeMemoId;
        const memoSize = estimateStickyMemoSize(memo.text);

        return (
          <div
            key={memo.id}
            data-testid="sticky-memo"
            className="absolute pointer-events-auto"
            style={{
              left: x,
              top: y,
              zIndex: isActive ? 50 : 10,
            }}
          >
            <div
              className="rounded-lg border border-yellow-500/60 shadow-lg transition-[width,height] duration-100"
              style={{
                backgroundColor: memo.color,
                width: memoSize.width,
              }}
            >
              <textarea
                autoFocus={isActive}
                value={memo.text}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                data-gramm="false"
                data-gramm_editor="false"
                data-enable-grammarly="false"
                className="w-full resize-none bg-transparent p-3 text-neutral-950 placeholder-yellow-700 outline-none"
                rows={memoSize.rows}
                style={{
                  minHeight: memoSize.height,
                  fontSize: STICKY_MEMO_FONT_SIZE,
                  lineHeight: `${STICKY_MEMO_LINE_HEIGHT}px`,
                }}
                placeholder="Write edit note..."
                onChange={(e) => updateMemo(memo.id, e.target.value)}
                onBlur={(e) => handleBlur(memo.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleBlur(memo.id, (e.target as HTMLTextAreaElement).value);
                  }
                  if (e.key === 'Escape') {
                    handleBlur(memo.id, (e.target as HTMLTextAreaElement).value);
                  }
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
