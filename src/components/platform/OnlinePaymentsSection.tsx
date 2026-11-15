'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CreditCard, Loader2, RefreshCw } from 'lucide-react';
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

  const resync = async (id: string) => {
    setBusy(id);
    try {
      const res = await fetch('/api/platform/online-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
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
    <Card className="p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-brand-600" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Paiements en ligne (SasPay)</h2>
          {config?.environment && (
            <Badge variant={config.environment === 'LIVE' ? 'success' : 'info'} className="text-xs">
              {config.environment === 'LIVE' ? 'Réel' : 'Test'}
            </Badge>
          )}
        </div>
        <button onClick={() => void load()} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
          <RefreshCw className="w-3.5 h-3.5" /> Actualiser
        </button>
      </div>

      {config && (
        <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
          {config.mode === 'manual' ? (
            <p>⏸️ Mode « paiement manuel » choisi (page Moyens de paiement) : SasPay n&apos;est pas proposé aux clients.</p>
          ) : config.enabled ? (
            <p>✅ Paiement en ligne proposé aux clients.</p>
          ) : (
            <p className="text-amber-700 dark:text-amber-400">⚠️ Paiement en ligne non proposé : {config.problem}</p>
          )}
          {!config.has_webhook_secret && (
            <p className="text-amber-700 dark:text-amber-400">
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
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun paiement en ligne pour le moment.</p>
      ) : (
        <ResponsiveTable>
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
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
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
              {rows.map((p) => {
                const s = STATUS[p.status] || STATUS.pending;
                const activationIssue = p.status === 'succeeded' && !p.subscription_id;
                return (
                  <tr key={p.id} className="align-top">
                    <td className="px-3 py-2 font-semibold text-slate-900 dark:text-white">
                      {p.organization_name}
                      {p.environment === 'SANDBOX' && <span className="ml-1 text-[10px] text-sky-600">test</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{p.plan_name || '—'}</td>
                    <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">{money(p.amount, p.currency)}</td>
                    <td className="px-3 py-2 text-slate-500">
                      {p.amount_charged ? `${money(p.amount_charged, p.currency)} / ${money(p.amount_net, p.currency)}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{p.network || '—'}</td>
                    <td className="px-3 py-2 text-slate-500 font-mono text-[10px]">{p.transaction_reference || '—'}</td>
                    <td className="px-3 py-2">
                      <Badge variant={activationIssue ? 'danger' : s.color} className="text-xs">
                        {activationIssue ? 'Payé, licence à activer' : s.label}
                      </Badge>
                      {p.failure_reason && (
                        <p className="mt-1 max-w-[16rem] text-[11px] text-amber-700 dark:text-amber-400 flex gap-1">
                          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> {p.failure_reason}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{formatDateFR(p.paid_at || p.created_at)}</td>
                    <td className="px-3 py-2">
                      {p.status === 'pending' && (
                        <button
                          onClick={() => void resync(p.id)}
                          disabled={busy === p.id}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline disabled:opacity-50"
                        >
                          {busy === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Revérifier
                        </button>
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
