'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Action destructive : bouton rouge. */
  danger?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  message: string;
  resolve: (ok: boolean) => void;
}

let show: ((request: PendingConfirm) => void) | null = null;

/**
 * Remplace window.confirm() : sur Android, la boîte native est dessinée par le téléphone
 * (thème système, boutons parfois masqués). Renvoie true si l'utilisateur confirme.
 */
export function confirmAction(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  if (!show) return Promise.resolve(window.confirm(message));
  return new Promise((resolve) => show?.({ message, resolve, ...options }));
}

/** À monter une seule fois (layout racine). */
export function ConfirmHost() {
  const [request, setRequest] = useState<PendingConfirm | null>(null);

  useEffect(() => {
    show = setRequest;
    return () => {
      show = null;
    };
  }, []);

  const close = (ok: boolean) => {
    request?.resolve(ok);
    setRequest(null);
  };

  useEffect(() => {
    if (!request) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      request.resolve(false);
      setRequest(null);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = 'unset';
    };
  }, [request]);

  if (!request) return null;
  const danger = request.danger ?? true;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      onClick={() => close(false)}
      className="fixed inset-0 flex flex-col justify-end sm:justify-center items-center px-3.5 sm:px-4 bg-slate-950/70 backdrop-blur-sm md-anim-fade"
      style={{ zIndex: 60 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 md-anim-scale elevate-above-bottom-nav p-5 space-y-4"
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'w-10 h-10 shrink-0 rounded-full flex items-center justify-center',
              danger ? 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
            )}
          >
            <AlertTriangle className="w-5 h-5" />
          </span>
          <div className="min-w-0 space-y-1">
            <h2 id="confirm-title" className="text-base font-bold text-slate-900 dark:text-white">
              {request.title || 'Confirmer l’action'}
            </h2>
            <p id="confirm-message" className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line break-words">
              {request.message}
            </p>
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={() => close(false)}
            className="h-12 sm:h-10 px-4 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
          >
            {request.cancelLabel || 'Annuler'}
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => close(true)}
            className={cn(
              'h-12 sm:h-10 px-4 rounded-xl text-sm font-semibold text-white transition',
              danger ? 'bg-red-600 hover:bg-red-500' : 'bg-brand-600 hover:bg-brand-500'
            )}
          >
            {request.confirmLabel || 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  );
}
