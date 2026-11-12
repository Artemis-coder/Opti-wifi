'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Award, CalendarHeart, Coins, Loader2, Percent, Receipt } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { cn } from '@/lib/utils/cn';
import { formatAmountShort, formatDateOnlyFR, formatNumber } from '@/lib/utils/format';
import type { CommissionPeriod, PosAccountCommissions } from '@/lib/pos-account-commissions';
import { CommissionsChart } from '@/components/pos-account/CommissionsChart';

const PERIODS: { value: CommissionPeriod; label: string }[] = [
  { value: 'all', label: 'Tout' },
  { value: 'month', label: 'Ce mois-ci' },
  { value: '3months', label: '3 derniers mois' },
  { value: 'year', label: 'Cette année' },
];

const money = formatAmountShort;

/** « 2026-10 » → « octobre 2026 » */
function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
}

/** « Mes commissions » d'un compte point de vente (consultation seule). */
export default function CommissionsPage() {
  const [period, setPeriod] = useState<CommissionPeriod>('all');
  const [result, setResult] = useState<{ period: CommissionPeriod; data: PosAccountCommissions | null } | null>(null);
  const loading = result?.period !== period;
  const data = result?.data ?? null;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/pos-account/commissions?period=${period}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { data: null }))
      .then((json) => !cancelled && setResult({ period, data: json.data ?? null }))
      .catch(() => !cancelled && setResult({ period, data: null }));
    return () => {
      cancelled = true;
    };
  }, [period]);

  const k = data?.kpis;

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Coins className="w-5 h-5 sm:w-6 sm:h-6 text-brand-600 dark:text-brand-400" />
          <span>Mes commissions</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">Les commissions reçues à chaque collecte faite dans votre point de vente.</p>
      </div>

      {/* Période */}
      <div role="group" aria-label="Période" className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPeriod(p.value)}
            aria-pressed={period === p.value}
            className={cn(
              'shrink-0 h-9 px-3.5 rounded-full text-xs font-semibold border transition',
              period === p.value
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Chiffres clés de la période */}
      <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 transition-opacity', loading && 'opacity-60')}>
        <StatTile
          label="Total des commissions"
          value={money(k?.total ?? 0)}
          icon={Coins}
          accent="emerald"
          hint={k?.count ? `${formatNumber(k.count)} collecte${k.count > 1 ? 's' : ''}` : 'Aucune commission sur la période'}
        />
        <StatTile label="Commission moyenne" value={money(k?.average ?? 0)} icon={Percent} accent="indigo" hint="Par collecte" />
        <StatTile
          label="Commission la plus élevée"
          value={money(k?.highest?.amount ?? 0)}
          icon={Award}
          accent="amber"
          hint={k?.highest ? `le ${formatDateOnlyFR(k.highest.date)}` : '—'}
          href={k?.highest ? `/collections/${k.highest.collection_id}` : undefined}
        />
        <StatTile
          label="Mon mois de bonheur"
          value={k?.best_month ? <span className="inline-block first-letter:uppercase">{monthLabel(k.best_month.month)}</span> : '—'}
          icon={CalendarHeart}
          accent="purple"
          hint={k?.best_month ? `${money(k.best_month.total)} de commissions` : 'Le mois où vous avez gagné le plus'}
        />
      </div>

      {loading && !data ? (
        <div className="py-16 flex justify-center text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : !data || data.items.length === 0 ? (
        <Card className="p-10 text-center space-y-2">
          <Coins className="w-9 h-9 mx-auto text-slate-300 dark:text-slate-600" />
          <p className="font-semibold text-slate-800 dark:text-slate-100">Aucune commission sur cette période</p>
          <p className="text-sm text-slate-500">Vos commissions apparaîtront ici après chaque collecte.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Commissions par mois : barres ou courbe, pic et mois le plus bas */}
          <CommissionsChart months={data.months} />

          {/* Toutes les commissions de la période */}
          <Card className="p-0 overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Toutes mes commissions</h2>
              <span className="text-xs text-slate-500">{formatNumber(data.items.length)}</span>
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.items.map((c) => {
                const isTop = k?.highest?.collection_id === c.collection_id;
                return (
                  <li key={c.collection_id}>
                    <Link
                      href={`/collections/${c.collection_id}`}
                      className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <span className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-emerald-600 bg-emerald-500/10">
                        <Receipt className="w-4 h-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                          {formatDateOnlyFR(c.date)}
                          {isTop && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                              <Award className="w-3 h-3" /> La plus élevée
                            </span>
                          )}
                        </span>
                        <span className="block text-xs text-slate-500 truncate">
                          Collecte de {money(c.collected)}
                          {c.collector ? ` · par ${c.collector}` : ''}
                        </span>
                      </span>
                      <span className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                        +{money(c.commission)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>

        </div>
      )}
    </div>
  );
}
