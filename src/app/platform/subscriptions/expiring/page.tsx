'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, ExternalLink, History, KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonClassName } from '@/components/ui/Button';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
import { LicenseActivationModal } from '@/components/platform/LicenseActivationModal';
import { formatCurrencyFCFA, formatDateOnlyFR } from '@/lib/utils/format';

/** Fenêtre affichée : licences en cours qui se terminent dans les 30 prochains jours */
const WINDOW_DAYS = 30;

// Ligne renvoyée par /api/platform/subscriptions (licence actuelle de chaque client)
interface ExpiringSub {
  id: string;
  organization_id: string;
  plan_id: string;
  status: string;
  end_date: string | null;
  organization_name: string;
  organization_status: string;
  plan_name: string | null;
  plan_price: number | null;
  plan_period: string | null;
  is_trial: boolean;
  days_left: number | null;
}

const PERIOD_LABELS: Record<string, string> = { monthly: 'mois', quarterly: 'trimestre', semiannual: 'semestre', annual: 'an' };

function whenLabel(days: number): string {
  return days <= 0 ? "aujourd'hui" : days === 1 ? 'demain' : `dans ${days} jours`;
}

export default function PlatformExpiringSubscriptionsPage() {
  const [subs, setSubs] = useState<ExpiringSub[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [extending, setExtending] = useState<ExpiringSub | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/platform/subscriptions')
      .then(async (res) => {
        const result = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          toast.error(result.error || 'Erreur de chargement');
          return;
        }
        // Licences en cours (essai ou payante) qui se terminent dans la fenêtre, la plus proche d'abord
        const rows = ((result.data || []) as ExpiringSub[])
          .filter(
            (s) =>
              (s.status === 'active' || s.status === 'trialing') &&
              s.days_left !== null &&
              s.days_left > 0 &&
              s.days_left <= WINDOW_DAYS &&
              s.organization_status !== 'suspended'
          )
          .sort((a, b) => (a.days_left ?? 0) - (b.days_left ?? 0));
        setSubs(rows);
      })
      .catch(() => {
        if (!cancelled) toast.error('Erreur réseau');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (loading) {
    return (
      <div className="py-10 flex justify-center items-center gap-2 text-muted text-sm font-medium">
        <Loader2 className="w-5 h-5 animate-spin text-accent" />
        <span>Chargement...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <History className="size-6 text-muted" />
            Abonnements expirant bientôt
          </h1>
          <p className="text-sm text-muted mt-1">
            Licences en cours qui se terminent dans les {WINDOW_DAYS} prochains jours, la plus proche d&apos;abord.
          </p>
        </div>
        <Link href="/platform/subscriptions" className={buttonClassName({ variant: 'outline', size: 'sm' })}>
          <KeyRound className="size-4 shrink-0" aria-hidden />
            Tous les abonnements
          </Link>
      </div>

      {subs.length === 0 ? (
        <Card className="text-center space-y-3 py-8">
          <Calendar className="w-12 h-12 text-success-soft-foreground mx-auto" />
          <h3 className="text-base font-semibold text-foreground">Aucune expiration à prévoir</h3>
          <p className="text-xs text-muted">Aucune licence ne se termine dans les {WINDOW_DAYS} prochains jours.</p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <ResponsiveTable>
            <table className="w-full text-left text-sm">
              <thead className="bg-default text-xs text-muted font-semibold">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Forfait</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Expiration</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-separator">
                {subs.map((sub) => {
                  const days = sub.days_left ?? 0;
                  const urgent = days <= 7;
                  return (
                    <tr key={sub.id} className="hover:bg-surface-secondary transition">
                      <td className="px-4 py-3">
                        <Link
                          href={`/platform/clients/${sub.organization_id}`}
                          className="font-semibold text-foreground hover:text-warning-soft-foreground"
                        >
                          {sub.organization_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">{sub.plan_name || '—'}</span>
                        <span className="block text-xs text-muted">
                          {sub.is_trial
                            ? 'Essai gratuit'
                            : sub.plan_price
                              ? `${formatCurrencyFCFA(sub.plan_price)} / ${PERIOD_LABELS[sub.plan_period || ''] || sub.plan_period}`
                              : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={urgent ? 'danger' : 'warning'} className="text-xs">
                          {urgent ? 'Expire très bientôt' : 'Expire bientôt'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="block text-foreground">
                          {sub.end_date ? formatDateOnlyFR(sub.end_date) : '—'}
                        </span>
                        <span
                          className={
                            urgent
                              ? 'text-xs font-semibold text-danger'
                              : 'text-xs text-warning-soft-foreground'
                          }
                        >
                          Fin {whenLabel(days)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            className="text-xs h-8 whitespace-nowrap"
                            icon={KeyRound}
                            onClick={() => setExtending(sub)}
                          >
                            Prolonger
                          </Button>
                          <Link
                            href={`/platform/clients/${sub.organization_id}`}
                            title="Voir le client"
                            aria-label="Voir le client"
                            className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-border hover:bg-default"
                          >
                            <ExternalLink className="w-4 h-4 text-muted" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ResponsiveTable>
        </Card>
      )}

      {extending && (
        <LicenseActivationModal
          isOpen={!!extending}
          onClose={() => setExtending(null)}
          onActivated={() => setReloadKey((k) => k + 1)}
          organizationId={extending.organization_id}
          organizationName={extending.organization_name}
          currentEndDate={extending.end_date}
          // Après un essai, le client choisit son forfait ; sinon le forfait actuel est proposé
          defaultPlanId={extending.is_trial ? null : extending.plan_id}
        />
      )}
    </div>
  );
}
