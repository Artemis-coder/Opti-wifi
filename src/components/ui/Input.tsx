import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, type, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const toggleId = `${inputId}-toggle`;

    const isPassword = type === 'password';
    const [isRevealed, setIsRevealed] = React.useState(false);

    // Never keep a revealed password around if the field changes kind.
    React.useEffect(() => {
      if (!isPassword) setIsRevealed(false);
    }, [isPassword]);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            id={inputId}
            ref={ref}
            type={isPassword && isRevealed ? 'text' : type}
            aria-describedby={isPassword ? toggleId : undefined}
            className={cn(
              // Material 3 outlined text field: 56dp on phones, 16px type so
              // Android never zooms the viewport on focus.
              'w-full h-14 sm:h-11 px-4 sm:px-3.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition duration-150',
              // Leave room for the reveal button.
              isPassword && 'pr-14',
              error && 'border-red-500 focus:ring-red-500',
              className
            )}
            {...props}
          />

          {isPassword && (
            <button
              type="button"
              id={toggleId}
              onClick={() => setIsRevealed((value) => !value)}
              aria-label={isRevealed ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              aria-pressed={isRevealed}
              className="md-ripple absolute right-1 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {isRevealed ? (
                <EyeOff className="w-5 h-5" strokeWidth={1.8} />
              ) : (
                <Eye className="w-5 h-5" strokeWidth={1.8} />
              )}
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        {helperText && !error && <p className="text-xs text-slate-500">{helperText}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';
