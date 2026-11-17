'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Clock, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonClassName } from '@/components/ui/Button';
import { formatDateFR } from '@/lib/utils/format';
import { PAYMENT_STATUS, formatPaymentAmount, paymentMethodLabel } from '@/components/payments/PaymentHistory';
import type { ClientOnlinePayment } from '@/lib/saspay/payments';

async function fetchPayment(id: string, verify: boolean): Promise<{ data?: ClientOnlinePayment; error?: string }> {
  try {
    const res = await fetch(`/api/subscription/payments/${encodeURIComponent(id)}${verify ? '?verify=1' : ''}`, { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    return res.ok ? { data: json.data } : { error: json.error || 'Chargement impossible pour le moment' };
  } catch {
    return { error: 'Chargement impossible pour le moment' };
  }
}

/** Détail d'un paiement en ligne (page Abonnement → Historique des paiements). */
export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [payment, setPayment] = useState<ClientOnlinePayment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const apply = useCallback((r: { data?: ClientOnlinePayment; error?: string }) => {
    if (r.data) {
      setPayment(r.data);
      setError(null);
    } else setError(r.error || null);
  }, []);

  // Un paiement en attente est revérifié auprès de SasPay à l'ouverture
  useEffect(() => {
    if (id) fetchPayment(id, true).then(apply);
  }, [id, apply]);

  const recheck = () => {
    setChecking(true);
    fetchPayment(id, true)
      .then(apply)
      .finally(() => setChecking(false));
  };

  const back = (
    <Link href="/subscription#historique-paiements" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
      <ArrowLeft className="w-4 h-4" /> Historique des paiements
    </Link>
  );

  if (!payment) {
    return (
      <div className="space-y-5 max-w-2xl mx-auto">
        {back}
        <Card className="py-10 flex flex-col items-center gap-3 text-center">
          {error ? (
            <>
              <XCircle className="w-10 h-10 text-danger" />
              <p className="text-sm text-muted">{error}</p>
            </>
          ) : (
            <Loader2 className="w-6 h-6 animate-spin text-muted" />
          )}
        </Card>
      </div>
    );
  }

  const st = PAYMENT_STATUS[payment.status] ?? { label: payment.status, variant: 'neutral' as const };
  const amount = formatPaymentAmount(payment.amount, payment.currency);

  let message: ReactNode = null;
  if (payment.status === 'succeeded' && payment.needs_support) {
    message = (
      <Notice icon={<Clock className="w-5 h-5 text-warning-soft-foreground" />}>
        Votre paiement est bien reçu. L&apos;activation de votre licence demande une vérification : l&apos;équipe OptiWifi
        (le support) a été prévenue et s&apos;en occupe rapidement.
      </Notice>
    );
  } else if (payment.status === 'succeeded' && !payment.license_activated) {
    message = (
      <Notice icon={<Loader2 className="w-5 h-5 text-accent animate-spin" />}>
        Paiement reçu, activation de la licence en cours. Revérifiez dans quelques instants.
      </Notice>
    );
  } else if (payment.status === 'succeeded') {
    message = (
      <Notice icon={<CheckCircle2 className="w-5 h-5 text-success-soft-foreground" />}>
        Paiement confirmé, licence activée.
      </Notice>
    );
  } else if (payment.status === 'pending') {
    message = (
      <Notice icon={<Clock className="w-5 h-5 text-warning-soft-foreground" />}>
        Ce paiement n&apos;est pas encore confirmé. Si vous l&apos;avez validé sur votre téléphone, touchez « Revérifier ». Sinon,
        vous pouvez reprendre le paiement.
      </Notice>
    );
  } else {
    message = (
      <Notice icon={<XCircle className="w-5 h-5 text-danger" />}>
        {payment.status === 'expired'
          ? 'La session de paiement a expiré.'
          : payment.status === 'cancelled'
            ? 'Le paiement a été annulé.'
            : 'Le paiement a échoué.'}{' '}
        Aucune licence n&apos;a été activée par cette tentative. Vous pouvez payer à nouveau depuis la page Abonnement.
      </Notice>
    );
  }

  const rows: { label: string; value: ReactNode }[] = [
    { label: 'Montant', value: amount },
    { label: 'Forfait', value: payment.plan_name || '—' },
    { label: 'Durée', value: `${payment.duration_months} mois` },
    { label: 'Moyen de paiement', value: paymentMethodLabel(payment.network) },
    { label: 'Paiement lancé le', value: formatDateFR(payment.created_at) },
    { label: 'Payé le', value: payment.paid_at ? formatDateFR(payment.paid_at) : '—' },
    { label: 'Référence de transaction', value: payment.reference || '—' },
    {
      label: 'Licence',
      value: payment.license_activated
        ? `Activée${payment.license_end_date ? ` jusqu'au ${formatDateFR(payment.license_end_date)}` : ''}`
        : 'Non activée',
    },
  ];

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {back}
      <Card className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Détail du paiement</h1>
            <p className="text-2xl font-semibold tabular-nums text-foreground mt-2">{amount}</p>
          </div>
          <Badge variant={st.variant}>{st.label}</Badge>
        </div>

        {message}

        <dl className="divide-y divide-separator border-t border-border">
          {rows.map((r) => (
            <div key={r.label} className="flex items-start justify-between gap-4 py-3 text-sm">
              <dt className="text-muted">{r.label}</dt>
              <dd className="font-medium text-foreground text-right break-all">{r.value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          {payment.status === 'pending' || (payment.status === 'succeeded' && !payment.license_activated && !payment.needs_support) ? (
            <Button variant="outline" onClick={recheck} isLoading={checking}>
              {!checking && <RefreshCw className="w-4 h-4" />} Revérifier
            </Button>
          ) : null}
          {payment.status === 'pending' && payment.checkout_url && (
            <a href={payment.checkout_url} className={buttonClassName({ variant: 'primary', size: 'md' })}>
              Reprendre le paiement
            </a>
          )}
          {payment.invoice_id && (
            <Link href={`/subscription/invoices/${payment.invoice_id}`} className={buttonClassName({ variant: 'primary', size: 'md' })}>
              Voir la facture
            </Link>
          )}
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </Card>
    </div>
  );
}

function Notice({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-surface-secondary p-3 text-sm text-muted">
      <span className="shrink-0 mt-0.5">{icon}</span>
      <p>{children}</p>
    </div>
  );
}
