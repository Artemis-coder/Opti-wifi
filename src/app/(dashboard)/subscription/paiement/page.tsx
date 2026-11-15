'use client';

import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Clock, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatCurrencyFCFA } from '@/lib/utils/format';

interface PaymentStatus {
  status: 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'expired';
  amount: number;
  currency: string;
  plan_name: string | null;
  reference: string | null;
  license_activated: boolean;
  license_end_date: string | null;
  invoice_id: string | null;
  needs_support: boolean;
  checkout_url: string | null;
}

/** Vérifications automatiques : toutes les 4 s pendant 2 min, puis à la demande. */
const POLL_MS = 4000;
const POLL_MAX = 30;

async function fetchStatus(ref: string): Promise<{ ok: boolean; data?: PaymentStatus; error?: string }> {
  try {
    const res = await fetch(`/api/payments/saspay/status?ref=${encodeURIComponent(ref)}`, { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data: json.data } : { ok: false, error: json.error };
  } catch {
    return { ok: false };
  }
}

/**
 * Retour de la page de paiement SasPay. La licence est activée côté serveur dès que SasPay confirme
 * le paiement (webhook ou vérification déclenchée par cette page) : on affiche l'état réel.
 */
function PaymentReturn() {
  const ref = useSearchParams().get('ref') || '';
  const [data, setData] = useState<PaymentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const polls = useRef(0);

  const apply = useCallback((r: { ok: boolean; data?: PaymentStatus; error?: string }) => {
    if (r.ok && r.data) {
      setError(null);
      setData(r.data);
    } else setError(r.error || 'Vérification impossible pour le moment');
  }, []);

  const check = useCallback(() => {
    if (!ref) return;
    setChecking(true);
    fetchStatus(ref)
      .then(apply)
      .finally(() => setChecking(false));
  }, [ref, apply]);

  useEffect(() => {
    if (ref) fetchStatus(ref).then(apply);
  }, [ref, apply]);

  // Paiement en attente (ou licence en cours d'activation) : on revérifie régulièrement
  const waiting = !data || data.status === 'pending' || (data.status === 'succeeded' && !data.license_activated && !data.needs_support);
  useEffect(() => {
    if (!waiting || polls.current >= POLL_MAX) return;
    const t = setTimeout(() => {
      polls.current += 1;
      fetchStatus(ref).then(apply);
    }, POLL_MS);
    return () => clearTimeout(t);
  }, [waiting, data, ref, apply]);

  if (!ref) {
    return (
      <Panel icon={<XCircle className="w-12 h-12 text-red-500" />} title="Lien de paiement incomplet">
        <BackLink />
      </Panel>
    );
  }

  if (!data) {
    return (
      <Panel icon={<Loader2 className="w-12 h-12 text-brand-600 animate-spin" />} title="Vérification de votre paiement…">
        {error && <p className="text-sm text-red-600">{error}</p>}
      </Panel>
    );
  }

  const amount = data.currency === 'XOF' || data.currency === 'XAF' ? formatCurrencyFCFA(data.amount) : `${data.amount} ${data.currency}`;

  if (data.status === 'succeeded') {
    if (data.needs_support) {
      return (
        <Panel icon={<Clock className="w-12 h-12 text-amber-500" />} title="Paiement reçu">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Votre paiement de {amount} est bien reçu{data.reference ? ` (réf. ${data.reference})` : ''}. L&apos;activation de
            votre licence demande une vérification : l&apos;équipe OptiWifi a été prévenue et s&apos;en occupe rapidement.
          </p>
          <BackLink />
        </Panel>
      );
    }
    if (!data.license_activated) {
      return (
        <Panel icon={<Loader2 className="w-12 h-12 text-brand-600 animate-spin" />} title="Paiement reçu, activation en cours…">
          <p className="text-sm text-slate-600 dark:text-slate-400">Cela ne prend que quelques secondes.</p>
        </Panel>
      );
    }
    return (
      <Panel icon={<CheckCircle2 className="w-12 h-12 text-emerald-500" />} title="Paiement confirmé, licence activée">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Forfait <strong>{data.plan_name}</strong> actif
          {data.license_end_date ? ` jusqu'au ${new Date(data.license_end_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}` : ''}.
          {data.reference ? ` Référence du paiement : ${data.reference}.` : ''}
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          {data.invoice_id && (
            <Link href={`/subscription/invoices/${data.invoice_id}`}>
              <Button variant="outline">Voir la facture</Button>
            </Link>
          )}
          <Link href="/dashboard">
            <Button>Aller au tableau de bord</Button>
          </Link>
        </div>
      </Panel>
    );
  }

  if (data.status === 'pending') {
    return (
      <Panel icon={<Loader2 className="w-12 h-12 text-brand-600 animate-spin" />} title="Paiement en attente de confirmation">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Validez le paiement de {amount} sur votre téléphone si ce n&apos;est pas déjà fait. Cette page se met à jour toute seule ;
          votre licence s&apos;activera dès la confirmation, même si vous la fermez.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button variant="outline" onClick={check} isLoading={checking} className="gap-2">
            {!checking && <RefreshCw className="w-4 h-4" />} Vérifier maintenant
          </Button>
          {data.checkout_url && (
            <a href={data.checkout_url}>
              <Button variant="ghost">Revenir à la page de paiement</Button>
            </a>
          )}
        </div>
      </Panel>
    );
  }

  return (
    <Panel icon={<XCircle className="w-12 h-12 text-red-500" />} title="Le paiement n'a pas abouti">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {data.status === 'expired' ? 'La session de paiement a expiré.' : data.status === 'cancelled' ? 'Le paiement a été annulé.' : 'Le paiement a échoué.'}{' '}
        Aucun montant n&apos;a été prélevé pour cette tentative. Vous pouvez réessayer depuis la page Abonnement.
      </p>
      <BackLink />
    </Panel>
  );
}

function Panel({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="max-w-lg mx-auto mt-10 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-4 shadow-sm">
      <div className="flex justify-center">{icon}</div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h1>
      {children}
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/subscription">
      <Button variant="outline">Retour à l&apos;abonnement</Button>
    </Link>
  );
}

export default function PaymentReturnPage() {
  return (
    <Suspense fallback={null}>
      <PaymentReturn />
    </Suspense>
  );
}
