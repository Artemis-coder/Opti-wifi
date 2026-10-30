'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, RotateCcw, Send, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  DEFAULT_BRAND_COLOR,
  PaymentPoster,
  PayNumber,
  WhatsappReceiptButton,
  type PublicPaymentMethod,
} from '@/components/payments/PaymentMethodCard';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { COUNTRIES, countryFlag, countryName, DEFAULT_COUNTRY } from '@/lib/countries';
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
 * Demande de licence :
 * 1. le forfait (seulement pour un changement de forfait ; « Me réabonner » passe directement au paiement) ;
 * 2. le pays (par défaut celui du compte) puis le moyen de paiement parmi ceux activés pour ce pays ;
 * 3. le paiement : affiche « Payez avec <opérateur> » avec le QR code d'OptiWifi, numéro à copier,
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
      {plan && <RequestFlow key={plan.id} plan={plan} renewal={!!renewal} onClose={onClose} onSent={onSent} />}
    </Modal>
  );
}

function RequestFlow({
  plan,
  renewal,
  onClose,
  onSent,
}: {
  plan: RequestedPlan;
  renewal: boolean;
  onClose: () => void;
  onSent: () => void;
}) {
  // Réabonnement : directement au choix du moyen de paiement
  const [step, setStep] = useState<'package' | 'methods' | 'pay'>(renewal ? 'methods' : 'package');
  const [methods, setMethods] = useState<PublicPaymentMethod[] | null>(null);
  const [methodId, setMethodId] = useState('');
  // Pays de paiement : celui du compte par défaut (renvoyé par l'API)
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [reference, setReference] = useState('');
  const [sending, setSending] = useState(false);

  const isFree = Number(plan.price) <= 0;

  useEffect(() => {
    if (isFree) return;
    let cancelled = false;
    fetch('/api/payment-methods')
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json) => {
        if (cancelled) return;
        setMethods((json.data || []) as PublicPaymentMethod[]);
        if (typeof json.default_country === 'string') setCountry(json.default_country);
      })
      .catch(() => !cancelled && setMethods([]));
    return () => {
      cancelled = true;
    };
  }, [isFree]);

  const method = methods?.find((m) => m.id === methodId) || null;
  // Moyens utilisables dans le pays choisi (liste de pays vide = tous les pays)
  const available = (methods || []).filter((m) => !m.countries?.length || m.countries.includes(country));
  // Aucun moyen configuré : directement l'écran d'envoi de la demande
  const screen = step === 'methods' && methods !== null && methods.length === 0 ? 'pay' : step;
  const countryOptions = COUNTRIES.filter((c, i, all) => all.findIndex((x) => x.code === c.code) === i)
    .map((c) => ({ value: c.code, label: `${countryFlag(c.code)}  ${countryName(c.code)}` }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  const months = PERIOD_MONTHS[plan.billing_period] || 1;

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
  if (screen === 'package' || isFree) {
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
            <Button type="button" onClick={() => setStep('methods')} className="gap-2">
              <RotateCcw className="w-4 h-4" /> {renewal ? 'Me réabonner' : 'Continuer vers le paiement'}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Écran 2 : le choix du moyen de paiement ─────────────────────────
  if (screen === 'methods') {
    return (
      <div className="space-y-5 text-left">
        {!renewal && <BackButton label={`Forfait ${plan.name}`} onClick={() => setStep('package')} />}
        <PlanSummary plan={plan} months={months} />
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-brand-600" /> Choisissez votre moyen de paiement
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Choisissez votre pays, puis le moyen de paiement : vous scannerez ensuite le QR code ou copierez le numéro.
          </p>
        </div>
        <CustomSelect
          label="Pays"
          value={country}
          onChange={setCountry}
          options={countryOptions}
          searchable
          searchPlaceholder="Rechercher un pays…"
          title="Pays de paiement"
        />
        {methods === null ? (
          <div className="py-10 flex justify-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : available.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-5 text-center space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Aucun moyen de paiement en ligne n&apos;est encore disponible pour {countryName(country)}. Envoyez votre
              demande : l&apos;équipe OptiWifi vous contactera pour le paiement.
            </p>
            <Button type="button" onClick={send} isLoading={sending} className="gap-2">
              {!sending && <Send className="w-4 h-4" />} Envoyer la demande
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {available.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setMethodId(m.id);
                  setStep('pay');
                }}
                className="group rounded-2xl p-4 text-left text-white flex items-center gap-3 shadow-sm transition hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500"
                style={{ background: m.brand_color || DEFAULT_BRAND_COLOR }}
              >
                <span className="w-14 h-14 shrink-0 rounded-xl bg-white/95 flex items-center justify-center overflow-hidden">
                  {m.brand_logo ? (
                    // Data URL stockée en base : next/image n'apporte rien ici
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.brand_logo} alt="" className="w-11 h-11 object-contain" />
                  ) : (
                    <Wallet className="w-6 h-6 text-slate-500" />
                  )}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-lg font-extrabold leading-tight drop-shadow-sm">{m.name}</span>
                  <span className="block text-xs text-white/90">Payer avec {m.name}</span>
                </span>
                <ArrowRight className="w-5 h-5 shrink-0 transition group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
        </div>
      </div>
    );
  }

  // ── Écran 3 : le paiement ─────────────────────────────────────────────
  const receiptMessage = `Bonjour, voici le justificatif de mon paiement ${method?.name ?? ''} de ${formatCurrencyFCFA(plan.price)} pour mon abonnement OptiWifi (forfait ${plan.name}).`;
  return (
    <div className="space-y-5 text-left">
      {methods && methods.length > 0 ? (
        <BackButton label="Changer de pays ou de moyen de paiement" onClick={() => setStep('methods')} />
      ) : (
        !renewal && <BackButton label={`Forfait ${plan.name}`} onClick={() => setStep('package')} />
      )}
      {renewal && <PlanSummary plan={plan} months={months} />}

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

function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 -ml-1 px-1 py-1 text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
    >
      <ArrowLeft className="w-4 h-4" /> {label}
    </button>
  );
}

/** Rappel compact du forfait payé (réabonnement et choix du moyen de paiement) */
function PlanSummary({ plan, months }: { plan: RequestedPlan; months: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-brand-500/30 bg-brand-50/50 dark:bg-brand-950/20 px-4 py-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">Forfait</p>
        <p className="font-bold text-slate-900 dark:text-white truncate">{plan.name}</p>
      </div>
      <p className="text-right shrink-0">
        <span className="block text-lg font-extrabold text-slate-900 dark:text-white">{formatCurrencyFCFA(plan.price)}</span>
        <span className="text-xs text-slate-500">pour {months} mois</span>
      </p>
    </div>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="w-7 h-7 shrink-0 rounded-full bg-brand-600 text-white text-sm font-bold flex items-center justify-center">{n}</span>
  );
}
