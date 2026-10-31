'use client';

import React from 'react';
import { cn } from '@/lib/utils/cn';
import type { DurationUnit } from '@/lib/ticket-duration';

interface DurationFieldProps {
  value: string;
  unit: DurationUnit;
  onChange: (value: string, unit: DurationUnit) => void;
}

/** Durée d'un type de ticket : nombre et unité (jours par défaut, heures pour moins d'un jour). */
export function DurationField({ value, unit, onChange }: DurationFieldProps) {
  const id = React.useId();
  return (
    <div className="w-full space-y-1.5">
      <label htmlFor={id} className="block text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
        Durée
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          required
          value={value}
          onChange={(e) => onChange(e.target.value, unit)}
          placeholder={unit === 'jours' ? '1' : '12'}
          className="w-full min-w-0 h-14 sm:h-11 px-4 sm:px-3.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-base sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        />
        <div role="radiogroup" aria-label="Unité" className="flex shrink-0 rounded-xl border border-slate-300 dark:border-slate-700 p-1 gap-1">
          {(['jours', 'heures'] as const).map((u) => (
            <button
              key={u}
              type="button"
              role="radio"
              aria-checked={unit === u}
              onClick={() => onChange(value, u)}
              className={cn(
                'px-3 rounded-lg text-sm font-semibold transition',
                unit === u ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              )}
            >
              {u === 'jours' ? 'Jours' : 'Heures'}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-slate-500">En jours (ex. 1, 7, 30). « Heures » pour un pass de moins d&apos;une journée.</p>
    </div>
  );
}
