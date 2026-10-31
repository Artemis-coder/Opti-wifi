'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, ExternalLink, History, KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
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
      <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
        <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
        <span>Chargement...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-6 h-6 text-amber-500" />
            Abonnements expirant bientôt
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Licences en cours qui se terminent dans les {WINDOW_DAYS} prochains jours, la plus proche d&apos;abord.
          </p>
        </div>
        <Link href="/platform/subscriptions">
          <Button variant="outline" size="sm" icon={KeyRound}>
            Tous les abonnements
          </Button>
        </Link>
      </div>

      {subs.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <Calendar className="w-12 h-12 text-green-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucune expiration à prévoir</h3>
          <p className="text-xs text-slate-500">Aucune licence ne se termine dans les {WINDOW_DAYS} prochains jours.</p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <ResponsiveTable>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 dark:bg-slate-800/60 text-[11px] text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Forfait</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Expiration</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {subs.map((sub) => {
                  const days = sub.days_left ?? 0;
                  const urgent = days <= 7;
                  return (
                    <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3">
                        <Link
                          href={`/platform/clients/${sub.organization_id}`}
                          className="font-semibold text-slate-900 dark:text-white hover:text-amber-600"
                        >
                          {sub.organization_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-800 dark:text-slate-200">{sub.plan_name || '—'}</span>
                        <span className="block text-[11px] text-slate-500">
                          {sub.is_trial
                            ? 'Essai gratuit'
                            : sub.plan_price
                              ? `${formatCurrencyFCFA(sub.plan_price)} / ${PERIOD_LABELS[sub.plan_period || ''] || sub.plan_period}`
                              : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={urgent ? 'danger' : 'warning'} className="text-[11px]">
                          {urgent ? 'Expire très bientôt' : 'Expire bientôt'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="block text-slate-700 dark:text-slate-300">
                          {sub.end_date ? formatDateOnlyFR(sub.end_date) : '—'}
                        </span>
                        <span
                          className={
                            urgent
                              ? 'text-xs font-semibold text-red-600 dark:text-red-400'
                              : 'text-xs text-amber-600 dark:text-amber-400'
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
                            className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <ExternalLink className="w-4 h-4 text-slate-500" />
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
