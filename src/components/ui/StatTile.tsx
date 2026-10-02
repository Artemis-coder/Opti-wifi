import React from 'react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils/cn';

export type StatTileTone = 'brand' | 'emerald' | 'red' | 'blue' | 'blueDark' | 'purple';

const TONES: Record<StatTileTone, { border: string; chip: string }> = {
  brand: { border: 'border-l-brand-500', chip: 'bg-brand-500/10 text-brand-600 dark:text-brand-400' },
  emerald: { border: 'border-l-emerald-500', chip: 'bg-emerald-500/10 text-emerald-600' },
  red: { border: 'border-l-red-500', chip: 'bg-red-500/10 text-red-600' },
  blue: { border: 'border-l-blue-500', chip: 'bg-blue-500/10 text-blue-600' },
  blueDark: { border: 'border-l-blue-900', chip: 'bg-blue-900/10 text-blue-900 dark:text-blue-400' },
  purple: { border: 'border-l-purple-500', chip: 'bg-purple-500/10 text-purple-600' },
};

export interface StatTileProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  tone?: StatTileTone;
  valueClassName?: string;
  className?: string;
}

/**
 * Tuile de chiffre cle, concue pour une grille de 2 colonnes sur mobile.
 *
 * La valeur passe avant le libelle pour que les chiffres restent alignes sur
 * la meme ligne de base quelle que soit la longueur du libelle. Le bloc valeur
 * reserve la hauteur de deux lignes (text-xl au telephone, text-2xl au-dela de
 * sm) : un montant long comme "4 250 000 F CFA" passe a la ligne au lieu de
 * deborder de la carte et de pousser l'icone hors du cadre, tout en gardant
 * les libelles alignes entre tuiles. La precision est plaquee en bas (mt-auto).
 */
export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'brand',
  valueClassName,
  className,
}: StatTileProps) {
  const t = TONES[tone] ?? TONES.brand;
  return (
    <Card className={cn('flex flex-col', t.border, className)}>
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            'text-xl sm:text-2xl font-extrabold leading-tight min-w-0 break-words',
            'min-h-[3.125rem] sm:min-h-[3.75rem]',
            valueClassName ?? 'text-slate-900 dark:text-white'
          )}
        >
          {value}
        </p>
        <div className={cn('p-2 rounded-lg shrink-0', t.chip)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide mt-3">
        {label}
      </p>
      {hint && <p className="text-[11px] text-slate-500 mt-auto pt-1">{hint}</p>}
    </Card>
  );
}
