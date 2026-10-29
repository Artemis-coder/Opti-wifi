'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, RotateCcw, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PaymentPoster, PayNumber, WhatsappReceiptButton, type PublicPaymentMethod } from '@/components/payments/PaymentMethodCard';
import { cn } from '@/lib/utils/cn';
import { formatCurrencyFCFA } from '@/lib/utils/format';

export interface RequestedPlan {
  id: string;
  name: string;
  price: number;
  billing_period: string;
  max_users?: number | null;
  max_points_of_sale?: number | null;
  max_tickets_per_month?: number | null;
}

const PERIOD_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };

interface LicenseRequestDialogProps {
  plan: RequestedPlan | null;
  /** Réabonnement au forfait actuel (sinon : choix d'un autre forfait) */
  renewal?: boolean;
  onClose: () => void;
  /** Appelé après l'envoi (ou si une demande était déjà en attente) */
  onSent: () => void;
}

/**
 * Réabonnement en deux écrans :
 * 1. le forfait (package) et le bouton « Me réabonner » ;
 * 2. le paiement : affiche « Payez avec Wave » avec le QR code d'OptiWifi, numéro à copier,
 *    puis envoi du justificatif de paiement (WhatsApp).
 * « J'ai payé » envoie la demande au super admin, qui active la licence après vérification.
 */
export function LicenseRequestDialog({ plan, renewal, onClose, onSent }: LicenseRequestDialogProps) {
  return (
    <Modal
      isOpen={!!plan}
      onClose={onClose}
      title={renewal ? 'Me réabonner' : `Forfait ${plan?.name ?? ''}`}
      // Sur ordinateur : affiche à gauche, étapes à droite
      className="md:max-w-3xl"
    >
      {/* key : chaque ouverture repart du premier écran */}
      {plan && <RequestFlow key={plan.id} plan={plan} onClose={onClose} onSent={onSent} />}
    </Modal>
  );
}

