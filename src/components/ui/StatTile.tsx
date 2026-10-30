import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

export type StatAccent = 'amber' | 'indigo' | 'emerald' | 'red' | 'purple' | 'blue' | 'slate';

const ACCENTS: Record<StatAccent, { border: string; icon: string }> = {
  amber: { border: 'border-l-amber-500', icon: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  indigo: { border: 'border-l-indigo-900 dark:border-l-indigo-400', icon: 'bg-indigo-900/10 text-indigo-900 dark:text-indigo-300' },
  emerald: { border: 'border-l-emerald-500', icon: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  red: { border: 'border-l-red-500', icon: 'bg-red-500/10 text-red-600 dark:text-red-400' },
  purple: { border: 'border-l-purple-500', icon: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  blue: { border: 'border-l-blue-500', icon: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  slate: { border: 'border-l-slate-400', icon: 'bg-slate-500/10 text-slate-600 dark:text-slate-300' },
};

export interface StatTileProps {
  /** Libellé en petites capitales (ex. « Tickets vendus ») */
  label: string;
  value: React.ReactNode;
  icon?: React.ElementType;
  accent?: StatAccent;
  /** Mise en alerte : fond et chiffre rouges (ex. écart de caisse négatif) */
  alert?: boolean;
  /** Ligne sous le chiffre : texte simple… */
  hint?: React.ReactNode;
  /** …ou contenu libre (évolution, badge) */
  footer?: React.ReactNode;
  /** Carte cliquable vers une page de détail */
  href?: string;
  className?: string;
}

/**
 * Cadre de chiffre clé du design system (tableau de bord client) : bordure gauche colorée,
 * libellé, icône dans un carré teinté, grand chiffre et ligne d'information.
 * À utiliser pour tous les KPI de l'application.
 */
export function StatTile({ label, value, icon: Icon, accent = 'slate', alert, hint, footer, href, className }: StatTileProps) {
  const a = ACCENTS[accent];
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
        {Icon && (
          <span className={cn('w-8 h-8 shrink-0 rounded-lg flex items-center justify-center', alert ? ACCENTS.red.icon : a.icon)}>
            <Icon className="w-4 h-4" />
          </span>
        )}
      </div>
      <div
        className={cn(
          'text-xl sm:text-2xl font-extrabold tabular-nums break-words',
          alert ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'
        )}
      >
        {value}
      </div>
      {footer ?? (hint !== undefined && hint !== null && <p className={cn('text-[11px]', alert ? 'text-red-600/80 dark:text-red-400/80' : 'text-slate-400')}>{hint}</p>)}
    </>
  );
  const classes = cn(
    'block rounded-2xl border border-l-4 p-4 sm:p-5 space-y-2 shadow-xs',
    alert ? 'border-l-red-500' : a.border,
    alert ? 'bg-red-50/70 dark:bg-red-950/20 border-red-200 dark:border-red-900/50' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800',
    href && 'transition hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700',
    className
  );
  return href ? (
    <Link href={href} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}
