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
    <div className="space-y-5 w-full">
      <label htmlFor={id} className="block text-xs sm:text-xs font-semibold text-muted">
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
          className="input input--primary w-full min-w-0 h-14"
        />
        <div role="radiogroup" aria-label="Unité" className="flex shrink-0 rounded-xl border border-border p-1 gap-1">
          {(['jours', 'heures'] as const).map((u) => (
            <button
              key={u}
              type="button"
              role="radio"
              aria-checked={unit === u}
              onClick={() => onChange(value, u)}
              className={cn(
                'px-3 rounded-xl text-sm font-semibold transition',
                unit === u ? 'bg-foreground text-background' : 'text-muted hover:text-foreground'
              )}
            >
              {u === 'jours' ? 'Jours' : 'Heures'}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted">En jours (ex. 1, 7, 30). « Heures » pour un pass de moins d&apos;une journée.</p>
    </div>
  );
}
