"use client";

import { useState, useEffect, useRef, useCallback } from 'react';

interface SSEOptions {
  url: string;
  onMessage: (data: unknown) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

export function useSSE() {
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback((options: SSEOptions) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(options.url);
    eventSourceRef.current = es;
    setIsConnected(true);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        options.onMessage(data);
      } catch {
        options.onMessage(event.data);
      }
    };

    es.onerror = () => {
      setIsConnected(false);
      options.onError?.(new Error('SSE connection error'));
      es.close();
    };

    es.addEventListener('done', () => {
      setIsConnected(false);
      options.onClose?.();
      es.close();
    });

    return () => {
      es.close();
      setIsConnected(false);
    };
  }, []);

  const disconnect = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setIsConnected(false);
  }, []);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  return { connect, disconnect, isConnected };
}
