"use client";

import * as React from 'react';
import { useState, useCallback } from 'react';

export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error';
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (message: string, type?: Toast['type'], options?: { durationMs?: number; action?: Toast['action'] }) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast['type'] = 'info', options?: { durationMs?: number; action?: Toast['action'] }) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type, action: options?.action }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, options?.durationMs ?? 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const Provider = ToastContext.Provider;
  return (
    <Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
