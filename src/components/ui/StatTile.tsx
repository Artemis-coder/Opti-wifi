import React from 'react';
import Link from 'next/link';
import { cardVariants } from '@heroui/styles';
import { cn } from '@/lib/utils/cn';
import { AmountsToggle } from '@/components/privacy/AmountsPrivacy';
import { FitText } from '@/components/ui/FitText';

/** Valeur qui est un montant (« 1 418 000 F », « 25 000 FCFA » ou déjà masquée) */
function looksLikeAmount(value: React.ReactNode): boolean {
  return typeof value === 'string' && /(F\s?CFA|\sF)$|•{3,}/.test(value.trim());
}

export type StatAccent = 'amber' | 'indigo' | 'emerald' | 'red' | 'purple' | 'blue' | 'slate';

/**
 * Teinte de l'icône. HeroUI réserve les couleurs d'état à leur sens :
 * amber = attention, emerald = positif, red = problème ; les autres restent neutres
 * (indigo / blue = accent de marque, purple / slate = neutre).
 */
const ICON_TONE: Record<StatAccent, string> = {
  amber: 'bg-warning-soft text-warning-soft-foreground',
  emerald: 'bg-success-soft text-success-soft-foreground',
  red: 'bg-danger-soft text-danger-soft-foreground',
  indigo: 'bg-accent-soft text-accent-soft-foreground',
  blue: 'bg-accent-soft text-accent-soft-foreground',
  purple: 'bg-default text-default-foreground',
  slate: 'bg-default text-default-foreground',
};

export interface StatTileProps {
  /** Libellé (ex. « Tickets vendus ») */
  label: string;
  value: React.ReactNode;
  icon?: React.ElementType;
  accent?: StatAccent;
  /** Mise en alerte : chiffre et icône en rouge (ex. écart de caisse négatif) */
  alert?: boolean;
  /** Ligne sous le chiffre : texte simple… */
  hint?: React.ReactNode;
  /** …ou contenu libre (évolution, badge) */
  footer?: React.ReactNode;
  /** Carte cliquable vers une page de détail */
  href?: string;
  /** Montant : œil pour masquer tous les montants (détecté automatiquement pour un texte en F / FCFA) */
  sensitive?: boolean;
  className?: string;
}

/**
 * Chiffre clé du design system (HeroUI Card) : libellé, icône teintée, grand chiffre
 * et ligne d'information. À utiliser pour tous les KPI de l'application.
 */
export function StatTile({ label, value, icon: Icon, accent = 'slate', alert, hint, footer, href, className, sensitive }: StatTileProps) {
  const isAmount = sensitive ?? looksLikeAmount(value);
  // Chiffre ou montant : toujours sur une ligne, réduit si la carte est étroite (jamais de débordement)
  const fits = isAmount || typeof value === 'number' || (typeof value === 'string' && /^[\s\d+\-−.,%•/]+[A-Za-z%]{0,6}$/.test(value.trim()));
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <p className="text-sm text-muted">{label}</p>
          {isAmount && <AmountsToggle size="sm" className="-my-1" />}
        </div>
        {Icon && (
          <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', alert ? ICON_TONE.red : ICON_TONE[accent])}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <div
        className={cn(
          'min-w-0 text-2xl font-bold tabular-nums tracking-tight',
          !fits && 'break-words',
          alert ? 'text-danger' : 'text-foreground'
        )}
      >
        {fits ? <FitText>{value}</FitText> : value}
      </div>
      {footer ?? (hint !== undefined && hint !== null && <p className={cn('text-xs', alert ? 'text-danger' : 'text-muted')}>{hint}</p>)}
    </>
  );
  const classes = cn(
    cardVariants({ variant: 'default' }).base(),
    // min-w-0 : la carte rétrécit avec sa colonne de grille au lieu de s'élargir au texte
    'min-w-0 gap-2',
    alert && 'ring-1 ring-danger/40',
    href &&
      'outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background',
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
