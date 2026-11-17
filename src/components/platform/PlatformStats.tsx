'use client';

import React, { useId, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus, Table2, BarChart3, UserPlus, KeyRound, Banknote, Repeat, TrendingUp } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, Chip, Label, Meter, Skeleton, Table, ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { StatTile, type StatAccent } from '@/components/ui/StatTile';
import { KpiGrid } from '@/components/ui/KpiGrid';
import { cn } from '@/lib/utils/cn';
import { formatCurrencyFCFA, formatNumber } from '@/lib/utils/format';
import type { PlatformStats, StatsBucket } from '@/lib/platform-stats';
import { amountsHidden } from '@/lib/privacy';
import { CHART_PALETTE, useDarkMode } from '@/components/charts/theme';

export type StatsRange = PlatformStats['range'];

export const STATS_RANGES: { value: StatsRange; label: string }[] = [
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: '90d', label: '3 mois' },
  { value: '6m', label: '6 mois' },
  { value: '1y', label: '12 mois' },
];

// Palette et mode sombre partagés avec les graphiques des Mini Apps Telegram
const PALETTE = CHART_PALETTE;

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

/** Évolution en pastille (Chip du design system) : hausse en vert, baisse en rouge. */
function DeltaChip({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0)
    return (
      <Chip size="sm" variant="soft" color="default">
        <Minus className="size-3" /> Stable
      </Chip>
    );
  if (previous === 0)
    return (
      <Chip size="sm" variant="soft" color="success">
        <ArrowUpRight className="size-3" /> Nouveau
      </Chip>
    );
  const pct = Math.round(((current - previous) / previous) * 100);
  const Icon = pct > 0 ? ArrowUpRight : pct < 0 ? ArrowDownRight : Minus;
  return (
    <Chip size="sm" variant="soft" color={pct > 0 ? 'success' : pct < 0 ? 'danger' : 'default'}>
      <Icon className="size-3" />
      {pct > 0 ? '+' : ''}
      {pct} %
    </Chip>
  );
}

interface LegendItem {
  label: string;
  color: string;
  value?: string;
}

/**
 * Carte de graphique du design system : en-tête (titre, chiffre clé et évolution),
 * bascule Graphique / Chiffres, légende en pastilles avec totaux, graphique ou tableau,
 * pied de carte avec l'information à retenir.
 */
function StatsChartCard({
  title,
  subtitle,
  headline,
  delta,
  legend,
  table,
  footer,
  empty,
  loading,
  children,
}: {
  title: string;
  subtitle: string;
  headline?: string;
  delta?: React.ReactNode;
  legend?: LegendItem[];
  table: React.ReactNode;
  footer?: React.ReactNode;
  /** Message affiché à la place du graphique quand la période ne contient rien */
  empty?: string | null;
  loading?: boolean;
  children: React.ReactNode;
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  return (
    <Card>
      <Card.Header className="flex-row items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <Card.Title className="text-sm font-semibold">{title}</Card.Title>
          {loading ? (
            <Skeleton className="h-8 w-28 rounded-lg" />
          ) : (
            headline !== undefined && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-2xl font-bold tabular-nums text-foreground">{headline}</span>
                {delta}
              </div>
            )
          )}
          <Card.Description className="text-xs">{subtitle}</Card.Description>
        </div>
        <ToggleButtonGroup
          aria-label={`Affichage : ${title}`}
          size="sm"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[view]}
          onSelectionChange={(keys) => {
            const next = [...keys][0];
            if (next) setView(next as 'chart' | 'table');
          }}
          className="shrink-0"
        >
          <ToggleButton id="chart" isIconOnly aria-label="Graphique">
            <BarChart3 className="size-4" />
          </ToggleButton>
          <ToggleButton id="table" isIconOnly aria-label="Voir les chiffres">
            <ToggleButtonGroup.Separator />
            <Table2 className="size-4" />
          </ToggleButton>
        </ToggleButtonGroup>
      </Card.Header>

      <Card.Content className="space-y-3">
        {legend && legend.length > 1 && view === 'chart' && !empty && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Légende">
            {legend.map((l) => (
              <li key={l.label}>
                <Chip size="sm" variant="secondary" color="default">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: l.color }} aria-hidden />
                  <Chip.Label>
                    {l.label}
                    {l.value !== undefined && <span className="ml-1 font-semibold tabular-nums text-foreground">{l.value}</span>}
                  </Chip.Label>
                </Chip>
              </li>
            ))}
          </ul>
        )}
        {loading ? (
          <Skeleton className="h-60 w-full rounded-xl" />
        ) : view === 'table' ? (
          <div className="max-h-72 overflow-auto md-scroll">{table}</div>
        ) : empty ? (
          <div className="flex h-60 flex-col items-center justify-center gap-2 rounded-xl bg-surface-secondary text-center">
            <BarChart3 className="size-6 text-muted" aria-hidden />
            <p className="text-sm text-muted">{empty}</p>
          </div>
        ) : (
          children
        )}
      </Card.Content>

      {footer && !loading && (
        <Card.Footer className="flex items-center gap-1.5 border-t border-separator pt-3 text-xs text-muted">
          <TrendingUp className="size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 truncate">{footer}</span>
        </Card.Footer>
      )}
    </Card>
  );
}

