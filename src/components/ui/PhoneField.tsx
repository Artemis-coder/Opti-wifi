'use client';

import React, { useMemo } from 'react';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { cn } from '@/lib/utils/cn';
import { COUNTRIES, countryFlag, countryName, findCountry } from '@/lib/countries';

interface PhoneFieldProps {
  label?: string;
  /** Code pays ISO (ex. « CI ») */
  country: string;
  onCountryChange: (code: string) => void;
  /** Numéro sans l'indicatif */
  number: string;
  onNumberChange: (value: string) => void;
  error?: string;
  helperText?: string;
  required?: boolean;
}

/**
 * Téléphone international : pays (drapeau + indicatif, avec recherche) et numéro dans un
 * même champ. Le pays choisi sert aussi de pays du compte.
 */
export function PhoneField({
  label,
  country,
  onCountryChange,
  number,
  onNumberChange,
  error,
  helperText,
  required,
}: PhoneFieldProps) {
  const inputId = React.useId();
  const options = useMemo(
    () =>
      COUNTRIES.map((c) => ({
        value: c.code,
        label: `${countryFlag(c.code)}  +${c.dial}`,
        sublabel: countryName(c.code),
      })),
    []
  );
  const selected = findCountry(country);

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider"
        >
          {label}
        </label>
      )}
      <div className="flex gap-2">
        <CustomSelect
          value={country}
          onChange={onCountryChange}
          options={options}
          searchable
          searchPlaceholder="Rechercher un pays ou un indicatif…"
          title="Pays"
          compactTrigger
          className="w-[7.5rem] shrink-0"
          triggerClassName="h-14 sm:h-11 min-h-0 py-0 px-3"
        />
        <input
          id={inputId}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder={selected?.code === 'CI' ? '07 00 00 00 00' : 'Numéro'}
          value={number}
          onChange={(e) => onNumberChange(e.target.value.replace(/[^\d\s.\-]/g, ''))}
          required={required}
          aria-invalid={!!error}
          aria-label={selected ? `Numéro (${countryName(selected.code)}, +${selected.dial})` : 'Numéro'}
          className={cn(
            'w-full min-w-0 h-14 sm:h-11 px-4 sm:px-3.5 bg-white dark:bg-slate-900 border rounded-xl text-base sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition duration-150',
            error ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-700'
          )}
        />
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {helperText && !error && <p className="text-xs text-slate-500">{helperText}</p>}
    </div>
  );
}
