'use client';

import React, { useState, useEffect } from 'react';
import { Receipt, Loader2, Calendar, CheckCircle, Clock, Ban } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrencyFCFA, formatDateFR } from '@/lib/utils/format';
import { SubscriptionStatus } from '@/types/platform';

const STATUS_CONFIG: Record<string, { label: string; color: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  active: { label: 'Actif', color: 'warning' },
  expiring: { label: 'Expire bientôt', color: 'warning' },
};

interface ExpiringSub {
  id: string;
  organization_id: string;
  plan_id: string;
  status: string;
  end_date?: string | null;
  created_at: string;
  organization?: { name?: string; email?: string };
  plan?: { name?: string; price?: number; currency?: string };
}

export default function PlatformExpiringSubscriptionsPage() {
  const [subs, setSubs] = useState<ExpiringSub[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExpiring();
  }, []);

  async function loadExpiring() {
    setLoading(true);
    try {
      const res = await fetch('/api/platform/subscriptions?status=expiring');
      const result = await res.json();
      if (res.ok) {
        setSubs(result.data || []);
      }
    } catch {
      //
    } finally {
      setLoading(false);
    }
  }

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
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Abonnements Expirant Bientôt</h1>
        <p className="text-xs text-slate-500">Abonnements qui expirent dans les 30 prochains jours.</p>
      </div>

      {subs.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <Calendar className="w-12 h-12 text-green-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucune expiration à prévoir</h3>
          <p className="text-xs text-slate-500">Aucun abonnement n'arrive à expiration dans les 30 prochains jours.</p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Expiration</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                {subs.map((sub) => {
                  const daysLeft = sub.end_date
                    ? Math.ceil((new Date(sub.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    : 0;
                  const isExpiringSoon = daysLeft <= 7;

                  return (
                    <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3">
                        <Link href={`/platform/clients/${sub.organization_id || ''}`} className="font-semibold text-slate-900 dark:text-white hover:text-amber-500">
                          {sub.organization?.name || '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {sub.plan?.name || '—'}
                        {sub.plan?.price && sub.plan?.price > 0 && (
                          <span className="text-xs text-slate-500 block">
                            {formatCurrencyFCFA(sub.plan.price)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={isExpiringSoon ? 'danger' : 'warning'} className="text-xs">
                          {isExpiringSoon ? 'Expire très bientôt' : 'Expire bientôt'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {sub.end_date ? formatDateFR(sub.end_date) : '—'}
                        {daysLeft >= 0 && <span className="text-xs block"> ({daysLeft} jours restants)</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/platform/clients/${sub.organization_id || ''}`}>
                          <Badge variant="info" className="cursor-pointer hover:opacity-80">
                            Voir le client
                          </Badge>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
