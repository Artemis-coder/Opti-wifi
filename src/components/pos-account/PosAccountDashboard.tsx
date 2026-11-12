'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight, Banknote, CalendarCheck, Eye, Loader2, MapPin, Percent, Receipt, Store, Ticket } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { cn } from '@/lib/utils/cn';
import { formatAmountShort, formatDateOnlyFR, formatNumber } from '@/lib/utils/format';
import { useAuthStore } from '@/lib/stores/authStore';
import type { DashboardPeriod, PosAccountDashboard as Data } from '@/lib/pos-account-dashboard';

const money = formatAmountShort;

// Une seule période pour les chiffres clés ET les listes : tout concorde à l'écran
const PERIODS: { value: DashboardPeriod; label: string; scope: string }[] = [
  { value: 'month', label: 'Ce mois-ci', scope: 'ce mois-ci' },
  { value: '3months', label: '3 derniers mois', scope: 'sur 3 mois' },
  { value: 'year', label: 'Cette année', scope: 'cette année' },
  { value: 'all', label: 'Tout', scope: 'depuis le début' },
];

const MOVEMENT: Record<Data['recent'][number]['kind'], { label: string; icon: React.ElementType; tone: string; href: string }> = {
  allocation: { label: 'Tickets reçus', icon: Ticket, tone: 'text-amber-600 bg-amber-500/10', href: '/allocations' },
  exchange_receive: { label: 'Échange : réception', icon: ArrowDownLeft, tone: 'text-indigo-600 bg-indigo-500/10', href: '/allocations' },
  exchange_return: { label: 'Échange : retour', icon: ArrowUpRight, tone: 'text-slate-600 bg-slate-500/10', href: '/allocations' },
};

/** Accueil d'un compte point de vente : chiffres clés et derniers mouvements de la période choisie (consultation seule). */
export function PosAccountDashboard() {
  const user = useAuthStore((s) => s.user);
  const [period, setPeriod] = useState<DashboardPeriod>('month');
  const [result, setResult] = useState<{ period: DashboardPeriod; data: Data | null } | null>(null);
  const loading = result?.period !== period;
  const data = result?.data ?? null;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/pos-account/dashboard?period=${period}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { data: null }))
      .then((json) => !cancelled && setResult({ period, data: json.data ?? null }))
      .catch(() => !cancelled && setResult({ period, data: null }));
    return () => {
      cancelled = true;
    };
  }, [period]);

  const scope = PERIODS.find((p) => p.value === period)?.scope ?? '';
  const m = data?.totals;
  const gapAlert = !!m && m.gap < 0;

  if (!result) {
    return (
      <div className="py-24 flex justify-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!data?.pos) {
    return (
      <Card className="p-10 max-w-xl mx-auto text-center space-y-2">
        <Store className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
        <p className="font-semibold text-slate-800 dark:text-slate-100">Aucun point de vente rattaché à ce compte</p>
        <p className="text-sm text-slate-500">Contactez l&apos;administrateur de votre organisation.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Bonjour{user?.nom ? `, ${user.nom}` : ''}</p>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Store className="w-5 h-5 text-brand-600" /> {data.pos.name}
          </h1>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="w-3 h-3" />
            {[data.pos.address, data.pos.city, data.pos.space].filter(Boolean).join(' · ') || 'Adresse non renseignée'}
          </p>
          {data.pos.collector && <p className="text-xs text-slate-500 mt-0.5">Collecteur : {data.pos.collector}</p>}
        </div>
        <span className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <Eye className="w-3.5 h-3.5" /> Consultation seule
        </span>
      </div>

      {/* Période : s'applique aux chiffres clés et aux deux listes */}
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

      <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 transition-opacity', loading && 'opacity-60')}>
        <StatTile
          label="Tickets reçus"
          value={formatNumber(m?.tickets_received ?? 0)}
          icon={Ticket}
          accent="amber"
          hint={`Allocations ${scope} (échanges compris)`}
          href="/allocations"
        />
        <StatTile
          label="Total collecté"
          value={money(m?.collected ?? 0)}
          icon={Banknote}
          accent="emerald"
          hint={m?.collections ? `${m.collections} collecte${m.collections > 1 ? 's' : ''} ${scope}` : `Aucune collecte ${scope}`}
          href="/collections"
        />
        <StatTile
          label="Écart"
          value={`${(m?.gap ?? 0) > 0 ? '+' : ''}${money(m?.gap ?? 0)}`}
          icon={CalendarCheck}
          accent="red"
          alert={gapAlert}
          hint={
            m?.gap_count
              ? `${m.gap_count} collecte${m.gap_count > 1 ? 's' : ''} avec écart · attendu ${money(m.expected)}`
              : `Aucun écart · attendu ${money(m?.expected ?? 0)}`
          }
        />
        <StatTile label="Ma commission" value={money(m?.commission ?? 0)} icon={Percent} accent="indigo" hint={`Total ${scope}`} href="/commissions" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 5 dernières collectes : montant, date, collecteur, écart et commission */}
        <Card className="p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">5 dernières collectes <span className="font-normal text-slate-500">· {scope}</span></h2>
            <Link href="/collections" className="text-xs font-semibold text-brand-700 dark:text-brand-300 hover:underline">
              Tout voir
            </Link>
          </div>
          {data.last_collections.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">Aucune collecte {scope}.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.last_collections.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/collections/${c.id}`}
                    className="flex items-center gap-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg px-1"
                  >
                    <span className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-emerald-600 bg-emerald-500/10">
                      <Receipt className="w-4 h-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-900 dark:text-white">{formatDateOnlyFR(c.date)}</span>
                      {c.collector && <span className="block text-xs text-slate-500 truncate">Par {c.collector}</span>}
                      <span className="block text-xs text-slate-500">Commission {money(c.commission)}</span>
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-bold tabular-nums text-slate-900 dark:text-white">{money(c.collected)}</span>
                      <span
                        className={cn(
                          'block text-xs font-semibold tabular-nums',
                          c.gap < 0 ? 'text-red-600' : 'text-emerald-700 dark:text-emerald-400',
                        )}
                      >
                        {c.gap === 0 ? 'Sans écart' : `Écart ${c.gap > 0 ? '+' : ''}${money(c.gap)}`}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Derniers tickets reçus (allocations et échanges) */}
        <Card className="p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Derniers tickets reçus <span className="font-normal text-slate-500">· {scope}</span></h2>
            <Link href="/allocations" className="text-xs font-semibold text-brand-700 dark:text-brand-300 hover:underline">
              Tout voir
            </Link>
          </div>
          {data.recent.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">Aucun ticket reçu {scope}.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.recent.map((r) => {
                const meta = MOVEMENT[r.kind] ?? MOVEMENT.allocation;
                const Icon = meta.icon;
                return (
                  <li key={`${r.kind}-${r.id}`}>
                    <Link
                      href={`${meta.href}/${r.id}`}
                      className="flex items-center gap-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg px-1"
                    >
                      <span className={cn('w-9 h-9 shrink-0 rounded-xl flex items-center justify-center', meta.tone)}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        {/* Type de ticket en titre ; la nature n'est précisée que pour un échange */}
                        <span className="block text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {r.label || meta.label}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {r.kind !== 'allocation' ? `${meta.label} · ` : ''}
                          {formatDateOnlyFR(r.date)}
                        </span>
                      </span>
                      <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                        {`${r.kind === 'exchange_return' ? '−' : '+'}${formatNumber(r.value)} tickets`}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
