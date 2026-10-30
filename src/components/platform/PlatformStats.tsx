'use client';

import React, { useState, useSyncExternalStore } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus, Table2, BarChart3, UserPlus, KeyRound, Banknote, Repeat } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/Card';
import { StatTile, type StatAccent } from '@/components/ui/StatTile';
import { cn } from '@/lib/utils/cn';
import { formatCurrencyFCFA, formatNumber } from '@/lib/utils/format';
import type { PlatformStats, StatsBucket } from '@/lib/platform-stats';

export type StatsRange = PlatformStats['range'];

export const STATS_RANGES: { value: StatsRange; label: string }[] = [
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: '90d', label: '3 mois' },
  { value: '6m', label: '6 mois' },
  { value: '1y', label: '12 mois' },
];

// Palette catégorielle validée (ordre fixe, contrôle daltonisme OK en clair et en sombre)
const PALETTE = {
  light: { s1: '#2a78d6', s2: '#eb6834', s3: '#1baf7a', s4: '#eda100', surface: '#ffffff', grid: '#e2e8f0', text: '#64748b' },
  dark: { s1: '#3987e5', s2: '#d95926', s3: '#199e70', s4: '#c98500', surface: '#0f172a', grid: '#1e293b', text: '#94a3b8' },
};

const darkQuery = '(prefers-color-scheme: dark)';
function subscribeDark(cb: () => void) {
  const mq = window.matchMedia(darkQuery);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}
/** L'application suit le thème du système (pas de classe .dark) */
function useDarkMode() {
  return useSyncExternalStore(
    subscribeDark,
    () => window.matchMedia(darkQuery).matches,
    () => false,
  );
}

const LICENSE_SERIES = [
  { key: 'new', label: 'Nouvelles', color: 's1' },
  { key: 'renewal', label: 'Renouvellements', color: 's2' },
  { key: 'upgrade', label: 'Changements de forfait', color: 's3' },
  { key: 'trial', label: 'Essais', color: 's4' },
] as const;

function bucketLabel(iso: string, unit: PlatformStats['unit'], long = false) {
  const d = new Date(iso);
  if (unit === 'month')
    return new Intl.DateTimeFormat('fr-FR', { month: long ? 'long' : 'short', year: long ? 'numeric' : '2-digit' }).format(d);
  const day = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(d);
  return unit === 'week' ? `${long ? 'Semaine du ' : 'sem. '}${day}` : day;
}

