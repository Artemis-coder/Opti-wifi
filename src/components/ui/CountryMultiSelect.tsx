'use client';

import React, { useMemo } from 'react';
import { Globe2, X } from 'lucide-react';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { COUNTRIES, countryFlag, countryName } from '@/lib/countries';

interface CountryMultiSelectProps {
  label?: string;
  /** Codes pays ISO sélectionnés (ex. ["CI", "SN"]) */
  value: string[];
  onChange: (codes: string[]) => void;
  /** Texte affiché quand aucun pays n'est choisi */
  emptyLabel?: string;
  helperText?: string;
}

/** Sélection de plusieurs pays : pastilles (drapeau + nom) et liste avec recherche pour en ajouter. */
export function CountryMultiSelect({ label, value, onChange, emptyLabel = 'Tous les pays', helperText }: CountryMultiSelectProps) {
  const options = useMemo(
    () =>
      COUNTRIES.filter((c, i, all) => all.findIndex((x) => x.code === c.code) === i && !value.includes(c.code))
        .map((c) => ({ value: c.code, label: `${countryFlag(c.code)}  ${countryName(c.code)}`, sublabel: `+${c.dial}` }))
        // Tri sur le nom du pays (le libellé commence par le drapeau)
        .sort((a, b) => countryName(a.value).localeCompare(countryName(b.value), 'fr')),
    [value]
  );

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <span className="block text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
          {label}
        </span>
      )}
      <div className="flex flex-wrap gap-1.5 min-h-9 items-center">
        {value.length === 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-3 h-8 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <Globe2 className="w-3.5 h-3.5" /> {emptyLabel}
          </span>
        ) : (
          value.map((code) => (
            <span
              key={code}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-2.5 pr-1 h-8 text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              <span aria-hidden>{countryFlag(code)}</span>
              {countryName(code)}
              <button
                type="button"
                onClick={() => onChange(value.filter((c) => c !== code))}
                className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                aria-label={`Retirer ${countryName(code)}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))
        )}
      </div>
      <CustomSelect
        value=""
        onChange={(code) => code && onChange([...value, code])}
        options={options}
        searchable
        searchPlaceholder="Rechercher un pays…"
        placeholder="Ajouter un pays…"
        title="Ajouter un pays"
        size="sm"
      />
      {helperText && <p className="text-xs text-slate-500">{helperText}</p>}
    </div>
  );
}
