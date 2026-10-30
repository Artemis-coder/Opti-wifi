'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  ChevronRight,
  Inbox,
  Loader2,
  Ticket,
  ArrowLeftRight,
  Receipt,
  Store,
} from 'lucide-react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { Card } from '@/components/ui/Card';
import { AddButton } from '@/components/ui/AddButton';
import { cn } from '@/lib/utils/cn';
import { formatCurrencyFCFA, formatNumber } from '@/lib/utils/format';
import { useSpaceStore } from '@/lib/stores/spaceStore';
import { useAuthStore } from '@/lib/stores/authStore';
import type { ClientDashboard, DashboardPeriod } from '@/lib/client-dashboard';

const PERIODS: { value: DashboardPeriod; label: string; eyebrow: string }[] = [
  { value: 'all', label: 'Tout', eyebrow: 'Depuis le début' },
  { value: 'today', label: "Aujourd'hui", eyebrow: "Aujourd'hui" },
  { value: 'week', label: '7 jours', eyebrow: '7 derniers jours' },
  { value: 'month', label: 'Ce mois-ci', eyebrow: 'Ce mois-ci' },
];

const SHORTCUTS: { href: string; label: string; hint: string; icon: React.ElementType; tone: string; adminOnly?: boolean }[] = [
  {
    href: '/allocations/new',
    label: 'Allouer des tickets',
    hint: 'Distribuer du stock aux POS',
    icon: ArrowLeftRight,
    tone: 'bg-purple-600 text-white',
    adminOnly: true,
  },
  {
    href: '/collections/new',
    label: 'Nouvelle collecte',
    hint: 'Saisir un encaissement de caisse',
    icon: Receipt,
    tone: 'bg-amber-500 text-slate-950',
  },
  { href: '/pos', label: 'Points de vente', hint: 'Gérer le réseau de distribution', icon: Store, tone: 'bg-indigo-900 text-white' },
  {
    href: '/tickets',
    label: 'Types de tickets',
    hint: 'Consulter et modifier les tarifs',
    icon: Ticket,
    tone: 'bg-emerald-600 text-white',
    adminOnly: true,
  },
];

const PREVIOUS_LABEL: Record<DashboardPeriod, string> = { today: 'hier', week: '7 jours précédents', month: 'mois dernier', all: '' };

/** Montant compact sur l'axe et dans les infobulles : 962 400 F */
const money = (n: number) => `${formatNumber(Math.round(n))} F`;

function Evolution({ current, previous, period }: { current: number; previous: number | undefined; period: DashboardPeriod }) {
  if (previous === undefined || period === 'all') return null;
  if (previous === 0) return <p className="text-[11px] text-slate-400">{current > 0 ? `Rien sur ${PREVIOUS_LABEL[period]}` : ' '}</p>;
  const pct = Math.round(((current - previous) / previous) * 100);
  const Icon = pct >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <p
      className={cn(
        'inline-flex items-center gap-0.5 text-[11px] font-semibold',
        pct >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
      )}
    >
      <Icon className="w-3.5 h-3.5" /> {pct > 0 ? '+' : ''}
      {pct} % <span className="font-normal text-slate-400">vs {PREVIOUS_LABEL[period]}</span>
    </p>
  );
}

interface TileProps {
  label: string;
  value: string;
  icon: React.ElementType;
  accent: 'amber' | 'indigo' | 'emerald' | 'red';
  alert?: boolean;
  footer?: React.ReactNode;
}

