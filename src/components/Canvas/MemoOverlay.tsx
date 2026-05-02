"use client";

import { useCallback, useRef } from 'react';
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
  const commitMemoText = useEditorStore((s) => s.commitMemoText);
  const setActiveMemoId = useEditorStore((s) => s.setActiveMemoId);
  const deleteMemo = useEditorStore((s) => s.deleteMemo);
  const editStartSnapshotsRef = useRef(new Map<string, typeof memos>());

  const handleFocus = useCallback((id: string) => {
    if (!editStartSnapshotsRef.current.has(id)) {
      editStartSnapshotsRef.current.set(id, useEditorStore.getState().memos);
    }
    setActiveMemoId(id);
  }, [setActiveMemoId]);

  const handleBlur = useCallback(
    (id: string, text: string) => {
      const startMemos = editStartSnapshotsRef.current.get(id);
      editStartSnapshotsRef.current.delete(id);
      const initialMemo = startMemos?.find((memo) => memo.id === id);
      const shouldCommitAsEdit = !!initialMemo && initialMemo.text.length > 0 && initialMemo.text !== text;

      if (!text.trim()) {
        if (shouldCommitAsEdit && startMemos) {
          deleteMemo(id, { historySnapshot: { memos: startMemos } });
        } else {
          deleteMemo(id, { track: false });
        }
        setActiveMemoId(null);
        return;
      }

      if (shouldCommitAsEdit && startMemos) {
        commitMemoText(id, text, { historySnapshot: { memos: startMemos } });
      }
      setActiveMemoId(null);
    },
    [commitMemoText, deleteMemo, setActiveMemoId]
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
                onFocus={() => handleFocus(memo.id)}
                onChange={(e) => updateMemo(memo.id, e.target.value, { track: false })}
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
