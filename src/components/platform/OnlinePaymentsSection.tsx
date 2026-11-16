'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Ban, CreditCard, Loader2, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
import { formatCurrencyFCFA, formatDateFR } from '@/lib/utils/format';

type Status = 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'expired';

interface OnlinePayment {
  id: string;
  status: Status;
  amount: string;
  currency: string;
  amount_charged: string | null;
  amount_net: string | null;
  network: string | null;
  environment: 'SANDBOX' | 'LIVE';
  transaction_reference: string | null;
  failure_reason: string | null;
  subscription_id: string | null;
  invoice_id: string | null;
  created_at: string;
  paid_at: string | null;
  organization_name: string;
  plan_name: string | null;
}

interface Config {
  enabled: boolean;
  mode: 'saspay' | 'manual';
  environment: 'SANDBOX' | 'LIVE' | null;
  problem: string | null;
  has_webhook_secret: boolean;
  last_webhook: { event_type: string; signature_ok: boolean; received_at: string } | null;
}

const STATUS: Record<Status, { label: string; color: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  pending: { label: 'En attente', color: 'warning' },
  succeeded: { label: 'Payé', color: 'success' },
  failed: { label: 'Échoué', color: 'danger' },
  cancelled: { label: 'Annulé', color: 'neutral' },
  expired: { label: 'Expiré', color: 'neutral' },
};

function money(amount: string | number | null, currency: string) {
  if (amount === null) return '—';
  return currency === 'XOF' || currency === 'XAF' ? formatCurrencyFCFA(Number(amount)) : `${amount} ${currency}`;
}

async function fetchOnlinePayments() {
  try {
    const res = await fetch('/api/platform/online-payments', { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, ...json };
  } catch {
    return { ok: false, error: 'Chargement impossible' };
  }
}

/** Paiements en ligne SasPay : configuration, suivi et revérification manuelle. */
export function OnlinePaymentsSection() {
  const [rows, setRows] = useState<OnlinePayment[] | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const apply = useCallback((json: { ok: boolean; data?: OnlinePayment[]; config?: Config; error?: string }) => {
    if (!json.ok) {
      toast.error(json.error || 'Chargement impossible');
      setRows([]);
      return;
    }
    setRows(json.data || []);
    setConfig(json.config || null);
  }, []);
  const load = useCallback(() => fetchOnlinePayments().then(apply), [apply]);

  useEffect(() => {
    fetchOnlinePayments().then(apply);
  }, [apply]);

  const resync = async (id: string, action?: 'cancel') => {
    if (action === 'cancel' && !window.confirm('Annuler ce paiement en attente ? La page SasPay du client sera fermée.')) return;
    setBusy(id);
    try {
      const res = await fetch('/api/platform/online-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) toast.error(json.error || 'Vérification impossible');
      else toast.success(`Statut : ${STATUS[json.data.status as Status]?.label ?? json.data.status}`);
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-accent" />
          <h2 className="text-base font-semibold text-foreground">Paiements en ligne (SasPay)</h2>
          {config?.environment && (
            <Badge variant={config.environment === 'LIVE' ? 'success' : 'info'} className="text-xs">
              {config.environment === 'LIVE' ? 'Réel' : 'Test'}
            </Badge>
          )}
        </div>
        <button onClick={() => void load()} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground">
          <RefreshCw className="w-3.5 h-3.5" /> Actualiser
        </button>
      </div>

      {config && (
        <div className="text-xs text-muted space-y-1">
          {config.mode === 'manual' ? (
            <p>⏸️ Mode « paiement manuel » choisi (page Moyens de paiement) : SasPay n&apos;est pas proposé aux clients.</p>
          ) : config.enabled ? (
            <p>✅ Paiement en ligne proposé aux clients.</p>
          ) : (
            <p className="text-warning-soft-foreground">⚠️ Paiement en ligne non proposé : {config.problem}</p>
          )}
          {!config.has_webhook_secret && (
            <p className="text-warning-soft-foreground">
              ⚠️ Secret du webhook absent (SASPAY_WEBHOOK_SECRET) : les confirmations arrivent seulement par la page de retour et la vérification quotidienne.
            </p>
          )}
          <p>
            Dernier webhook :{' '}
            {config.last_webhook
              ? `${config.last_webhook.event_type} le ${new Date(config.last_webhook.received_at).toLocaleString('fr-FR')}${config.last_webhook.signature_ok ? '' : ' (signature refusée)'}`
              : 'aucun reçu'}
          </p>
        </div>
      )}

      {rows === null ? (
        <div className="py-6 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-accent" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted">Aucun paiement en ligne pour le moment.</p>
      ) : (
        <ResponsiveTable>
          <table className="w-full text-left text-xs">
            <thead className="bg-default text-muted font-semibold">
              <tr>
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2">Forfait</th>
                <th className="px-3 py-2">Prix</th>
                <th className="px-3 py-2">Payé / reçu</th>
                <th className="px-3 py-2">Réseau</th>
                <th className="px-3 py-2">Référence</th>
                <th className="px-3 py-2">Statut</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-separator font-medium">
              {rows.map((p) => {
                const s = STATUS[p.status] || STATUS.pending;
                const activationIssue = p.status === 'succeeded' && !p.subscription_id;
                return (
                  <tr key={p.id} className="align-top">
                    <td className="px-3 py-2 font-semibold text-foreground">
                      {p.organization_name}
                      {p.environment === 'SANDBOX' && <span className="ml-1 text-xs text-accent">test</span>}
                    </td>
                    <td className="px-3 py-2 text-muted">{p.plan_name || '—'}</td>
                    <td className="px-3 py-2 font-semibold text-foreground">{money(p.amount, p.currency)}</td>
                    <td className="px-3 py-2 text-muted">
                      {p.amount_charged ? `${money(p.amount_charged, p.currency)} / ${money(p.amount_net, p.currency)}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-muted">{p.network || '—'}</td>
                    <td className="px-3 py-2 text-muted font-mono text-xs">{p.transaction_reference || '—'}</td>
                    <td className="px-3 py-2">
                      <Badge variant={activationIssue ? 'danger' : s.color} className="text-xs">
                        {activationIssue ? 'Payé, licence à activer' : s.label}
                      </Badge>
                      {p.failure_reason && (
                        <p className="mt-1 max-w-[16rem] text-xs text-warning-soft-foreground flex gap-1">
                          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> {p.failure_reason}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted">{formatDateFR(p.paid_at || p.created_at)}</td>
                    <td className="px-3 py-2">
                      {p.status === 'pending' && (
                        <div className="flex flex-col items-start gap-1.5">
                        <button
                          onClick={() => void resync(p.id)}
                          disabled={busy === p.id}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline disabled:opacity-50"
                        >
                          {busy === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Revérifier
                        </button>
                        <button
                          onClick={() => void resync(p.id, 'cancel')}
                          disabled={busy === p.id}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-danger hover:underline disabled:opacity-50"
                        >
                          <Ban className="w-3 h-3" /> Annuler
                        </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ResponsiveTable>
      )}
    </Card>
  );
}
