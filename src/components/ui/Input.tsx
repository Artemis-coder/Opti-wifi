import React from 'react';
import { cn } from '@/lib/utils/cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  rightElement?: React.ReactNode;
}

/**
 * Champ texte au style HeroUI (classes `label`, `input`, `description`, `field-error`).
 * Champ natif : garde l'API historique (onChange avec un événement, ref, register…).
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, rightElement, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const describedBy = error ? `${inputId}-error` : helperText ? `${inputId}-help` : undefined;

    return (
      <div className="flex w-full flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className={cn('label', props.required && 'label--required')}>
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <input
            id={inputId}
            ref={ref}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              'input input--primary h-11 w-full sm:h-10',
              rightElement && 'pr-12',
              error && 'border-danger',
              className
            )}
            {...props}
          />
          {rightElement && <div className="absolute right-1.5 flex items-center justify-center sm:right-2">{rightElement}</div>}
        </div>
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-danger">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={`${inputId}-help`} className="description">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';
