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
          className={`px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium transition-all animate-in slide-in-from-bottom-2 ${
            toast.type === 'error'
              ? 'bg-red-600 text-white'
              : toast.type === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
          }`}
          onClick={() => removeToast(toast.id)}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