/** Tableau des chiffres (Table du design system), avec ligne de total facultative. */
function DataTable({
  label,
  headers,
  rows,
  total,
}: {
  label: string;
  headers: string[];
  rows: (string | number)[][];
  total?: (string | number)[];
}) {
  const all = total ? [...rows, total] : rows;
  return (
    <Table variant="secondary">
      <Table.ScrollContainer>
        <Table.Content aria-label={label} className="text-xs">
          <Table.Header>
            {headers.map((h, i) => (
              <Table.Column key={h} isRowHeader={i === 0} className={cn(i > 0 && 'text-right')}>
                {h}
              </Table.Column>
            ))}
          </Table.Header>
          <Table.Body>
            {all.map((r, i) => {
              const isTotal = !!total && i === all.length - 1;
              return (
                <Table.Row key={i} className={cn(isTotal && 'font-semibold')}>
                  {r.map((c, j) => (
                    <Table.Cell key={j} className={cn(j > 0 && 'text-right tabular-nums', isTotal && 'text-foreground')}>
                      {c}
                    </Table.Cell>
                  ))}
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

/** Tranche la plus haute d'une série : « Pic : 2 nov. (2) ». */
function peak(series: StatsBucket[], value: (b: StatsBucket) => number, unit: PlatformStats['unit'], fmt: (n: number) => string) {
  let best: StatsBucket | null = null;
  for (const b of series) if (value(b) > 0 && (!best || value(b) > value(best))) best = b;
  return best ? `Pic : ${bucketLabel(best.bucket, unit, true)} (${fmt(value(best))})` : null;
}

/**
 * Segment de barre empilée : le plus haut de chaque barre est arrondi, et un écart de 2 px
 * sépare les segments (sans contour, pour garder toute l'épaisseur de la barre).
 */
function StackSegment(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  payload?: Record<string, number>;
  dataKey?: string;
  keys: readonly string[];
}) {
  const { x = 0, y = 0, width = 0, fill, payload, dataKey, keys } = props;
  let { height = 0 } = props;
  if (!height || height <= 0) return null;
  const present = keys.filter((k) => Number(payload?.[k] || 0) > 0);
  const top = present[present.length - 1];
  const bottom = present[0];
  if (dataKey !== bottom) height = Math.max(0, height - 2);
  if (!height) return null;
  const r = dataKey === top ? Math.min(6, width / 2, height) : 0;
  const d = r
    ? `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`
    : `M${x},${y} h${width} v${height} h${-width} Z`;
  return <path d={d} fill={fill} />;
}

/** Regroupe des jours en semaines (barres plus épaisses sur 30 jours). */
function groupByWeek(series: StatsBucket[]): StatsBucket[] {
  const out: StatsBucket[] = [];
  for (let i = 0; i < series.length; i += 7) {
    const chunk = series.slice(i, i + 7);
    out.push(
      chunk.reduce(
        (acc, b) => ({
          ...acc,
          registrations: acc.registrations + b.registrations,
          trial: acc.trial + b.trial,
          new: acc.new + b.new,
          renewal: acc.renewal + b.renewal,
          upgrade: acc.upgrade + b.upgrade,
          revenue: acc.revenue + b.revenue,
        }),
        { bucket: chunk[0].bucket, registrations: 0, trial: 0, new: 0, renewal: 0, upgrade: 0, revenue: 0 },
      ),
    );
  }
  return out;
}

/** Infobulle d'une courbe cumulée : valeur de la tranche et cumul depuis le début de la période. */
function CumulTooltip({
  active,
  payload,
  label,
  unit,
  field,
  name,
  money,
}: {
  active?: boolean;
  payload?: { payload?: Record<string, number> }[];
  label?: string;
  unit: PlatformStats['unit'];
  field: string;
  name: string;
  money?: boolean;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row || !label) return null;
  const fmt = (n: number) => (money ? formatCurrencyFCFA(n) : formatNumber(n));
  return (
    <div className="min-w-40 space-y-1 rounded-2xl bg-overlay px-3 py-2 text-xs text-overlay-foreground shadow-overlay">
      <p className="font-medium">{bucketLabel(label, unit, true)}</p>
      <p className="flex justify-between gap-3 text-muted">
        {name} <span className="font-medium tabular-nums text-foreground">{fmt(Number(row[field] || 0))}</span>
      </p>
      <p className="flex justify-between gap-3 text-muted">
        Cumul <span className="font-medium tabular-nums text-foreground">{fmt(Number(row.cumul || 0))}</span>
      </p>
    </div>
  );
}

/** Courbe douce (une série) : trait de 2 px, dégradé léger, point au survol. */
function SoftAreaChart({
  data,
  dataKey,
  name,
  color,
  palette,
  xProps,
  yProps,
  tooltip,
}: {
  data: StatsBucket[];
  dataKey: keyof Omit<StatsBucket, 'bucket'>;
  name: string;
  color: string;
  palette: (typeof PALETTE)['light'];
  xProps: Record<string, unknown>;
  yProps: Record<string, unknown>;
  tooltip: React.ReactElement;
}) {
  const id = useId().replace(/:/g, '');
  // Courbe cumulée : croissance régulière, lisible même avec peu de valeurs par jour
  const cumulative = data.reduce<(StatsBucket & { cumul: number })[]>((acc, b) => {
    const prev = acc.length ? acc[acc.length - 1].cumul : 0;
    acc.push({ ...b, cumul: prev + Number(b[dataKey] || 0) });
    return acc;
  }, []);
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={cumulative} margin={{ top: 12, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={palette.grid} strokeDasharray="4 4" />
        <XAxis {...xProps} />
        <YAxis {...yProps} />
        <Tooltip cursor={{ stroke: palette.text, strokeOpacity: 0.35, strokeDasharray: '4 4' }} content={tooltip} />
        <Area
          type="monotone"
          dataKey="cumul"
          name={name}
          stroke={color}
          strokeWidth={2}
          fill={`url(#fill-${id})`}
          dot={false}
          activeDot={{ r: 5, fill: color, stroke: palette.surface, strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
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
  const yProps = { axisLine: false, tickLine: false, tick: axisTick, width: 36, allowDecimals: false, tickCount: 4 };
  const rows = (fn: (b: StatsBucket) => (string | number)[]) => series.map((b) => [bucketLabel(b.bucket, unit, true), ...fn(b)]);
  const totalActive = stats?.active_licenses ?? 0;
  const firstLoad = !stats;
  const sumOf = (key: keyof Omit<StatsBucket, 'bucket'>) => series.reduce((a, b) => a + Number(b[key] || 0), 0);
  const licenceTotals = Object.fromEntries(LICENSE_SERIES.map((s) => [s.key, sumOf(s.key)])) as Record<(typeof LICENSE_SERIES)[number]['key'], number>;
  const licencesTotal = Object.values(licenceTotals).reduce((a, b) => a + b, 0);
  const licencesPrevious = (stats?.previous.paid_licenses ?? 0) + (stats?.previous.trials ?? 0);
  // Abonnements : par semaine quand la période compte trop de jours (barres épaisses)
  const weekly = unit === 'day' && series.length > 14;
  const licSeries = weekly ? groupByWeek(series) : series;
  const licUnit: PlatformStats['unit'] = weekly ? 'week' : unit;
  const licX = { ...xProps, tickFormatter: (v: string) => bucketLabel(v, licUnit), minTickGap: 4 };

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
            headline={formatNumber(stats?.totals.registrations ?? 0)}
            delta={stats && <DeltaChip current={stats.totals.registrations} previous={stats.previous.registrations} />}
            subtitle={`Cumul des comptes créés sur ${rangeLabel}, comparé à la période précédente`}
            loading={firstLoad}
            empty={stats && stats.totals.registrations === 0 ? `Aucune inscription sur ${rangeLabel}` : null}
            footer={peak(series, (b) => b.registrations, unit, (n) => `${formatNumber(n)} inscription${n > 1 ? 's' : ''}`)}
            table={
              <DataTable
                label="Inscriptions par période"
                headers={['Période', 'Inscriptions']}
                rows={rows((b) => [b.registrations])}
                total={['Total', formatNumber(stats?.totals.registrations ?? 0)]}
              />
            }
          >
            <SoftAreaChart
              data={series}
              dataKey="registrations"
              name="Inscriptions"
              color={c.s1}
              palette={c}
              xProps={xProps}
              yProps={yProps}
              tooltip={<CumulTooltip unit={unit} field="registrations" name="Inscriptions" />}
            />
          </StatsChartCard>

          <StatsChartCard
            title="Évolution des abonnements"
            headline={formatNumber(licencesTotal)}
            delta={stats && <DeltaChip current={licencesTotal} previous={licencesPrevious} />}
            subtitle={`Licences activées par type sur ${rangeLabel}${weekly ? ', par semaine' : ''}, essais compris`}
            loading={firstLoad}
            empty={stats && licencesTotal === 0 ? `Aucune licence activée sur ${rangeLabel}` : null}
            legend={LICENSE_SERIES.map((s) => ({ label: s.label, color: c[s.color], value: formatNumber(licenceTotals[s.key]) }))}
            footer={peak(licSeries, (b) => b.new + b.renewal + b.upgrade + b.trial, licUnit, (n) => `${formatNumber(n)} licence${n > 1 ? 's' : ''}`)}
            table={
              <DataTable
                label="Licences activées par période et par type"
                headers={['Période', 'Nouvelles', 'Renouv.', 'Changements', 'Essais']}
                rows={licSeries.map((b) => [bucketLabel(b.bucket, licUnit, true), b.new, b.renewal, b.upgrade, b.trial])}
                total={['Total', ...LICENSE_SERIES.map((s) => formatNumber(licenceTotals[s.key]))]}
              />
            }
          >
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={licSeries} margin={{ top: 12, right: 8, left: -8, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="4 4" />
                <XAxis {...licX} />
                <YAxis {...yProps} />
                <Tooltip cursor={false} content={<ChartTooltip unit={licUnit} />} />
                {LICENSE_SERIES.map((s, i) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    stackId="licences"
                    fill={c[s.color]}
                    maxBarSize={44}
                    // Rail gris clair derrière chaque barre
                    background={i === 0 ? { fill: c.track, radius: 6 } : undefined}
                    shape={(props: unknown) => (
                      <StackSegment {...(props as React.ComponentProps<typeof StackSegment>)} keys={LICENSE_SERIES.map((l) => l.key)} />
                    )}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </StatsChartCard>

          <StatsChartCard
            title="Évolution des revenus"
            headline={formatCurrencyFCFA(stats?.totals.revenue ?? 0)}
            delta={stats && <DeltaChip current={stats.totals.revenue} previous={stats.previous.revenue} />}
            subtitle={`Cumul des factures payées sur ${rangeLabel}, à la date du paiement`}
            loading={firstLoad}
            empty={stats && stats.totals.revenue === 0 ? `Aucun encaissement sur ${rangeLabel}` : null}
            footer={peak(series, (b) => b.revenue, unit, (n) => formatCurrencyFCFA(n))}
            table={
              <DataTable
                label="Revenus par période"
                headers={['Période', 'Revenus']}
                rows={rows((b) => [formatCurrencyFCFA(b.revenue)])}
                total={['Total', formatCurrencyFCFA(stats?.totals.revenue ?? 0)]}
              />
            }
          >
            <SoftAreaChart
              data={series}
              dataKey="revenue"
              name="Revenus"
              color={c.s3}
              palette={c}
              xProps={xProps}
              yProps={{ ...yProps, width: 44, tickFormatter: compactFCFA }}
              tooltip={<CumulTooltip unit={unit} field="revenue" name="Revenus" money />}
            />
          </StatsChartCard>

          <StatsChartCard
            title="Répartition des abonnements"
            headline={formatNumber(totalActive)}
            subtitle="Licences en cours par forfait"
            loading={firstLoad}
            footer={stats ? `Revenu mensuel récurrent : ${formatCurrencyFCFA(stats.mrr)}` : null}
            table={
              <DataTable
                label="Licences en cours par forfait"
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
                    <li key={p.plan_id} className="space-y-1">
                      {/* Part du forfait : jauge Meter du design system */}
                      <Meter
                        value={p.count}
                        maxValue={Math.max(totalActive, 1)}
                        color="accent"
                        valueLabel={`${p.count} · ${pct} %`}
                        aria-label={`${p.name} : ${p.count} licence${p.count > 1 ? 's' : ''}, ${pct} %`}
                      >
                        <Label className="flex min-w-0 items-center gap-1.5 truncate font-medium text-foreground">
                          {p.name}
                          {p.is_trial && (
                            <Chip size="sm" variant="soft" color="default">
                              Essai
                            </Chip>
                          )}
                        </Label>
                        <Meter.Output className="tabular-nums font-semibold text-foreground" />
                        <Meter.Track>
                          <Meter.Fill />
                        </Meter.Track>
                      </Meter>
                      {!p.is_trial && <p className="text-xs text-muted tabular-nums">{formatCurrencyFCFA(p.mrr)} / mois</p>}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex h-60 flex-col items-center justify-center gap-2 rounded-xl bg-surface-secondary text-center">
                <KeyRound className="size-6 text-muted" aria-hidden />
                <p className="text-sm text-muted">Aucune licence en cours</p>
              </div>
            )}
          </StatsChartCard>
        </div>
      </div>
    </section>
  );
}