function compactFCFA(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k`;
  return String(n);
}

/** Évolution par rapport à la période précédente de même durée */
function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return <span className="text-xs text-slate-400">Stable</span>;
  if (previous === 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
        <ArrowUpRight className="w-3.5 h-3.5" /> Nouveau
      </span>
    );
  const pct = Math.round(((current - previous) / previous) * 100);
  const Icon = pct > 0 ? ArrowUpRight : pct < 0 ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-semibold',
        pct > 0 ? 'text-emerald-700 dark:text-emerald-400' : pct < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500',
      )}
    >
      <Icon className="w-3.5 h-3.5" /> {pct > 0 ? '+' : ''}
      {pct} %
    </span>
  );
}

/** Chiffre clé des statistiques : cadre StatTile du design system, avec sous-titre et évolution. */
function StatsTile({
  label,
  value,
  sub,
  delta,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  delta?: React.ReactNode;
  icon: React.ElementType;
  accent: StatAccent;
}) {
  return (
    <StatTile
      label={label}
      value={value}
      icon={icon}
      accent={accent}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 min-h-5">
          {sub && <span className="text-[11px] text-slate-400">{sub}</span>}
          {delta}
        </div>
      }
    />
  );
}

interface TooltipRow {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

function ChartTooltip({
  active,
  payload,
  label,
  unit,
  money,
}: {
  active?: boolean;
  payload?: TooltipRow[];
  label?: string;
  unit: PlatformStats['unit'];
  money?: boolean;
}) {
  if (!active || !payload?.length || !label) return null;
  const total = payload.reduce((a, p) => a + Number(p.value || 0), 0);
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg px-3 py-2 text-xs space-y-1 min-w-36">
      <p className="font-semibold text-slate-900 dark:text-white first-letter:uppercase">{bucketLabel(label, unit, true)}</p>
      {payload
        .slice()
        .reverse()
        .map((p) => (
          <p key={String(p.dataKey)} className="flex items-center justify-between gap-3 text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
              {money ? formatCurrencyFCFA(Number(p.value)) : formatNumber(Number(p.value))}
            </span>
          </p>
        ))}
      {payload.length > 1 && (
        <p className="flex justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800 text-slate-500">
          Total <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{formatNumber(total)}</span>
        </p>
      )}
    </div>
  );
}

/** Carte de graphique avec bascule vers le tableau des chiffres (accessibilité, lecture précise) */
function StatsChartCard({
  title,
  subtitle,
  legend,
  table,
  children,
}: {
  title: string;
  subtitle: string;
  legend?: { label: string; color: string }[];
  table: React.ReactNode;
  children: React.ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <Card className="p-4 sm:p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          aria-pressed={showTable}
          className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
        >
          {showTable ? <BarChart3 className="w-4 h-4" /> : <Table2 className="w-4 h-4" />}
          {showTable ? 'Graphique' : 'Voir les chiffres'}
        </button>
      </div>
      {legend && legend.length > 1 && !showTable && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: l.color }} />
              {l.label}
            </li>
          ))}
        </ul>
      )}
      {showTable ? <div className="max-h-72 overflow-auto md-scroll">{table}</div> : children}
    </Card>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-white dark:bg-slate-900">
        <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-800">
          {headers.map((h, i) => (
            <th key={h} className={cn('py-2 font-semibold', i > 0 && 'text-right')}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td
                key={j}
                className={cn(
                  'py-1.5 text-slate-700 dark:text-slate-300',
                  j > 0 && 'text-right tabular-nums',
                  j === 0 && 'first-letter:uppercase',
                )}
              >
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface PlatformStatsSectionProps {
  stats: PlatformStats | null;
  range: StatsRange;
  onRangeChange: (range: StatsRange) => void;
  loading?: boolean;
}

export function PlatformStatsSection({ stats, range, onRangeChange, loading }: PlatformStatsSectionProps) {
  const dark = useDarkMode();
  const c = dark ? PALETTE.dark : PALETTE.light;
  const rangeLabel = STATS_RANGES.find((r) => r.value === range)?.label.toLowerCase() ?? '';
  const series = stats?.series ?? [];
  const unit = stats?.unit ?? 'day';
  const axisTick = { fontSize: 11, fill: c.text };
  const xProps = {
    dataKey: 'bucket',
    tickFormatter: (v: string) => bucketLabel(v, unit),
    axisLine: false,
    tickLine: false,
    tick: axisTick,
    minTickGap: 16,
  };
  const yProps = { axisLine: false, tickLine: false, tick: axisTick, width: 36, allowDecimals: false };
  const cursor = { fill: dark ? 'rgba(148,163,184,0.12)' : 'rgba(100,116,139,0.08)' };
  const rows = (fn: (b: StatsBucket) => (string | number)[]) => series.map((b) => [bucketLabel(b.bucket, unit, true), ...fn(b)]);
  const totalActive = stats?.active_licenses ?? 0;

  return (
    <section className="space-y-4" aria-labelledby="stats-title">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 id="stats-title" className="text-lg font-bold text-slate-900 dark:text-white">
            Statistiques
          </h2>
          <p className="text-xs text-slate-500">Comparées à la période précédente de même durée.</p>
        </div>
        {/* Filtre de période : une seule rangée, défilable sur mobile */}
        <div role="group" aria-label="Période" className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 md-scroll">
          {STATS_RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => onRangeChange(r.value)}
              aria-pressed={range === r.value}
              className={cn(
                'shrink-0 h-9 px-3.5 rounded-full text-xs font-semibold transition border',
                range === r.value
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className={cn('space-y-4 transition-opacity', loading && 'opacity-60')}>
        {/* Chiffres clés */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatsTile
            label="Inscriptions"
            icon={UserPlus}
            accent="indigo"
            value={formatNumber(stats?.totals.registrations ?? 0)}
            sub={rangeLabel}
            delta={stats && <Delta current={stats.totals.registrations} previous={stats.previous.registrations} />}
          />
          <StatsTile
            label="Licences vendues"
            icon={KeyRound}
            accent="amber"
            value={formatNumber(stats?.totals.paid_licenses ?? 0)}
            sub={`+ ${stats?.totals.trials ?? 0} essai${(stats?.totals.trials ?? 0) > 1 ? 's' : ''}`}
            delta={stats && <Delta current={stats.totals.paid_licenses} previous={stats.previous.paid_licenses} />}
          />
          <StatsTile
            label="Revenus"
            icon={Banknote}
            accent="emerald"
            value={formatCurrencyFCFA(stats?.totals.revenue ?? 0)}
            sub={rangeLabel}
            delta={stats && <Delta current={stats.totals.revenue} previous={stats.previous.revenue} />}
          />
          <StatsTile
            label="Revenu mensuel récurrent"
            icon={Repeat}
            accent="purple"
            value={formatCurrencyFCFA(stats?.mrr ?? 0)}
            sub={`${totalActive} licence${totalActive > 1 ? 's' : ''} en cours`}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <StatsChartCard
            title="Évolution des inscriptions"
            subtitle={`Comptes créés, ${rangeLabel} · ${formatNumber(stats?.totals.registrations ?? 0)} au total`}
            table={<DataTable headers={['Période', 'Inscriptions']} rows={rows((b) => [b.registrations])} />}
          >
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={series} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barCategoryGap="20%">
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis {...xProps} />
                <YAxis {...yProps} />
                <Tooltip cursor={cursor} content={<ChartTooltip unit={unit} />} />
                <Bar dataKey="registrations" name="Inscriptions" fill={c.s1} radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </StatsChartCard>

          <StatsChartCard
            title="Évolution des abonnements"
            subtitle={`Licences activées par type, ${rangeLabel}`}
            legend={LICENSE_SERIES.map((s) => ({ label: s.label, color: c[s.color] }))}
            table={
              <DataTable
                headers={['Période', 'Nouv.', 'Renouv.', 'Chang.', 'Essais']}
                rows={rows((b) => [b.new, b.renewal, b.upgrade, b.trial])}
              />
            }
          >
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={series} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barCategoryGap="20%">
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis {...xProps} />
                <YAxis {...yProps} />
                <Tooltip cursor={cursor} content={<ChartTooltip unit={unit} />} />
                {LICENSE_SERIES.map((s, i) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    stackId="licences"
                    fill={c[s.color]}
                    // Espace de 2 px entre segments empilés (couleur du fond)
                    stroke={c.surface}
                    strokeWidth={2}
                    radius={i === LICENSE_SERIES.length - 1 ? [4, 4, 0, 0] : 0}
                    maxBarSize={36}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </StatsChartCard>

          <StatsChartCard
            title="Évolution des revenus"
            subtitle={`Licences payantes : prix du forfait × durée · ${formatCurrencyFCFA(stats?.totals.revenue ?? 0)}`}
            table={<DataTable headers={['Période', 'Revenus']} rows={rows((b) => [formatCurrencyFCFA(b.revenue)])} />}
          >
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={series} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="20%">
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis {...xProps} />
                <YAxis {...yProps} width={44} tickFormatter={compactFCFA} />
                <Tooltip cursor={cursor} content={<ChartTooltip unit={unit} money />} />
                <Bar dataKey="revenue" name="Revenus" fill={c.s1} radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </StatsChartCard>

          <StatsChartCard
            title="Répartition des abonnements"
            subtitle={`Licences en cours par forfait · ${totalActive} au total`}
            table={
              <DataTable
                headers={['Forfait', 'Licences', 'Part', 'Revenu mensuel']}
                rows={(stats?.plan_breakdown ?? []).map((p) => [
                  p.name,
                  p.count,
                  `${totalActive ? Math.round((p.count / totalActive) * 100) : 0} %`,
                  formatCurrencyFCFA(p.mrr),
                ])}
              />
            }
          >
            {stats?.plan_breakdown.length ? (
              <ul className="space-y-3.5 py-1">
                {stats.plan_breakdown.map((p) => {
                  const pct = totalActive ? Math.round((p.count / totalActive) * 100) : 0;
                  return (
                    <li key={p.plan_id} className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {p.name}
                          {p.is_trial && <span className="ml-1.5 text-xs font-medium text-slate-500">(essai)</span>}
                        </span>
                        <span className="shrink-0 tabular-nums text-slate-900 dark:text-white font-bold">
                          {p.count} <span className="font-medium text-slate-500">· {pct} %</span>
                        </span>
                      </div>
                      <div
                        className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"
                        role="img"
                        aria-label={`${p.name} : ${p.count} licence${p.count > 1 ? 's' : ''}, ${pct} %`}
                      >
                        <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 2)}%`, background: c.s1 }} />
                      </div>
                      {!p.is_trial && <p className="text-xs text-slate-500">{formatCurrencyFCFA(p.mrr)} / mois</p>}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="h-40 flex items-center justify-center text-sm text-slate-400">Aucune licence en cours</p>
            )}
          </StatsChartCard>
        </div>
      </div>
    </section>
  );
}
