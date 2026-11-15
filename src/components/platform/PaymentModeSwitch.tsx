'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, CreditCard, Loader2, QrCode } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

type Mode = 'saspay' | 'manual';
interface ModeState {
  mode: Mode;
  effective: Mode;
  saspay: { configured: boolean; environment: 'SANDBOX' | 'LIVE' | null; problem: string | null };
}

async function fetchMode(): Promise<{ ok: boolean; data?: ModeState; error?: string }> {
  try {
    const res = await fetch('/api/platform/payment-mode', { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data: json.data } : { ok: false, error: json.error };
  } catch {
    return { ok: false, error: 'Chargement impossible' };
  }
}

const OPTIONS: { value: Mode; title: string; text: string; icon: typeof CreditCard }[] = [
  {
    value: 'saspay',
    title: 'Paiement en ligne (SasPay)',
    text: 'Un seul bouton « Passer au paiement » : Mobile Money ou carte, licence activée automatiquement.',
    icon: CreditCard,
  },
  {
    value: 'manual',
    title: 'Paiement manuel',
    text: 'Les moyens ci-dessous (QR code, numéro, justificatif WhatsApp) ; vous validez chaque demande.',
    icon: QrCode,
  },
];

/** Interrupteur du super admin : ce que les clients voient au moment de payer leur licence. */
export function PaymentModeSwitch() {
  const [state, setState] = useState<ModeState | null>(null);
  const [saving, setSaving] = useState<Mode | null>(null);

  const apply = useCallback((r: { ok: boolean; data?: ModeState; error?: string }) => {
    if (r.ok && r.data) setState(r.data);
    else toast.error(r.error || 'Chargement impossible');
  }, []);

  useEffect(() => {
    fetchMode().then(apply);
  }, [apply]);

  const choose = async (mode: Mode) => {
    if (!state || mode === state.mode) return;
    setSaving(mode);
    try {
      const res = await fetch('/api/platform/payment-mode', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || 'Enregistrement impossible');
        return;
      }
      setState(json.data);
      toast.success(mode === 'saspay' ? 'Paiement en ligne SasPay activé' : 'Paiement manuel activé');
    } catch {
      toast.error('Enregistrement impossible');
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Mode de paiement des licences</h2>
          <p className="text-xs text-slate-500">Ce que vos clients voient quand ils paient ou renouvellent leur licence.</p>
        </div>
        {state?.saspay.environment && (
          <Badge variant={state.saspay.environment === 'LIVE' ? 'success' : 'info'} className="text-xs">
            SasPay {state.saspay.environment === 'LIVE' ? 'réel' : 'test'}
          </Badge>
        )}
      </div>

      {!state ? (
        <div className="py-4 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
        </div>
      ) : (
        <>
          <div role="radiogroup" aria-label="Mode de paiement" className="grid gap-3 sm:grid-cols-2">
            {OPTIONS.map((o) => {
              const active = state.mode === o.value;
              const Icon = o.icon;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => void choose(o.value)}
                  disabled={saving !== null}
                  className={`text-left rounded-xl border-2 p-3 flex gap-3 transition disabled:opacity-60 ${
                    active
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <span
                    className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center ${
                      active ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {saving === o.value ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icon className="w-5 h-5" />}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-semibold text-sm text-slate-900 dark:text-white">
                      {o.title} {active && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                    </span>
                    <span className="block text-xs text-slate-500 mt-0.5">{o.text}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {state.mode === 'saspay' && !state.saspay.configured && (
            <p className="flex gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                SasPay est choisi mais indisponible : {state.saspay.problem}. Vos clients voient le paiement manuel en attendant.
              </span>
            </p>
          )}
          <p className="text-xs text-slate-500">
            Actuellement proposé aux clients :{' '}
            <strong className="text-slate-700 dark:text-slate-300">
              {state.effective === 'saspay' ? 'paiement en ligne SasPay' : 'paiement manuel'}
            </strong>
          </p>
        </>
      )}
    </Card>
  );
}
