'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, History, Loader2, Smartphone } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrencyFCFA } from '@/lib/utils/format';
import type { ClientOnlinePayment, OnlinePaymentStatus } from '@/lib/saspay/payments';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** Libellé et couleur du statut d'un paiement en ligne, pour le client. */
export const PAYMENT_STATUS: Record<OnlinePaymentStatus, { label: string; variant: BadgeVariant }> = {
  succeeded: { label: 'Payé', variant: 'success' },
  pending: { label: 'En attente', variant: 'warning' },
  failed: { label: 'Échoué', variant: 'danger' },
  cancelled: { label: 'Annulé', variant: 'neutral' },
  expired: { label: 'Expiré', variant: 'neutral' },
};

export function formatPaymentAmount(amount: number, currency: string): string {
  return currency === 'XOF' || currency === 'XAF' ? formatCurrencyFCFA(amount) : `${amount.toLocaleString('fr-FR')} ${currency}`;
}

/** Moyen de paiement lisible : réseau Mobile Money / carte quand SasPay l'a communiqué. */
export function paymentMethodLabel(network: string | null): string {
  if (!network) return 'Paiement en ligne';
  return /visa|master|card|carte/i.test(network) ? `Carte bancaire (${network})` : `Mobile Money (${network})`;
}

export const shortDate = (d: string | null) =>
  d ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d)) : '—';

/**
 * Historique des paiements en ligne de l'organisation (page Abonnement) : tous les statuts,
 * chaque ligne ouvre le détail du paiement. Réservé à l'administrateur du client.
 */
export function PaymentHistory() {
  const [payments, setPayments] = useState<ClientOnlinePayment[] | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/subscription/payments', { cache: 'no-store' })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401 || res.status === 403) {
          setForbidden(true);
          return;
        }
        const json = res.ok ? await res.json().catch(() => ({})) : {};
        if (!cancelled) setPayments(json.data || []);
      })
      .catch(() => !cancelled && setPayments([]));
    return () => {
      cancelled = true;
    };
  }, []);

  if (forbidden) return null;

  return (
    <Card id="historique-paiements" className="space-y-4 scroll-mt-20">
      <div>
        <h2 className="text-sm font-semibold text-muted flex items-center gap-2">
          <History className="w-4 h-4 text-accent" /> Historique des paiements
        </h2>
        <p className="text-xs text-muted mt-1">
          Tous vos paiements en ligne, réussis ou non. Touchez un paiement pour voir son détail.
        </p>
      </div>

      {payments === null ? (
        <div className="py-8 flex justify-center text-muted">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : payments.length === 0 ? (
        <div className="py-8 text-center space-y-2">
          <Smartphone className="w-10 h-10 mx-auto text-muted" />
          <p className="text-sm text-muted">Aucun paiement en ligne pour le moment.</p>
        </div>
      ) : (
        <ul className="divide-y divide-separator -mx-1">
          {payments.map((p) => {
            const st = PAYMENT_STATUS[p.status] ?? { label: p.status, variant: 'neutral' as const };
            return (
              <li key={p.id}>
                <Link
                  href={`/subscription/paiements/${p.id}`}
                  className="flex items-center gap-3 px-1 py-3 rounded-xl hover:bg-surface-secondary transition"
                >
                  <span className="w-10 h-10 shrink-0 rounded-lg bg-accent-soft text-accent flex items-center justify-center">
                    <Smartphone className="w-5 h-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground">Forfait {p.plan_name || '—'}</span>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </span>
                    <span className="block text-xs text-muted truncate">
                      {shortDate(p.paid_at || p.created_at)} · {paymentMethodLabel(p.network)}
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-foreground tabular-nums whitespace-nowrap">
                    {formatPaymentAmount(p.amount, p.currency)}
                  </span>
                  <ChevronRight className="w-4 h-4 shrink-0 text-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
