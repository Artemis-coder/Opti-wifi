import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { buttonVariants } from '@heroui/styles';
import { cn } from '@/lib/utils/cn';

/**
 * Variantes sémantiques HeroUI (docs/design/HEROUI_DESIGN.md) :
 * primary = action principale (1 par contexte), secondary = alternative,
 * outline / ghost = faible emphase, danger = destructif, danger-soft = destructif discret.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'outline' | 'danger' | 'danger-soft' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  /** Icône avant le libellé (taille et espacement standard du design system) */
  icon?: LucideIcon;
  /** Bouton carré avec une icône seule (variante HeroUI isIconOnly) : pensez à aria-label */
  isIconOnly?: boolean;
}

/**
 * Classes d'un bouton HeroUI, réutilisables sur un lien (<Link className={buttonClassName()}>).
 */
export function buttonClassName({
  variant = 'primary',
  size = 'md',
  isIconOnly,
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; isIconOnly?: boolean; className?: string } = {}) {
  return cn(buttonVariants({ variant, size, isIconOnly }), className);
}

/**
 * Bouton natif au style HeroUI. Garde l'API historique (onClick, disabled, isLoading)
 * pour que toutes les pages existantes en profitent sans changement.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, icon: Icon, isIconOnly, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        className={buttonClassName({ variant, size, isIconOnly, className })}
        {...props}
      >
        {isLoading ? (
          <>
            <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />
            <span>Chargement…</span>
          </>
        ) : (
          <>
            {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
            {children}
          </>
        )}
      </button>
    );
  },
);
Button.displayName = 'Button';
