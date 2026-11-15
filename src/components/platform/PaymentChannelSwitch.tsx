'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CreditCard, Loader2, QrCode } from 'lucide-react';

export type PaymentChannel = 'online' | 'manual';

interface ModeState {
  mode: 'saspay' | 'manual';
  effective: 'saspay' | 'manual';
  saspay: { configured: boolean; environment: 'SANDBOX' | 'LIVE' | null; problem: string | null };
}

const toChannel = (m: 'saspay' | 'manual'): PaymentChannel => (m === 'saspay' ? 'online' : 'manual');

/**
 * Transactions : bascule entre les paiements en ligne (SasPay, licence activée automatiquement)
 * et les paiements manuels (validés par l'admin). Indique le mode actif pour les clients et permet
 * de le changer (même réglage que la page Moyens de paiement).
 */
export function PaymentChannelSwitch({
  view,
  onChange,
}: {
  view: PaymentChannel | null;
  onChange: (v: PaymentChannel) => void;
}) {
  const [state, setState] = useState<ModeState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/platform/payment-mode', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled || !json?.data) return;
        setState(json.data);
        // Vue par défaut : le mode réellement proposé aux clients
        if (view === null) onChange(toChannel(json.data.effective));
      })
      .catch(() => !cancelled && view === null && onChange('manual'));
    return () => {
      cancelled = true;
    };
    // Chargé une fois : la vue choisie ensuite appartient à l'utilisateur
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activate = async (channel: PaymentChannel) => {
    const mode = channel === 'online' ? 'saspay' : 'manual';
    const label = channel === 'online' ? 'le paiement en ligne (SasPay)' : 'le paiement manuel';
    if (!window.confirm(`Proposer ${label} à tous les clients à partir de maintenant ?`)) return;
    setSaving(true);
    try {
      const res = await fetch('/api/platform/payment-mode', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || 'Changement impossible');
        return;
      }
      setState(json.data);
      toast.success(channel === 'online' ? 'Paiement en ligne activé pour les clients' : 'Paiement manuel activé pour les clients');
    } catch {
      toast.error('Changement impossible');
    } finally {
      setSaving(false);
    }
  };

  const active = state ? toChannel(state.effective) : null;
  const tabs: { value: PaymentChannel; label: string; sub: string; icon: typeof CreditCard }[] = [
    { value: 'online', label: 'Paiement en ligne', sub: 'SasPay · licence activée automatiquement', icon: CreditCard },
    { value: 'manual', label: 'Paiement manuel', sub: 'QR code / numéro · validé par vous', icon: QrCode },
  ];

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Type de paiement" className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 dark:bg-slate-800/70 p-1">
        {tabs.map((t) => {
          const selected = view === t.value;
          const Icon = t.icon;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(t.value)}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition ${
                selected ? 'bg-white dark:bg-slate-900 shadow-sm' : 'hover:bg-white/60 dark:hover:bg-slate-900/40'
              }`}
            >
              <Icon className={`w-5 h-5 shrink-0 ${selected ? 'text-brand-600' : 'text-slate-400'}`} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  {t.label}
                  {active === t.value && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Actif
                    </span>
                  )}
                </span>
                <span className="block truncate text-[11px] text-slate-500">{t.sub}</span>
              </span>
            </button>
          );
        })}
      </div>

      {state && view && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
          <p>
            Proposé actuellement aux clients :{' '}
            <strong className="text-slate-800 dark:text-slate-200">
              {state.effective === 'saspay' ? 'paiement en ligne (SasPay)' : 'paiement manuel'}
            </strong>
            {state.saspay.environment && state.effective === 'saspay' && (
              <span className="ml-1 text-slate-400">({state.saspay.environment === 'LIVE' ? 'réel' : 'test'})</span>
            )}
          </p>
          {view !== active && (
            <button
              type="button"
              onClick={() => void activate(view)}
              disabled={saving || (view === 'online' && !state.saspay.configured)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Proposer {view === 'online' ? 'le paiement en ligne' : 'le paiement manuel'} aux clients
            </button>
          )}
        </div>
      )}
      {state && view === 'online' && !state.saspay.configured && (
        <p className="flex gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0" /> SasPay indisponible : {state.saspay.problem}
        </p>
      )}
    </div>
  );
}
