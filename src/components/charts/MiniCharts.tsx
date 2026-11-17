'use client';

/**
 * Graphiques compacts (Mini Apps Telegram) : barres, barres empilées, courbe en aire et anneau,
 * avec la palette du tableau de bord (components/charts/theme).
 */
import React, { useId } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@heroui/react';
import { useChartColors, type ChartColors } from '@/components/charts/theme';

export type SeriesColor = 's1' | 's2' | 's3' | 's4' | 'danger';

export interface ChartSeries {
  key: string;
  label: string;
  color: SeriesColor;
}

const axis = (c: ChartColors) => ({
  tick: { fill: c.text, fontSize: 11 },
  tickLine: false,
  axisLine: false,
});

function tooltipStyle(c: ChartColors) {
  return {
    contentStyle: { background: c.surface, border: `1px solid ${c.grid}`, borderRadius: 12, fontSize: 12 },
    labelStyle: { color: c.text },
    cursor: { fill: c.track },
  };
}

/** Carte de graphique : titre, chiffre principal, sous-titre, légende. */
export function ChartPanel({
  title,
  headline,
  subtitle,
  legend,
  children,
}: {
  title: string;
  headline?: React.ReactNode;
  subtitle?: string;
  legend?: { label: string; color: SeriesColor; value?: React.ReactNode }[];
  children: React.ReactNode;
}) {
  const c = useChartColors();
  return (
    <Card>
      <Card.Header>
        <Card.Description>{title}</Card.Description>
        {headline !== undefined && <Card.Title className="text-xl">{headline}</Card.Title>}
        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
      </Card.Header>
      <Card.Content className="flex flex-col gap-3">
        {legend && (
          <ul className="flex flex-wrap gap-x-3 gap-y-1" aria-label="Légende">
            {legend.map((l) => (
              <li key={l.label} className="flex items-center gap-1.5 text-xs text-muted">
                <span className="size-2.5 rounded-full" style={{ background: c[l.color] }} aria-hidden />
                {l.label}
                {l.value !== undefined && <span className="font-medium text-foreground">{l.value}</span>}
              </li>
            ))}
          </ul>
        )}
        {children}
      </Card.Content>
    </Card>
  );
}

/** Barres (empilées si plusieurs séries). */
export function MiniBarChart({
  data,
  xKey,
  series,
  height = 180,
  format,
  layout = 'vertical-bars',
}: {
  data: object[];
  xKey: string;
  series: ChartSeries[];
  height?: number;
  format?: (v: number) => string;
  /** horizontal = libellés à gauche (classements) */
  layout?: 'vertical-bars' | 'horizontal';
}) {
  const c = useChartColors();
  const horizontal = layout === 'horizontal';
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 4, right: 8, bottom: 0, left: horizontal ? 8 : -16 }}>
          <CartesianGrid vertical={horizontal} horizontal={!horizontal} stroke={c.grid} strokeDasharray="4 4" />
          {horizontal ? (
            <>
              <XAxis type="number" {...axis(c)} tickFormatter={format} allowDecimals={false} />
              <YAxis type="category" dataKey={xKey} {...axis(c)} width={96} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} {...axis(c)} interval="preserveStartEnd" minTickGap={12} />
              <YAxis {...axis(c)} tickFormatter={format} allowDecimals={false} width={44} />
            </>
          )}
          <Tooltip {...tooltipStyle(c)} formatter={(v) => (format ? format(Number(v)) : String(v))} />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId={series.length > 1 ? 'stack' : undefined}
              fill={c[s.color]}
              radius={i === series.length - 1 ? (horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]) : 0}
              maxBarSize={28}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Courbe en aire (tendance). */
export function MiniAreaChart({
  data,
  xKey,
  series,
  height = 180,
  format,
}: {
  data: object[];
  xKey: string;
  series: ChartSeries[];
  height?: number;
  format?: (v: number) => string;
}) {
  const c = useChartColors();
  const id = useId().replace(/:/g, '');
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`${id}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c[s.color]} stopOpacity={0.35} />
                <stop offset="100%" stopColor={c[s.color]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="4 4" />
          <XAxis dataKey={xKey} {...axis(c)} interval="preserveStartEnd" minTickGap={16} />
          <YAxis {...axis(c)} tickFormatter={format} allowDecimals={false} width={44} />
          <Tooltip {...tooltipStyle(c)} formatter={(v) => (format ? format(Number(v)) : String(v))} />
          {series.map((s) => (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={c[s.color]} strokeWidth={2} fill={`url(#${id}-${s.key})`} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Anneau de répartition. */
export function MiniDonut({ data, height = 160 }: { data: { label: string; value: number; color: SeriesColor }[]; height?: number }) {
  const c = useChartColors();
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <div style={{ height }} className="relative w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={total ? data : [{ label: '—', value: 1, color: 's1' }]} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="90%" paddingAngle={total ? 2 : 0} stroke="none">
            {(total ? data : [{ label: '—', value: 1, color: 's1' as SeriesColor }]).map((d) => (
              <Cell key={d.label} fill={total ? c[d.color] : c.track} />
            ))}
          </Pie>
          {total > 0 && <Tooltip {...tooltipStyle(c)} />}
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold text-foreground">{total}</span>
        <span className="text-[11px] text-muted">au total</span>
      </div>
    </div>
  );
}

/** Libellé court d'un jour (« 17/11 »). */
export function dayLabel(date: string | Date): string {
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'Africa/Abidjan' });
}