function RequestFlow({ plan, onClose, onSent }: { plan: RequestedPlan; onClose: () => void; onSent: () => void }) {
  const [step, setStep] = useState<'package' | 'pay'>('package');
  const [methods, setMethods] = useState<PublicPaymentMethod[] | null>(null);
  const [methodId, setMethodId] = useState('');
  const [reference, setReference] = useState('');
  const [sending, setSending] = useState(false);

  const isFree = Number(plan.price) <= 0;
  const months = PERIOD_MONTHS[plan.billing_period] || 1;

  useEffect(() => {
    if (isFree) return;
    let cancelled = false;
    fetch('/api/payment-methods')
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json) => {
        if (cancelled) return;
        const list = (json.data || []) as PublicPaymentMethod[];
        setMethods(list);
        if (list[0]) setMethodId(list[0].id);
      })
      .catch(() => !cancelled && setMethods([]));
    return () => {
      cancelled = true;
    };
  }, [isFree]);

  const method = methods?.find((m) => m.id === methodId) || null;

  const send = async () => {
    setSending(true);
    try {
      const res = await fetch('/api/subscriptions/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          ...(method ? { paymentMethodId: method.id } : {}),
          ...(reference.trim() ? { paymentReference: reference.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        toast.info('Une demande est déjà en attente de validation');
        onSent();
        return;
      }
      if (!res.ok) {
        toast.error(data.error || "Échec de l'envoi de la demande");
        return;
      }
      toast.success('Demande envoyée : votre abonnement sera activé après vérification du paiement.');
      onSent();
    } catch {
      toast.error("Erreur lors de l'envoi de la demande");
    } finally {
      setSending(false);
    }
  };

  // ── Écran 1 : le forfait ──────────────────────────────────────────────
  if (step === 'package' || isFree) {
    const features = [
      plan.max_points_of_sale ? `Jusqu'à ${plan.max_points_of_sale} points de vente` : null,
      plan.max_users ? `Jusqu'à ${plan.max_users} utilisateurs` : null,
      plan.max_tickets_per_month ? `Jusqu'à ${plan.max_tickets_per_month.toLocaleString('fr-FR')} tickets / mois` : null,
    ].filter(Boolean) as string[];
    return (
      <div className="space-y-5 text-left max-w-lg mx-auto">
        <div className="rounded-2xl border border-brand-500/40 bg-brand-50/50 dark:bg-brand-950/20 p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">Votre forfait</p>
          <div className="flex items-end justify-between gap-3">
            <p className="text-xl font-extrabold text-slate-900 dark:text-white">{plan.name}</p>
            <p className="text-right">
              <span className="block text-2xl font-extrabold text-slate-900 dark:text-white">
                {isFree ? 'Gratuit' : formatCurrencyFCFA(plan.price)}
              </span>
              <span className="text-xs text-slate-500">pour {months} mois</span>
            </p>
          </div>
          {features.length > 0 && (
            <ul className="space-y-1.5 pt-3 border-t border-brand-500/20">
              {features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" /> {f}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          {isFree ? (
            <Button type="button" onClick={send} isLoading={sending} className="gap-2">
              {!sending && <Send className="w-4 h-4" />} Envoyer la demande
            </Button>
          ) : (
            <Button type="button" onClick={() => setStep('pay')} className="gap-2">
              <RotateCcw className="w-4 h-4" /> Me réabonner
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Écran 2 : le paiement ─────────────────────────────────────────────
  const receiptMessage = `Bonjour, voici le justificatif de mon paiement ${method?.name ?? ''} de ${formatCurrencyFCFA(plan.price)} pour mon abonnement OptiWifi (forfait ${plan.name}).`;
  return (
    <div className="space-y-5 text-left">
      <button
        type="button"
        onClick={() => setStep('package')}
        className="inline-flex items-center gap-1.5 -ml-1 px-1 py-1 text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
      >
        <ArrowLeft className="w-4 h-4" /> Forfait {plan.name}
      </button>

      {methods === null ? (
        <div className="py-10 flex justify-center text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : !method ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Le paiement en ligne n&apos;est pas encore disponible. Envoyez votre demande : l&apos;équipe OptiWifi vous contactera pour le
          paiement.
        </p>
      ) : (
        <>
          {/* Plusieurs opérateurs : choix en une rangée (aujourd'hui, Wave seul) */}
          {methods.length > 1 && (
            <div role="tablist" aria-label="Opérateur" className="flex gap-1.5 overflow-x-auto pb-1">
              {methods.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={m.id === methodId}
                  onClick={() => setMethodId(m.id)}
                  className={cn(
                    'shrink-0 h-9 px-4 rounded-full text-sm font-semibold border transition',
                    m.id === methodId
                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  )}
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2 md:items-start">
            <PaymentPoster method={method} />

            <ol className="space-y-4">
              <li className="flex gap-3">
                <StepNumber n={1} />
                <div className="flex-1 min-w-0 text-sm space-y-2">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    Payez {formatCurrencyFCFA(plan.price)} : scannez le QR code ou copiez le numéro {method.name}
                  </p>
                  <PayNumber method={method} />
                  {method.description && (
                    <p className="text-slate-600 dark:text-slate-400 whitespace-pre-line break-words">{method.description}</p>
                  )}
                </div>
              </li>
              <li className="flex gap-3">
                <StepNumber n={2} />
                <div className="flex-1 min-w-0 text-sm space-y-2">
                  <p className="font-semibold text-slate-900 dark:text-white">Envoyez le justificatif de paiement (capture) sur WhatsApp</p>
                  <WhatsappReceiptButton method={method} message={receiptMessage} />
                </div>
              </li>
              <li className="flex gap-3">
                <StepNumber n={3} />
                <div className="flex-1 min-w-0 text-sm space-y-2">
                  <p className="font-semibold text-slate-900 dark:text-white">Confirmez votre paiement</p>
                  <Input
                    placeholder={`ID de transaction ${method.name}`}
                    helperText="Facultatif : accélère la vérification."
                    value={reference}
                    maxLength={100}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </div>
              </li>
            </ol>
          </div>
        </>
      )}

      <p className="text-xs text-slate-500">
        Votre compte est activé dès que l&apos;équipe OptiWifi a reçu et vérifié votre justificatif de paiement.
      </p>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Fermer
        </Button>
        <Button type="button" onClick={send} isLoading={sending} className="gap-2">
          {!sending && <Send className="w-4 h-4" />}
          {method ? "J'ai payé" : 'Envoyer la demande'}
        </Button>
      </div>
    </div>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="w-7 h-7 shrink-0 rounded-full bg-brand-600 text-white text-sm font-bold flex items-center justify-center">{n}</span>
  );
}
