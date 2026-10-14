'use client';

import { useEffect } from 'react';
import { notifyError } from '@/lib/telegram';

declare global {
  interface Window {
    __TELEGRAM_ERROR_HANDLER__: boolean;
  }
}

export function initErrorReporting() {
  if (typeof window === 'undefined' || window.__TELEGRAM_ERROR_HANDLER__) return;
  window.__TELEGRAM_ERROR_HANDLER__ = true;

  window.addEventListener('error', (event) => {
    notifyError({
      source: 'Client (window.onerror)',
      error: event.message,
      stack: event.error?.stack,
      severity: 'high',
      context: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        url: window.location.href,
      },
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    notifyError({
      source: 'Client (unhandledrejection)',
      error: event.reason?.message || String(event.reason),
      stack: event.reason?.stack,
      severity: 'high',
      context: {
        url: window.location.href,
      },
    });
  });

  const originalConsoleError = console.error;
  console.error = (...args) => {
    originalConsoleError.apply(console, args);
    const error = args.find(arg => arg instanceof Error);
    if (error) {
      notifyError({
        source: 'Client (console.error)',
        error: error.message,
        stack: error.stack,
        severity: 'medium',
        context: {
          url: window.location.href,
          args: args.map(a => (a instanceof Error ? a.message : String(a))).slice(0, 5),
        },
      });
    }
  };
}

export function ErrorReporter({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initErrorReporting();
  }, []);

  return <>{children}</>;
}