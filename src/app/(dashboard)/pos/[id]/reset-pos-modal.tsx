'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ResetPosModalProps {
  isOpen: boolean;
  posName: string;
  posId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const CONFIRM_WORD = 'VIDER';

export function ResetPosModal({
  isOpen,
  posName,
  posId,
  onClose,
  onSuccess,
}: ResetPosModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset state whenever modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setConfirmText('');
      setError('');
      setLoading(false);
    }
  }, [isOpen]);

  // Lock body scroll when modal open
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isConfirmed = confirmText === CONFIRM_WORD;

  const handleReset = async () => {
    if (!isConfirmed) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/pos/${posId}/reset`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Une erreur est survenue lors de la remise à zéro.');
        setLoading(false);
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setError('Impossible de contacter le serveur. Réessayez.');
      setLoading(false);
    }
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-pos-title"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal card */}
      <div className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-red-200 dark:border-red-900/40 overflow-hidden animate-[scale-in_200ms_ease-out]">

        {/* Red top accent */}
        <div className="h-1.5 bg-gradient-to-r from-red-500 to-red-700" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 id="reset-pos-title" className="text-base font-bold text-slate-900 dark:text-white">
                Vider les données du POS
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Action irréversible</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 space-y-5">
          {/* Warning description */}
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">
              Vous êtes sur le point de supprimer définitivement :
            </p>
            <ul className="text-xs text-red-700 dark:text-red-400 space-y-1 list-none pl-0">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                Toutes les <strong>allocations de tickets</strong> de ce POS
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                Toutes les <strong>collectes &amp; encaissements</strong>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                Tous les <strong>détails de collecte</strong> (lignes d&apos;articles)
              </li>
            </ul>
            <p className="text-xs text-red-600 dark:text-red-500 font-medium pt-1 border-t border-red-200 dark:border-red-800">
              Le point de vente <strong>&ldquo;{posName}&rdquo;</strong> lui-même sera conservé.
            </p>
          </div>

          {/* Confirmation input */}
          <div className="space-y-2">
            <label
              htmlFor="reset-confirm-input"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider"
            >
              Tapez{' '}
              <code className="bg-slate-100 dark:bg-slate-800 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded font-bold text-[11px]">
                {CONFIRM_WORD}
              </code>{' '}
              pour confirmer
            </label>
            <input
              id="reset-confirm-input"
              type="text"
              autoComplete="off"
              autoFocus
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              placeholder={CONFIRM_WORD}
              className="w-full h-11 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition font-mono tracking-widest"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 h-11 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
            >
              Annuler
            </button>
            <Button
              type="button"
              onClick={handleReset}
              disabled={!isConfirmed || loading}
              isLoading={loading}
              className="flex-1 h-11 bg-red-600 hover:bg-red-700 disabled:bg-red-300 dark:disabled:bg-red-900/40 text-white font-bold gap-2 rounded-xl transition disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Vider définitivement
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
