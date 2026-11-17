'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { buttonVariants } from '@heroui/styles';
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

/** Demande avant de déconnecter l'utilisateur (tous les boutons « Déconnexion »). */
export function confirmLogout(): Promise<boolean> {
  return confirmAction('Voulez-vous vraiment vous déconnecter ?', {
    title: 'Déconnexion',
    confirmLabel: 'Se déconnecter',
    cancelLabel: 'Annuler',
    danger: true,
  });
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
      className="fixed inset-0 flex flex-col justify-end sm:justify-center items-center px-3.5 sm:px-4 bg-backdrop md-anim-fade"
      style={{ zIndex: 60 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-overlay text-overlay-foreground rounded-2xl shadow-overlay md-anim-scale elevate-above-bottom-nav p-5 space-y-4"
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'w-10 h-10 shrink-0 rounded-full flex items-center justify-center',
              danger ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning-soft-foreground'
            )}
          >
            <AlertTriangle className="w-5 h-5" />
          </span>
          <div className="min-w-0 space-y-1">
            <h2 id="confirm-title" className="text-base font-semibold text-foreground">
              {request.title || 'Confirmer l’action'}
            </h2>
            <p id="confirm-message" className="text-sm text-muted whitespace-pre-line break-words">
              {request.message}
            </p>
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={() => close(false)}
            className={buttonVariants({ variant: 'tertiary' })}
          >
            {request.cancelLabel || 'Annuler'}
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => close(true)}
            className={buttonVariants({ variant: danger ? 'danger' : 'primary' })}
          >
            {request.confirmLabel || 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  );
}
