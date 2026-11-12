'use client';

import React, { useState } from 'react';
import { ArrowDown, ArrowUp, BarChart3, LineChart as LineIcon } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils/cn';
import { formatAmountShort } from '@/lib/utils/format';

const money = formatAmountShort;

/** « 2026-10 » → « oct. 26 » (axe) ou « octobre 2026 » (texte) */
function monthText(month: string, style: 'short' | 'long'): string {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, 1));
  return style === 'short'
    ? new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(date)
    : new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

/** Mois consécutifs du premier au dernier (les mois sans commission valent 0). */
function fillMonths(months: { month: string; total: number; count: number }[]) {
  if (months.length === 0) return [];
  const byMonth = new Map(months.map((m) => [m.month, m]));
  const sorted = [...months].map((m) => m.month).sort();
  const [fy, fm] = sorted[0].split('-').map(Number);
  const [ly, lm] = sorted[sorted.length - 1].split('-').map(Number);
  const out: { month: string; total: number; count: number }[] = [];
  for (let y = fy, m = fm; y < ly || (y === ly && m <= lm); m === 12 ? ((m = 1), y++) : m++) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    out.push(byMonth.get(key) ?? { month: key, total: 0, count: 0 });
  }
  return out;
}

type Point = { month: string; total: number; count: number; tag: 'peak' | 'low' | null };

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg px-3 py-2 text-xs space-y-1 min-w-36">
      <p className="font-bold text-slate-900 dark:text-white first-letter:uppercase">{monthText(p.month, 'long')}</p>
      <p className="flex justify-between gap-3 text-slate-600 dark:text-slate-300">
        Commissions <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{money(p.total)}</span>
      </p>
      <p className="flex justify-between gap-3 text-slate-600 dark:text-slate-300">
        Collectes <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{p.count}</span>
      </p>
      {p.tag && (
        <p className="font-semibold text-slate-700 dark:text-slate-200">{p.tag === 'peak' ? '▲ Pic de la période' : '▼ Mois le plus bas'}</p>
      )}
    </div>
  );
}

/** Étiquette directe, seulement sur le pic et le mois le plus bas (texte en encre, jamais en couleur de série). */
function TagLabel(props: { x?: number | string; y?: number | string; width?: number | string; index?: number; points: Point[] }) {
  const { x = 0, y = 0, width = 0, index = -1, points } = props;
  const point = points[index];
  if (!point?.tag) return null;
  const cx = Number(x) + Number(width) / 2;
  return (
    <text x={cx} y={Number(y) - 8} textAnchor="middle" className="fill-slate-700 dark:fill-slate-200" fontSize={11} fontWeight={700}>
      {point.tag === 'peak' ? '▲ Pic' : '▼ Plus bas'}
    </text>
  );
}

