'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Banknote,
  CalendarCheck,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  Receipt,
  Store,
  Ticket,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { buttonClassName } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';
import { formatCurrencyFCFA, formatDateOnlyFR, formatNumber } from '@/lib/utils/format';
import { useSpaceStore } from '@/lib/stores/spaceStore';
import { useAuthStore } from '@/lib/stores/authStore';
import type { CollectorDashboard as Data } from '@/lib/collector-dashboard';
import type { DashboardPeriod } from '@/lib/client-dashboard';

const PERIODS: { value: DashboardPeriod; label: string }[] = [
  { value: 'all', label: 'Tout' },
  { value: 'today', label: "Aujourd'hui" },
  { value: 'week', label: '7 jours' },
  { value: 'month', label: 'Ce mois-ci' },
];

/** Au-delà, un point de vente est signalé « à visiter ». */
const OVERDUE_DAYS = 7;

const money = (n: number) => `${formatNumber(Math.round(n))} F`;

function lastVisit(days: number | null): { text: string; tone: string } {
  if (days === null) return { text: 'Jamais collecté', tone: 'text-amber-700 dark:text-amber-400' };
  if (days <= 0) return { text: "Collecté aujourd'hui", tone: 'text-emerald-700 dark:text-emerald-400' };
  const text = days === 1 ? 'Collecté hier' : `Il y a ${days} jours`;
  return { text, tone: days >= OVERDUE_DAYS ? 'text-red-600 dark:text-red-400' : 'text-slate-500' };
}

