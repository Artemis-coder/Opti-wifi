'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, CreditCard, Loader2, PlugZap, QrCode, XCircle } from 'lucide-react';
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
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<{
    ok: boolean;
    message: string | null;
    webhook_secret?: boolean;
    networks?: { country: string; code: string; name: string; otp: boolean }[];
  } | null>(null);

  const testConnection = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/platform/saspay-check', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      setCheck(res.ok ? json.data : { ok: false, message: json.error || 'Test impossible' });
    } catch {
      setCheck({ ok: false, message: 'Test impossible' });
    } finally {
      setChecking(false);
    }
  };

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
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">Mode de paiement des licences</h2>
          <p className="text-xs text-muted">Ce que vos clients voient quand ils paient ou renouvellent leur licence.</p>
        </div>
        {state?.saspay.environment && (
          <Badge variant={state.saspay.environment === 'LIVE' ? 'success' : 'info'} className="text-xs">
            SasPay {state.saspay.environment === 'LIVE' ? 'réel' : 'test'}
          </Badge>
        )}
      </div>

      {!state ? (
        <div className="py-4 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-accent" />
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
                      ? ' bg-success-soft '
                      : ' hover:border-border '
                  }`}
                >
                  <span
                    className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center ${
                      active ? 'bg-success text-success-foreground' : 'bg-default text-muted'
                    }`}
                  >
                    {saving === o.value ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icon className="w-5 h-5" />}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
                      {o.title} {active && <CheckCircle2 className="w-4 h-4 text-success-soft-foreground" />}
                    </span>
                    <span className="block text-xs text-muted mt-0.5">{o.text}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {state.mode === 'saspay' && !state.saspay.configured && (
            <p className="flex gap-2 rounded-xl bg-warning-soft p-3 text-xs text-warning-soft-foreground">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                SasPay est choisi mais indisponible : {state.saspay.problem}. Vos clients voient le paiement manuel en attendant.
              </span>
            </p>
          )}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void testConnection()}
              disabled={checking}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-secondary disabled:opacity-60"
            >
              {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlugZap className="w-3.5 h-3.5" />} Tester la connexion
              SasPay
            </button>
            {check && (
              <div
                className={`rounded-xl p-3 text-xs space-y-1 ${
                  check.ok
                    ? 'bg-success-soft text-success-soft-foreground '
                    : 'bg-danger-soft text-danger '
                }`}
              >
                <p className="flex items-center gap-1.5 font-semibold">
                  {check.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />} {check.message}
                </p>
                {check.ok && check.webhook_secret === false && <p>⚠️ Secret du webhook absent (SASPAY_WEBHOOK_SECRET).</p>}
                {check.ok && check.networks && check.networks.length > 0 && (
                  <p className="text-muted">
                    {check.networks.map((n) => `${n.name} (${n.country})${n.otp ? ' · OTP' : ''}`).join(' · ')}
                  </p>
                )}
              </div>
            )}
          </div>
          <p className="text-xs text-muted">
            Actuellement proposé aux clients :{' '}
            <strong className="text-foreground">
              {state.effective === 'saspay' ? 'paiement en ligne SasPay' : 'paiement manuel'}
            </strong>
          </p>
        </>
      )}
    </Card>
  );
}
