'use client';

import React, { useSyncExternalStore } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { applyAmountsHidden } from '@/lib/privacy';
import { usePrivacyStore } from '@/lib/stores/privacyStore';
import { cn } from '@/lib/utils/cn';

const noop = () => () => {};
/** Vrai une fois dans le navigateur (après l'hydratation) */
const useIsClient = () => useSyncExternalStore(noop, () => true, () => false);

/**
 * Applique le masquage des montants au contenu de la page. Au changement, le contenu est
 * réaffiché pour que tous les montants (cartes, tableaux, graphiques) suivent d'un coup.
 */
export function AmountsPrivacyBoundary({ children }: { children: React.ReactNode }) {
  const hideAmounts = usePrivacyStore((s) => s.hideAmounts);
  const active = useIsClient() && hideAmounts;
  // Lu par formatCurrencyFCFA pendant l'affichage des pages
  applyAmountsHidden(active);
  return <React.Fragment key={active ? 'amounts-hidden' : 'amounts-shown'}>{children}</React.Fragment>;
}

/** Bouton œil : masquer / afficher tous les montants de l'application */
export function AmountsToggle({
  className,
  withLabel = false,
  size = 'md',
}: {
  className?: string;
  withLabel?: boolean;
  /** sm : dans une carte de chiffre clé */
  size?: 'sm' | 'md';
}) {
  const hideAmounts = usePrivacyStore((s) => s.hideAmounts);
  const toggle = usePrivacyStore((s) => s.toggleAmounts);
  const hidden = useIsClient() && hideAmounts;
  const label = hidden ? 'Afficher les montants' : 'Masquer les montants';
  const Icon = hidden ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={(e) => {
        // Dans une carte cliquable : ne pas ouvrir le lien
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }}
      aria-pressed={hidden}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-xl transition-colors',
        withLabel ? 'h-9 px-3 text-xs font-semibold' : size === 'sm' ? 'w-7 h-7 rounded-lg' : 'w-10 h-10',
        hidden
          ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800',
        className
      )}
    >
      <Icon className={cn('shrink-0', size === 'sm' ? 'w-4 h-4' : 'w-5 h-5')} />
      {withLabel && <span className="whitespace-nowrap">{hidden ? 'Montants masqués' : 'Masquer les montants'}</span>}
    </button>
  );
}
