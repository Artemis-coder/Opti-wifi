import React from 'react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils/cn';

export interface KpiTile {
  label: string;
  value: string;
  sub?: string;
  /** Mise en avant (chiffre principal) */
  highlight?: boolean;
}

/** Rangée de chiffres clés du back-office : 2 colonnes sur mobile, 4 sur ordinateur. */
export function KpiTiles({ tiles, loading }: { tiles: KpiTile[]; loading?: boolean }) {
  return (
    <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-3 transition-opacity', loading && 'opacity-50')}>
      {tiles.map((t) => (
        <Card key={t.label} className={cn('p-4 space-y-1', t.highlight && 'border-l-4 border-l-emerald-500')}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t.label}</p>
          <p className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">{t.value}</p>
          {t.sub && <p className="text-xs text-slate-500">{t.sub}</p>}
        </Card>
      ))}
    </div>
  );
}