/** Commissions par mois : barres ou courbe, avec le pic et le mois le plus bas mis en évidence. */
export function CommissionsChart({ months }: { months: { month: string; total: number; count: number }[] }) {
  const [mode, setMode] = useState<'bar' | 'line'>('bar');
  const filled = fillMonths(months);
  const totals = filled.map((m) => m.total);
  const max = Math.max(...totals);
  const min = Math.min(...totals);
  // Un seul mois, ou tous égaux : pas de « plus bas » à signaler
  const distinct = filled.length > 1 && max !== min;
  const peakIndex = totals.indexOf(max);
  const lowIndex = distinct ? totals.lastIndexOf(min) : -1;
  const points: Point[] = filled.map((m, i) => ({ ...m, tag: i === peakIndex ? 'peak' : i === lowIndex ? 'low' : null }));
  const peak = points[peakIndex];
  const low = lowIndex >= 0 ? points[lowIndex] : null;

  const axis = {
    x: (
      <XAxis
        dataKey="month"
        axisLine={false}
        tickLine={false}
        interval="preserveStartEnd"
        tick={{ fontSize: 11, fill: '#64748b' }}
        tickFormatter={(v: string) => monthText(v, 'short')}
      />
    ),
    y: (
      <YAxis
        axisLine={false}
        tickLine={false}
        width={72}
        tick={{ fontSize: 11, fill: '#64748b' }}
        tickFormatter={(v: number) => money(v)}
      />
    ),
    grid: <CartesianGrid vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeDasharray="3 3" />,
  };

  return (
    <Card className="p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">Mes commissions par mois</h2>
        {/* Choix de l'affichage */}
        <div role="group" aria-label="Type de graphique" className="inline-flex rounded-full border border-slate-200 dark:border-slate-700 p-0.5">
          {(
            [
              { value: 'bar', label: 'Barres', icon: BarChart3 },
              { value: 'line', label: 'Courbe', icon: LineIcon },
            ] as const
          ).map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={mode === o.value}
              onClick={() => setMode(o.value)}
              className={cn(
                'inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold transition',
                mode === o.value
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
              )}
            >
              <o.icon className="w-3.5 h-3.5" /> {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Couleur de la série : vert de la marque, une teinte par mode (validée contre la surface) */}
      <div className="h-64 text-[#3f9a4c] dark:text-[#4fa35b] [&_*:focus]:outline-none [&_*:focus-visible]:outline-none">
        <ResponsiveContainer width="100%" height="100%">
          {mode === 'bar' ? (
            <BarChart data={points} margin={{ top: 22, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
              {axis.grid}
              {axis.x}
              {axis.y}
              <Tooltip cursor={{ fill: 'rgba(100,116,139,0.08)' }} content={<ChartTooltip />} />
              <Bar dataKey="total" fill="currentColor" radius={[4, 4, 0, 0]} maxBarSize={48}>
                <LabelList dataKey="total" content={(p) => <TagLabel {...(p as object)} points={points} />} />
              </Bar>
            </BarChart>
          ) : (
            <LineChart data={points} margin={{ top: 22, right: 32, left: 0, bottom: 0 }}>
              {axis.grid}
              {axis.x}
              {axis.y}
              <Tooltip cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }} content={<ChartTooltip />} />
              <Line
                type="monotone"
                dataKey="total"
                stroke="currentColor"
                strokeWidth={2}
                // Points visibles seulement sur le pic et le mois le plus bas, entourés de la couleur du fond
                dot={(d: { cx?: number; cy?: number; index?: number }) =>
                  points[d.index ?? -1]?.tag ? (
                    <circle key={d.index} cx={d.cx} cy={d.cy} r={5} fill="currentColor" stroke="white" strokeWidth={2} className="dark:stroke-slate-900" />
                  ) : (
                    <g key={d.index} />
                  )
                }
                activeDot={{ r: 5, strokeWidth: 2, stroke: 'white' }}
              >
                <LabelList dataKey="total" content={(p) => <TagLabel {...(p as object)} points={points} />} />
              </Line>
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Pic et mois le plus bas, en clair */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
        {peak && (
          <p className="flex items-center gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
            <ArrowUp className="w-4 h-4 text-slate-500" />
            <span className="text-slate-500">Pic :</span>
            <span className="inline-block font-semibold text-slate-900 dark:text-white first-letter:uppercase">{monthText(peak.month, 'long')}</span>
            <span className="ml-auto font-bold tabular-nums text-slate-900 dark:text-white">{money(peak.total)}</span>
          </p>
        )}
        {low && (
          <p className="flex items-center gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
            <ArrowDown className="w-4 h-4 text-slate-500" />
            <span className="text-slate-500">Plus bas :</span>
            <span className="inline-block font-semibold text-slate-900 dark:text-white first-letter:uppercase">{monthText(low.month, 'long')}</span>
            <span className="ml-auto font-bold tabular-nums text-slate-900 dark:text-white">{money(low.total)}</span>
          </p>
        )}
      </div>
    </Card>
  );
}