/** Accueil du collecteur : sa tournée de points de vente et ses encaissements. */
export function CollectorDashboard() {
  const user = useAuthStore((s) => s.user);
  const { currentSpaceId } = useSpaceStore();
  const [period, setPeriod] = useState<DashboardPeriod>('all');
  const [result, setResult] = useState<{ key: string; data: Data | null } | null>(null);
  const key = `${period}|${currentSpaceId || ''}`;
  const loading = result?.key !== key;
  const data = result?.data ?? null;

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ period });
    if (currentSpaceId) params.set('space', currentSpaceId);
    fetch(`/api/collector/dashboard?${params}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { data: null }))
      .then((json) => !cancelled && setResult({ key, data: json.data }))
      .catch(() => !cancelled && setResult({ key, data: null }));
    return () => {
      cancelled = true;
    };
  }, [period, currentSpaceId, key]);

  const firstName = (user?.nom || '').trim().split(/\s+/)[0];
  const today = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const pending = data?.pos.filter((p) => p.status === 'actif' && (p.days_since === null || p.days_since >= OVERDUE_DAYS)).length ?? 0;
  const t = data?.totals;
  const gapAlert = !!t && t.gap < 0;
  const count = t?.collections ?? 0;

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-6">
      {/* En-tête : date du jour, salutation, action principale */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 first-letter:uppercase">{today}</p>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Bonjour{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {pending > 0
              ? `${pending} point${pending > 1 ? 's' : ''} de vente à visiter en priorité.`
              : 'Votre tournée est à jour.'}
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Link href="/allocations/new" className={buttonClassName({ variant: 'outline', className: 'flex-1 sm:flex-initial' })}>
            <Ticket className="w-4 h-4" /> Attribuer des tickets
          </Link>
          <Link href="/collections/new" className={buttonClassName({ className: 'flex-1 sm:flex-initial' })}>
            <Receipt className="w-4 h-4" /> Nouvelle collecte
          </Link>
        </div>
      </div>

      {/* Période des chiffres : mêmes collectes que « Mes collectes » (les siennes) */}
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

      {/* Chiffres clés : uniquement les collectes faites par le collecteur */}
      <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 transition-opacity', loading && 'opacity-60')}>
        <StatTile
          label="Total encaissé"
          value={money(t?.collected ?? 0)}
          icon={Banknote}
          accent="emerald"
          hint={count ? `${count} collecte${count > 1 ? 's' : ''}` : 'Aucune collecte sur la période'}
        />
        <StatTile
          label="Montant attendu"
          value={money(t?.expected ?? 0)}
          icon={CalendarCheck}
          accent="indigo"
          hint="Ventes déclarées"
        />
        <StatTile
          label="Écart"
          value={`${(t?.gap ?? 0) > 0 ? '+' : ''}${money(t?.gap ?? 0)}`}
          icon={AlertTriangle}
          accent="red"
          alert={gapAlert}
          hint={gapAlert ? 'Manque à justifier' : 'Aucun manque'}
        />
        <StatTile
          label="Tickets vendus"
          value={formatNumber(t?.tickets ?? 0)}
          icon={Ticket}
          accent="amber"
          hint="Déclarés lors des collectes"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Ma tournée : points de vente attribués, les plus en retard d'abord */}
        <Card className="p-4 sm:p-5 space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Ma tournée</h2>
            <Link href="/pos" className="text-xs font-semibold text-brand-700 dark:text-brand-300 hover:underline">
              {data?.pos.length ?? 0} point{(data?.pos.length ?? 0) > 1 ? 's' : ''} de vente
            </Link>
          </div>

          {loading && !data ? (
            <div className="py-12 flex justify-center text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : !data?.pos.length ? (
            <div className="py-10 flex flex-col items-center gap-2 text-center">
              <Store className="w-8 h-8 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Aucun point de vente ne vous est attribué</p>
              <p className="text-xs text-slate-500 max-w-sm">
                Demandez à l&apos;administrateur de votre organisation de vous attribuer des points de vente pour commencer vos collectes.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {data.pos.map((p) => {
                const visit = lastVisit(p.days_since);
                const active = p.status === 'actif';
                return (
                  <li
                    key={p.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 px-3.5 py-3"
                  >
                    <Link href={`/pos/${p.id}`} className="min-w-0 flex-1 group">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white truncate group-hover:underline">{p.name}</span>
                        {!active && (
                          <span className="shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                            {p.status}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 truncate">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {[p.address, p.city, p.space].filter(Boolean).join(' · ') || 'Adresse non renseignée'}
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className={cn('inline-flex items-center gap-1 font-semibold', visit.tone)}>
                          <Clock className="w-3 h-3" /> {visit.text}
                        </span>
                        <span className="text-slate-500">
                          <strong className="text-slate-800 dark:text-slate-200 tabular-nums">{formatNumber(p.stock_tickets)}</strong> tickets en circulation
                          {p.stock_value > 0 && <> · {money(p.stock_value)}</>}
                        </span>
                      </span>
                    </Link>
                    {active ? (
                      <span className="flex gap-2 shrink-0 w-full sm:w-auto">
                        <Link
                          href={`/allocations/new?pos=${p.id}`}
                          className={buttonClassName({ size: 'sm', variant: 'outline', className: 'flex-1 sm:flex-initial' })}
                        >
                          <Ticket className="w-4 h-4" /> Tickets
                        </Link>
                        <Link
                          href={`/collections/new?pos=${p.id}`}
                          className={buttonClassName({ size: 'sm', className: 'flex-1 sm:flex-initial' })}
                        >
                          <Receipt className="w-4 h-4" /> Collecter
                        </Link>
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs text-slate-400 sm:w-24 sm:text-right">Point inactif</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Dernières collectes du collecteur */}
        <Card className="p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Mes dernières collectes</h2>
            <Link href="/collections" className="text-xs font-semibold text-brand-700 dark:text-brand-300 hover:underline">
              Voir tout
            </Link>
          </div>
          {loading && !data ? (
            <div className="py-10 flex justify-center text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : !data?.recent.length ? (
            <p className="py-6 text-center text-sm text-slate-500">Aucune collecte enregistrée pour le moment.</p>
          ) : (
            <ul className="space-y-2">
              {data.recent.map((c) => {
                const gap = c.gap < 0;
                const cancelled = c.status === 'annulee';
                const draft = c.status === 'brouillon';
                return (
                  <li key={c.id}>
                    <Link
                      href={`/collections/${c.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 px-3.5 py-3 hover:border-slate-300 dark:hover:border-slate-700 transition"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-900 dark:text-white truncate">{c.pos}</span>
                        <span className="block text-xs text-slate-500 truncate">
                          {formatDateOnlyFR(c.date)} · {formatCurrencyFCFA(c.collected)}
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={cn(
                            'text-[11px] font-bold px-2.5 py-1 rounded-full',
                            cancelled
                              ? 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                              : draft
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                                : gap
                                  ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
                          )}
                        >
                          {cancelled ? 'Annulée' : draft ? 'Brouillon' : gap ? 'Écart' : 'Validée'}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-300" />
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
