import React from 'react';
import { StatTile, type StatAccent } from '@/components/ui/StatTile';
import { KpiGrid } from '@/components/ui/KpiGrid';
import { cn } from '@/lib/utils/cn';

export interface KpiTile {
  label: string;
  value: string;
  sub?: string;
  /** Mise en avant (chiffre principal) */
  highlight?: boolean;
  icon?: React.ElementType;
  accent?: StatAccent;
}

/** Rangée de chiffres clés du back-office (cadres StatTile) : 2 colonnes sur mobile, 4 sur ordinateur. */
export function KpiTiles({ tiles, loading }: { tiles: KpiTile[]; loading?: boolean }) {
  return (
    <KpiGrid cols={{ base: 2, lg: 4 }} className={cn('transition-opacity', loading && 'opacity-50')}>
      {tiles.map((t) => (
        <StatTile
          key={t.label}
          label={t.label}
          value={t.value}
          hint={t.sub}
          icon={t.icon}
          accent={t.accent ?? (t.highlight ? 'emerald' : 'slate')}
        />
      ))}
    </KpiGrid>
  );
}
