import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  /** Icône avant le libellé (taille et espacement standard du design system) */
  icon?: LucideIcon;
}

/**
 * Classes d'un bouton du design system, réutilisables sur un lien (<Link className={buttonClassName()}>).
 */
export function buttonClassName({
  variant = 'primary',
  size = 'md',
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  const baseStyles =
    'md-ripple inline-flex items-center justify-center gap-2 font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

  const variants = {
    primary: 'bg-brand-500 text-brand-on hover:bg-brand-600 md-elevation-1',
    secondary: 'bg-amber-500 text-slate-950 hover:bg-amber-400 font-semibold md-elevation-1',
    outline:
      'border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:bg-slate-900',
    danger: 'bg-red-600 text-white hover:bg-red-700 md-elevation-1',
    ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800',
  };

  // Material 3: every touch target stays at or above 48dp on phones.
  const sizes = {
    sm: 'h-10 sm:h-8 px-3.5 sm:px-3 text-xs rounded-lg',
    md: 'h-12 sm:h-10 px-4 text-sm rounded-xl',
    lg: 'h-14 sm:h-12 px-5 sm:px-6 text-base rounded-xl',
  };

  return cn(baseStyles, variants[variant], sizes[size], className);
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, icon: Icon, children, disabled, ...props }, ref) => {
    return (
      <button ref={ref} disabled={disabled || isLoading} className={buttonClassName({ variant, size, className })} {...props}>
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span>Chargement...</span>
          </span>
        ) : (
          <>
            {Icon && <Icon className="w-4 h-4 shrink-0" aria-hidden />}
            {children}
          </>
        )}
      </button>
    );
  },
);
Button.displayName = 'Button';
