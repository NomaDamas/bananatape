"use client";

import { useToast } from '@/hooks/useToast';

interface ToastContainerProps {
  toasts: ReturnType<typeof useToast>['toasts'];
  removeToast: ReturnType<typeof useToast>['removeToast'];
}

export function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium transition-all animate-in slide-in-from-bottom-2 ${
            toast.type === 'error'
              ? 'bg-red-600 text-white'
              : toast.type === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
          }`}
          onClick={() => removeToast(toast.id)}
        >
          <span>{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className="rounded border border-current/30 px-2 py-0.5 text-xs font-semibold hover:bg-white/15"
              onClick={(event) => {
                event.stopPropagation();
                toast.action?.onClick();
                removeToast(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