const ACCENTS = {
  amber: { border: 'border-l-amber-500', icon: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  indigo: { border: 'border-l-indigo-900 dark:border-l-indigo-400', icon: 'bg-indigo-900/10 text-indigo-900 dark:text-indigo-300' },
  emerald: { border: 'border-l-emerald-500', icon: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  red: { border: 'border-l-red-500', icon: 'bg-red-500/10 text-red-600 dark:text-red-400' },
};

function Tile({ label, value, icon: Icon, accent, alert, footer }: TileProps) {
  const a = ACCENTS[accent];
  return (
    <div
      className={cn(
        'rounded-2xl border border-l-4 p-4 sm:p-5 space-y-2 shadow-xs',
        a.border,
        alert
          ? 'bg-red-50/70 dark:bg-red-950/20 border-red-200 dark:border-red-900/50'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
        <span className={cn('w-8 h-8 shrink-0 rounded-lg flex items-center justify-center', a.icon)}>
          <Icon className="w-4 h-4" />
        </span>
      </div>
      <p
        className={cn(
          'text-xl sm:text-2xl font-extrabold tabular-nums',
          alert ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white',
        )}
      >
        {value}
      </p>
      {footer}
    </div>
  );
}

function PosTooltip({ active, payload }: { active?: boolean; payload?: { payload: ClientDashboard['by_pos'][number] }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg px-3 py-2 text-xs space-y-1 min-w-40">
      <p className="font-bold text-slate-900 dark:text-white">{p.name}</p>
      <p className="flex justify-between gap-3 text-slate-600 dark:text-slate-300">
        Ventes <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{money(p.revenue)}</span>
      </p>
      <p className="flex justify-between gap-3 text-slate-600 dark:text-slate-300">
        Encaissé <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{money(p.collected)}</span>
      </p>
      <p className="flex justify-between gap-3 text-slate-600 dark:text-slate-300">
        Écart{' '}
        <span className={cn('font-semibold tabular-nums', p.gap < 0 ? 'text-red-600' : 'text-emerald-700 dark:text-emerald-400')}>
          {money(p.gap)}
        </span>
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const { currentSpaceId } = useSpaceStore();
  const isAdmin = useAuthStore((s) => s.user?.role) === 'administrateur';
  const [period, setPeriod] = useState<DashboardPeriod>('all');
  const key = `${period}|${currentSpaceId || ''}`;
  const [result, setResult] = useState<{ key: string; data: ClientDashboard | null } | null>(null);
  const loading = result?.key !== key;
  const data = result?.data ?? null;

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ period });
    if (currentSpaceId) params.set('space', currentSpaceId);
    fetch(`/api/dashboard?${params}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { data: null }))
      .then((json) => !cancelled && setResult({ key, data: json.data }))
      .catch(() => !cancelled && setResult({ key, data: null }));
    return () => {
      cancelled = true;
    };
  }, [period, currentSpaceId, key]);

  const eyebrow = PERIODS.find((p) => p.value === period)!.eyebrow;
  const t = data?.totals;
  const gapAlert = !!t && t.gap < 0;

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-6">
      {/* En-tête : période en surtitre, filtres de période */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{eyebrow}</p>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Tableau de bord</h1>
        </div>
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
      </div>

      {/* Chiffres clés */}
      <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 transition-opacity', loading && 'opacity-60')}>
        <Tile
          label="Tickets vendus"
          value={formatNumber(t?.tickets ?? 0)}
          icon={Ticket}
          accent="amber"
          footer={
            <p className="text-[11px] text-slate-400">
              {t?.collections ?? 0} encaissement{(t?.collections ?? 0) > 1 ? 's' : ''}
            </p>
          }
        />
        <Tile
          label="Chiffre d'affaires"
          value={money(t?.revenue ?? 0)}
          icon={Banknote}
          accent="indigo"
          footer={<Evolution current={t?.revenue ?? 0} previous={data?.previous?.revenue} period={period} />}
        />
        <Tile
          label="Total encaissé"
          value={money(t?.collected ?? 0)}
          icon={CheckCircle2}
          accent="emerald"
          footer={<Evolution current={t?.collected ?? 0} previous={data?.previous?.collected} period={period} />}
        />
        <Tile
          label="Écart"
          value={`${(t?.gap ?? 0) > 0 ? '+' : ''}${money(t?.gap ?? 0)}`}
          icon={AlertTriangle}
          accent="red"
          alert={gapAlert}
          footer={
            <p className={cn('text-[11px]', gapAlert ? 'text-red-600/80 dark:text-red-400/80' : 'text-slate-400')}>
              {gapAlert ? 'Manque à justifier' : 'Aucun manque'}
            </p>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Raccourcis */}
        <Card className="p-4 sm:p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Raccourcis</h2>
          <ul className="space-y-2">
            {SHORTCUTS.filter((s) => !s.adminOnly || isAdmin).map((s) => {
              const Icon = s.icon;
              return (
                <li key={s.href}>
                  <Link
                    href={s.href}
                    className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 px-3.5 py-3 hover:border-slate-300 dark:hover:border-slate-700 transition"
                  >
                    <span className={cn('w-9 h-9 shrink-0 rounded-lg flex items-center justify-center', s.tone)}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-900 dark:text-white truncate">{s.label}</span>
                      <span className="block text-xs text-slate-500 truncate">{s.hint}</span>
                    </span>
                    <ChevronRight className="w-4 h-4 shrink-0 text-slate-300" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Ventes par point de vente */}
        <Card className="p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Ventes par point de vente</h2>
            <span className="text-xs text-slate-500">{data?.pos_count ?? 0} POS</span>
          </div>
          {loading && !data ? (
            <div className="h-56 flex items-center justify-center text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : !data?.by_pos.length ? (
            <div className="h-56 flex flex-col items-center justify-center gap-2 text-center">
              <Inbox className="w-8 h-8 text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-500">Aucune vente sur cette période.</p>
            </div>
          ) : (
            <>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.by_pos} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap="14%">
                    <defs>
                      <linearGradient id="pos-ok" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6cc06c" />
                        <stop offset="100%" stopColor="#2f8a3f" />
                      </linearGradient>
                      <linearGradient id="pos-gap" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#e05a5a" />
                        <stop offset="100%" stopColor="#c23a3a" />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickFormatter={(v: string) => (v.length > 11 ? `${v.slice(0, 10)}…` : v)}
                    />
                    <Tooltip cursor={{ fill: 'rgba(100,116,139,0.08)' }} content={<PosTooltip />} />
                    <Bar dataKey="revenue" radius={[6, 6, 0, 0]} maxBarSize={72}>
                      {data.by_pos.map((p) => (
                        <Cell key={p.pos_id} fill={p.gap < 0 ? 'url(#pos-gap)' : 'url(#pos-ok)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#3f9a4c]" /> Ventes du point de vente
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#d04848]" /> Avec un écart de caisse
                </span>
              </p>
            </>
          )}
        </Card>

        {/* Derniers encaissements */}
        <Card className="p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Derniers encaissements</h2>
            <Link href="/collections" className="text-xs font-semibold text-brand-700 dark:text-brand-300 hover:underline">
              Voir tout
            </Link>
          </div>
          {loading && !data ? (
            <div className="py-10 flex justify-center text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : !data?.recent.length ? (
            <div className="py-6 text-center space-y-3">
              <p className="text-sm text-slate-500">Aucun encaissement enregistré.</p>
              <AddButton what="une collecte de caisse" href="/collections/new" />
            </div>
          ) : (
            <ul className="space-y-2">
              {data.recent.map((c) => {
                const gap = c.gap < 0;
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
                          {c.collector || 'Collecteur'} · {formatCurrencyFCFA(c.collected)}
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={cn(
                            'text-[11px] font-bold px-2.5 py-1 rounded-full',
                            draft
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                              : gap
                                ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
                          )}
                        >
                          {draft ? 'Brouillon' : gap ? 'Écart' : 'Validée'}
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
