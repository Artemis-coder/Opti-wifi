'use client';

import React, { useEffect, useState } from 'react';
import { Gift, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { formatCurrencyFCFA, formatDateOnlyFR } from '@/lib/utils/format';
import type { SubscriptionPlan } from '@/types/platform';

const DURATIONS = [1, 3, 6, 12, 24];
const TRIAL_DAYS = [3, 5, 7, 14, 30];

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
  /** Nouveau client : propose d'abord l'essai gratuit (s'il y a droit) sur le forfait le moins cher qui en prévoit un. */
  preferTrial?: boolean;
}

/** Forfait qui prévoit des jours d'essai (offerts à la première souscription seulement). */
const isTrial = (p?: SubscriptionPlan) => Number(p?.trial_days ?? 0) > 0;

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
  preferTrial = false,
}: LicenseActivationModalProps) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [planId, setPlanId] = useState(defaultPlanId || '');
  const [months, setMonths] = useState(defaultDurationMonths);
  // Jours d'essai choisis ; null = jours d'essai prévus par le forfait
  const [days, setDays] = useState<number | null>(null);
  // Droit à l'essai : seulement si le client n'a encore jamais eu d'abonnement (null = en cours de vérification)
  const [trialAvailable, setTrialAvailable] = useState<boolean | null>(null);
  const [useTrial, setUseTrial] = useState(preferTrial);
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
        const first = (preferTrial && active.find(isTrial)) || active[0];
        if (first) setPlanId((current) => current || first.id);
      })
      .catch(() => toast.error('Impossible de charger les forfaits'));
    fetch(`/api/platform/licenses?organizationId=${encodeURIComponent(organizationId)}`)
      .then((r) => r.json())
      .then((res) => setTrialAvailable(res.data?.trial_available === true))
      .catch(() => setTrialAvailable(false));
  }, [isOpen, preferTrial, organizationId]);

  const now = new Date();
  const start = currentEndDate && new Date(currentEndDate) > now ? new Date(currentEndDate) : now;
  const plan = plans.find((p) => p.id === planId);
  // Essai : forfait qui en prévoit un, client qui y a droit, et choix « Essai gratuit »
  const canTrial = isTrial(plan) && trialAvailable === true;
  const trial = canTrial && useTrial;
  const trialDays = days ?? Number(plan?.trial_days ?? 0);
  const end = new Date(start);
  if (trial) end.setDate(end.getDate() + trialDays);
  else end.setMonth(end.getMonth() + months);
  const dayOptions = Array.from(new Set([...TRIAL_DAYS, Number(plan?.trial_days ?? 0)]))
    .filter((d) => d > 0)
    .sort((a, b) => a - b);

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
        body: JSON.stringify({
          organizationId,
          planId,
          durationMonths: months,
          durationDays: trial ? trialDays : null,
          trial: canTrial ? useTrial : undefined,
          requestId: requestId || null,
          note,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Erreur lors de l'activation");
        return;
      }
      toast.success(
        trial
          ? `Essai activé jusqu'au ${formatDateOnlyFR(result.data.end_date)}`
          : `Licence activée jusqu'au ${formatDateOnlyFR(result.data.end_date)}`
      );
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
          onChange={(id) => {
            setPlanId(id);
            setDays(null);
          }}
          options={plans.map((p) => ({
            value: p.id,
            label: p.name,
            sublabel:
              formatCurrencyFCFA(Number(p.price)) +
              (isTrial(p) && trialAvailable ? ` · essai gratuit possible (${p.trial_days} j)` : ''),
          }))}
          placeholder="Choisir un forfait"
        />

        {canTrial ? (
          <div>
            <span className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Type</span>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                size="sm"
                variant={useTrial ? 'primary' : 'outline'}
                onClick={() => setUseTrial(true)}
              >
                <Gift className="w-4 h-4 mr-1.5" /> Essai gratuit
              </Button>
              <Button
                type="button"
                size="sm"
                variant={useTrial ? 'outline' : 'primary'}
                onClick={() => setUseTrial(false)}
              >
                <KeyRound className="w-4 h-4 mr-1.5" /> Licence payante
              </Button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Première souscription de ce client : il peut bénéficier d&apos;un essai gratuit, une seule fois.
            </p>
          </div>
        ) : (
          isTrial(plan) &&
          trialAvailable === false && (
            <p className="text-xs text-slate-500 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-2">
              Ce client a déjà eu un abonnement : pas d&apos;essai gratuit, licence payante au tarif du forfait.
            </p>
          )
        )}

        {trial ? (
          <div>
            <span className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Jours d&apos;essai</span>
            <div className="flex flex-wrap gap-2">
              {dayOptions.map((d) => (
                <Button
                  key={d}
                  type="button"
                  size="sm"
                  variant={trialDays === d ? 'primary' : 'outline'}
                  onClick={() => setDays(d)}
                >
                  {d} jour{d > 1 ? 's' : ''}
                </Button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Essai gratuit, sans facture. À la fin de l&apos;essai, le client choisit un forfait payant pour continuer.
            </p>
          </div>
        ) : (
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
        )}

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
          {plan && !trial && (
            <p className="text-xs text-slate-500 mt-1">
              Tarif du forfait : {formatCurrencyFCFA(Number(plan.price))} /{' '}
              {PERIOD_LABELS[plan.billing_period] || plan.billing_period}
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
            {trial ? <Gift className="w-4 h-4 mr-1.5" /> : <KeyRound className="w-4 h-4 mr-1.5" />}
            {trial ? "Activer l'essai" : 'Activer la licence'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
