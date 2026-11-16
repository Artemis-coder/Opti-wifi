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
    <div className="space-y-5 w-full">
      {label && (
        <span className="block text-xs sm:text-xs font-semibold text-muted">
          {label}
        </span>
      )}
      <div className="flex flex-wrap gap-1.5 min-h-9 items-center">
        {value.length === 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-default px-3 h-8 text-xs font-semibold text-muted">
            <Globe2 className="w-3.5 h-3.5" /> {emptyLabel}
          </span>
        ) : (
          value.map((code) => (
            <span
              key={code}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface pl-2.5 pr-1 h-8 text-xs font-semibold text-foreground"
            >
              <span aria-hidden>{countryFlag(code)}</span>
              {countryName(code)}
              <button
                type="button"
                onClick={() => onChange(value.filter((c) => c !== code))}
                className="w-6 h-6 rounded-xl flex items-center justify-center text-muted hover:text-danger hover:bg-danger-soft"
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
      {helperText && <p className="text-xs text-muted">{helperText}</p>}
    </div>
  );
}
