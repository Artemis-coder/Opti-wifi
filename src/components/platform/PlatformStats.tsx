'use client';

import React, { useState, useSyncExternalStore } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus, Table2, BarChart3, UserPlus, KeyRound, Banknote, Repeat } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button, Card, ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { StatTile, type StatAccent } from '@/components/ui/StatTile';
import { KpiGrid } from '@/components/ui/KpiGrid';
import { cn } from '@/lib/utils/cn';
import { formatCurrencyFCFA, formatNumber } from '@/lib/utils/format';
import type { PlatformStats, StatsBucket } from '@/lib/platform-stats';
import { amountsHidden } from '@/lib/privacy';

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
  light: { s1: '#2a78d6', s2: '#eb6834', s3: '#1baf7a', s4: '#eda100', surface: '#ffffff', grid: '#e4e4e7', text: '#71717a' },
  dark: { s1: '#3987e5', s2: '#d95926', s3: '#199e70', s4: '#c98500', surface: '#18181b', grid: '#27272a', text: '#a1a1aa' },
};

const darkQuery = '(prefers-color-scheme: dark)';
function subscribeDark(cb: () => void) {
  const mq = window.matchMedia(darkQuery);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}
/** L'application suit le thème du système (data-theme posé par le layout racine) */
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
  if (amountsHidden()) return '•••';
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k`;
  return String(n);
}

/** Évolution par rapport à la période précédente de même durée */
function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return <span className="text-xs text-muted">Stable</span>;
  if (previous === 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-success">
        <ArrowUpRight className="w-3.5 h-3.5" /> Nouveau
      </span>
    );
  const pct = Math.round(((current - previous) / previous) * 100);
  const Icon = pct > 0 ? ArrowUpRight : pct < 0 ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium',
        pct > 0 ? 'text-success' : pct < 0 ? 'text-danger' : 'text-muted',
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
          {sub && <span className="text-xs text-muted">{sub}</span>}
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
    <div className="space-y-5 min-w-36 rounded-2xl bg-overlay px-3 py-2 text-xs text-overlay-foreground shadow-overlay">
      <p className="font-medium first-letter:">{bucketLabel(label, unit, true)}</p>
      {payload
        .slice()
        .reverse()
        .map((p) => (
          <p key={String(p.dataKey)} className="flex items-center justify-between gap-3 text-muted">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="font-medium tabular-nums text-foreground">
              {money ? formatCurrencyFCFA(Number(p.value)) : formatNumber(Number(p.value))}
            </span>
          </p>
        ))}
      {payload.length > 1 && (
        <p className="flex justify-between gap-3 border-t border-separator pt-1 text-muted">
          Total <span className="font-medium tabular-nums text-foreground">{money ? formatCurrencyFCFA(total) : formatNumber(total)}</span>
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
    <Card>
      <Card.Header className="flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <Card.Title className="text-base font-semibold">{title}</Card.Title>
          <Card.Description className="text-xs">{subtitle}</Card.Description>
        </div>
        <Button size="sm" variant="secondary" className="shrink-0" onPress={() => setShowTable((v) => !v)} aria-pressed={showTable}>
          {showTable ? <BarChart3 className="size-4" /> : <Table2 className="size-4" />}
          {showTable ? 'Graphique' : 'Voir les chiffres'}
        </Button>
      </Card.Header>
      {legend && legend.length > 1 && !showTable && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-1.5 text-xs text-muted">
              <span className="size-2.5 rounded-full" style={{ background: l.color }} />
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
      <thead className="sticky top-0 bg-surface">
        <tr className="border-b border-separator text-left text-muted">
          {headers.map((h, i) => (
            <th key={h} className={cn('py-2 font-medium', i > 0 && 'text-right')}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-separator">
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td
                key={j}
                className={cn(
                  'py-1.5 text-foreground',
                  j > 0 && 'text-right tabular-nums',
                  j === 0 && 'first-letter:',
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
          <h2 id="stats-title" className="text-lg font-semibold text-foreground">
            Statistiques
          </h2>
          <p className="text-sm text-muted">Comparées à la période précédente de même durée.</p>
        </div>
        {/* Filtre de période : une seule rangée, défilable sur mobile */}
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <ToggleButtonGroup
            aria-label="Période"
            size="sm"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[range]}
            onSelectionChange={(keys) => {
              const next = [...keys][0];
              if (next) onRangeChange(next as StatsRange);
            }}
          >
            {STATS_RANGES.map((r, i) => (
              <ToggleButton key={r.value} id={r.value} className="shrink-0">
                {i > 0 && <ToggleButtonGroup.Separator />}
                {r.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </div>
      </div>

      <div className={cn('space-y-4 transition-opacity', loading && 'opacity-60')}>
        {/* Chiffres clés */}
        <KpiGrid cols={{ base: 2, lg: 4 }}>
          <StatsTile
            label="Inscriptions"
            icon={UserPlus}
            accent="indigo"
            value={formatNumber(stats?.alltime.registrations ?? 0)}
            sub={`Comptes clients au total · ${formatNumber(stats?.totals.registrations ?? 0)} sur ${rangeLabel}`}
            delta={stats && <Delta current={stats.totals.registrations} previous={stats.previous.registrations} />}
          />
          <StatsTile
            label="Licences vendues"
            icon={KeyRound}
            accent="amber"
            value={formatNumber(stats?.alltime.paid_licenses ?? 0)}
            sub={`Payées et facturées · ${formatNumber(stats?.totals.paid_licenses ?? 0)} sur ${rangeLabel} · ${stats?.alltime.trials ?? 0} essai${(stats?.alltime.trials ?? 0) > 1 ? 's' : ''} gratuit${(stats?.alltime.trials ?? 0) > 1 ? 's' : ''} en plus`}
            delta={stats && <Delta current={stats.totals.paid_licenses} previous={stats.previous.paid_licenses} />}
          />
          <StatsTile
            label="Revenus encaissés"
            icon={Banknote}
            accent="emerald"
            value={formatCurrencyFCFA(stats?.alltime.revenue ?? 0)}
            sub={`En ligne + manuel, au total · ${formatCurrencyFCFA(stats?.totals.revenue ?? 0)} sur ${rangeLabel}`}
            delta={stats && <Delta current={stats.totals.revenue} previous={stats.previous.revenue} />}
          />
          <StatsTile
            label="Revenu mensuel récurrent"
            icon={Repeat}
            accent="purple"
            value={formatCurrencyFCFA(stats?.mrr ?? 0)}
            sub={`${totalActive} licence${totalActive > 1 ? 's' : ''} en cours`}
          />
        </KpiGrid>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
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
            subtitle={`Montants des factures payées, à la date du paiement · ${formatCurrencyFCFA(stats?.totals.revenue ?? 0)}`}
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
                        <span className="truncate font-medium text-foreground">
                          {p.name}
                          {p.is_trial && <span className="ml-1.5 text-xs text-muted">(essai)</span>}
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums text-foreground">
                          {p.count} <span className="font-normal text-muted">· {pct} %</span>
                        </span>
                      </div>
                      <div
                        className="h-2.5 overflow-hidden rounded-full bg-default"
                        role="img"
                        aria-label={`${p.name} : ${p.count} licence${p.count > 1 ? 's' : ''}, ${pct} %`}
                      >
                        <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 2)}%`, background: c.s1 }} />
                      </div>
                      {!p.is_trial && <p className="text-xs text-muted">{formatCurrencyFCFA(p.mrr)} / mois</p>}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="flex h-40 items-center justify-center text-sm text-muted">Aucune licence en cours</p>
            )}
          </StatsChartCard>
        </div>
      </div>
    </section>
  );
}
