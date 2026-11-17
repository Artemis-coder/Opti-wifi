'use client';

import React, { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

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

  // Remise à zéro à la fermeture : ajustement pendant le rendu plutôt que dans un effet
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (!isOpen) {
      setConfirmText('');
      setError('');
      setLoading(false);
    }
  }

  const isConfirmed = confirmText.trim() === CONFIRM_WORD;

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Vider les données du POS"
      className="sm:max-w-md"
    >
      <div className="space-y-4">
        {/* Warning banner */}
        <div className="bg-danger-soft rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-danger-soft text-danger flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-danger">
                Action irréversible
              </h4>
              <p className="text-xs text-danger leading-relaxed">
                Vous êtes sur le point de purger définitivement les données du point de vente{' '}
                <strong className="font-semibold text-danger">
                  &laquo; {posName} &raquo;
                </strong>.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-danger/30 text-xs text-danger space-y-1.5 pl-1">
            <p className="font-semibold text-xs text-danger">
              Seront supprimés :
            </p>
            <ul className="space-y-1 pl-3 list-disc">
              <li>Toutes les allocations de tickets</li>
              <li>Toutes les collectes et encaissements enregistrés</li>
              <li>Tous les détails de vente d&apos;articles associés</li>
            </ul>
            <p className="text-xs text-danger pt-1">
              Le point de vente lui-même et ses paramètres restent conservés.
            </p>
          </div>
        </div>

        {/* Confirmation input */}
        <div className="space-y-1.5">
          <Input
            id="reset-confirm-input"
            label={`Tapez "${CONFIRM_WORD}" pour confirmer`}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
            placeholder={CONFIRM_WORD}
            autoComplete="off"
            autoFocus
            className="font-mono font-semibold text-center sm:text-left text-danger border-danger/30 focus:ring-focus"
            helperText={
              !isConfirmed && confirmText.length > 0
                ? `Veuillez saisir exactement "${CONFIRM_WORD}"`
                : undefined
            }
          />
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 rounded-xl bg-danger-soft text-danger text-xs font-medium">
            {error}
          </div>
        )}

        {/* Modal Actions conforming to Design System */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:justify-end pt-3 border-t border-separator">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Annuler
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleReset}
            disabled={!isConfirmed || loading}
            isLoading={loading}
            className="w-full sm:w-auto"
          >
            <Trash2 className="w-4 h-4 shrink-0" />
            <span>Vider définitivement</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
