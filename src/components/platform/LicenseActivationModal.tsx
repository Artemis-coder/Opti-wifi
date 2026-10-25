'use client';

import React, { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { formatCurrencyFCFA, formatDateOnlyFR } from '@/lib/utils/format';
import type { SubscriptionPlan } from '@/types/platform';

const DURATIONS = [1, 3, 6, 12, 24];

const PERIOD_LABELS: Record<string, string> = {
  monthly: 'mois',
  quarterly: 'trimestre',
  semiannual: 'semestre',
  annual: 'an',
};

interface LicenseActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivated: () => void;
  organizationId: string;
  organizationName: string;
  /** Licence en cours : la nouvelle période démarrera à sa date de fin si elle court encore. */
  currentEndDate?: string | null;
  defaultPlanId?: string | null;
  defaultDurationMonths?: number;
  /** Demande client à approuver en même temps que l'activation. */
  requestId?: string | null;
}

export function LicenseActivationModal({
  isOpen,
  onClose,
  onActivated,
  organizationId,
  organizationName,
  currentEndDate,
  defaultPlanId,
  defaultDurationMonths = 1,
  requestId,
}: LicenseActivationModalProps) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [planId, setPlanId] = useState(defaultPlanId || '');
  const [months, setMonths] = useState(defaultDurationMonths);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Le parent monte la fenêtre à l'ouverture : l'état initial vient des props.
  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/platform/plans')
      .then((r) => r.json())
      .then((res) => {
        const active = ((res.data || []) as SubscriptionPlan[]).filter((p) => p.status === 'active');
        setPlans(active);
        if (active[0]) setPlanId((current) => current || active[0].id);
      })
      .catch(() => toast.error('Impossible de charger les forfaits'));
  }, [isOpen]);

  const now = new Date();
  const start = currentEndDate && new Date(currentEndDate) > now ? new Date(currentEndDate) : now;
  const end = new Date(start);
  end.setMonth(end.getMonth() + months);
  const plan = plans.find((p) => p.id === planId);

  async function handleSubmit() {
    if (!planId) {
      toast.error('Choisissez un forfait');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/platform/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, planId, durationMonths: months, requestId: requestId || null, note }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Erreur lors de l'activation");
        return;
      }
      toast.success(`Licence activée jusqu'au ${formatDateOnlyFR(result.data.end_date)}`);
      onActivated();
      onClose();
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Activer une licence">
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Client : <span className="font-semibold text-slate-900 dark:text-white">{organizationName}</span>
        </p>

        <CustomSelect
          label="Forfait"
          value={planId}
          onChange={setPlanId}
          options={plans.map((p) => ({
            value: p.id,
            label: p.name,
            sublabel: formatCurrencyFCFA(Number(p.price)),
          }))}
          placeholder="Choisir un forfait"
        />

        <div>
          <span className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Durée</span>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <Button
                key={d}
                type="button"
                size="sm"
                variant={months === d ? 'primary' : 'outline'}
                onClick={() => setMonths(d)}
              >
                {d} mois
              </Button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="license-note" className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">
            Note (optionnel)
          </label>
          <textarea
            id="license-note"
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex. paiement Mobile Money reçu le…"
            className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-sm text-slate-700 dark:text-slate-300">
          <p>
            Période : <strong>{formatDateOnlyFR(start.toISOString())}</strong> →{' '}
            <strong>{formatDateOnlyFR(end.toISOString())}</strong>
          </p>
          {plan && (
            <p className="text-xs text-slate-500 mt-1">
              Tarif du forfait : {formatCurrencyFCFA(Number(plan.price))} / {PERIOD_LABELS[plan.billing_period] || plan.billing_period}
            </p>
          )}
          {start > now && (
            <p className="text-xs text-slate-500 mt-1">La licence en cours est prolongée à partir de sa date de fin.</p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button type="button" onClick={handleSubmit} isLoading={submitting} disabled={!planId}>
            <KeyRound className="w-4 h-4 mr-1.5" />
            Activer la licence
          </Button>
        </div>
      </div>
    </Modal>
  );
}
