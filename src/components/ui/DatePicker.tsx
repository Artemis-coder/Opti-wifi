'use client';

import React, { useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils/cn';
import { formatDateOnlyFR } from '@/lib/utils/format';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const WEEKDAYS_FULL = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

/** Lit un YYYY-MM-DD comme une date locale : new Date(chaîne) le traiterait en UTC. */
function parseISO(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function toISO(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

interface DatePickerProps {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Rend la valeur lisible dans un FormData lors d'une soumission native. */
  name?: string;
  label?: string;
  placeholder?: string;
  minDate?: string;
  maxDate?: string;
  clearable?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Champ date pensé pour le tactile.
 *
 * <input type="date"> ouvre une fenetre systeme qui, sur Android et dans la
 * WebView Capacitor, presente le calendrier dans une boite etroite ou les
 * jours sont difficiles a toucher. Ce composant ouvre une feuille Material 3
 * avec un vrai calendrier : mois et annee en clair, semaine demarrant le
 * lundi, un raccourci "Aujourd'hui" et la possibilite de vider la date.
 *
 * La valeur reste au format YYYY-MM-DD, identique a celui du <input> natif,
 * pour que les enregistrements en base ne changent pas.
 */
export function DatePicker({
  value,
  defaultValue = '',
  onChange,
  name,
  label,
  placeholder = 'Choisir une date',
  minDate,
  maxDate,
  clearable = false,
  disabled = false,
  className,
}: DatePickerProps) {
  const isControlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue);
  const [open, setOpen] = useState(false);

  const current = isControlled ? value : inner;
  const selected = current ? parseISO(current) : null;

  // Le calendrier s'ouvre sur le mois de la date retenue, sinon sur le mois
  // courant, pour ne jamais faire defiler pour reselectionner la meme date.
  const [cursor, setCursor] = useState<Date>(() => selected ?? new Date());

  const min = minDate ? startOfDay(parseISO(minDate)) : null;
  const max = maxDate ? startOfDay(parseISO(maxDate)) : null;

  const days = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    // getDay() renvoie 0 pour dimanche, on veut 0 pour lundi.
    const offset = (first.getDay() + 6) % 7;
    const count = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = Array.from({ length: offset }, () => null);
    for (let d = 1; d <= count; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const today = startOfDay(new Date());
  const todayISO = toISO(today);
  const selectedISO = selected ? toISO(selected) : null;

  const isDisabled = (day: Date) => {
    const d = startOfDay(day);
    if (min && d < min) return true;
    if (max && d > max) return true;
    return false;
  };

  const commit = (iso: string) => {
    if (!isControlled) setInner(iso);
    onChange?.(iso);
    setOpen(false);
  };

  const openSheet = () => {
    setCursor(selected ?? new Date());
    setOpen(true);
  };

  const shiftMonth = (delta: number) => {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  };

  const atMinMonth = min
    ? cursor.getFullYear() === min.getFullYear() && cursor.getMonth() === min.getMonth()
    : false;
  const atMaxMonth = max
    ? cursor.getFullYear() === max.getFullYear() && cursor.getMonth() === max.getMonth()
    : false;

  return (
    <div className={cn('w-full min-w-0 space-y-1.5', className)}>
      {label && (
        <span className="block text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
          {label}
        </span>
      )}

      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openSheet}
        className={cn(
          'md-ripple tap-target w-full h-14 sm:h-11 pl-4 sm:pl-3.5 pr-3 flex items-center justify-between gap-3 text-left',
          'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl',
          'text-base sm:text-sm font-medium transition duration-150',
          'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          selected ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400'
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          {selected ? formatDateOnlyFR(current) : placeholder}
        </span>
        <Calendar className="w-5 h-5 sm:w-4 sm:h-4 shrink-0 text-slate-400" />
      </button>

      {name && <input type="hidden" name={name} value={current} />}

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={label ?? 'Choisir une date'}
        className="sm:max-w-sm"
      >
        <div className="flex items-center justify-between gap-2 mb-4">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            disabled={atMinMonth}
            aria-label="Mois précédent"
            className="md-ripple tap-target h-11 w-11 shrink-0 flex items-center justify-center rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <p className="min-w-0 flex-1 text-center text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
            {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
          </p>

          <button
            type="button"
            onClick={() => shiftMonth(1)}
            disabled={atMaxMonth}
            aria-label="Mois suivant"
            className="md-ripple tap-target h-11 w-11 shrink-0 flex items-center justify-center rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((d, i) => (
            <div
              key={WEEKDAYS_FULL[i]}
              className="h-8 flex items-center justify-center text-[11px] font-bold uppercase text-slate-400"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} aria-hidden className="h-12" />;
            const iso = toISO(day);
            const isSelected = iso === selectedISO;
            const isToday = iso === todayISO;
            const off = isDisabled(day);
            return (
              <button
                key={iso}
                type="button"
                disabled={off}
                aria-pressed={isSelected}
                aria-label={`${WEEKDAYS_FULL[(day.getDay() + 6) % 7]} ${day.getDate()} ${MONTHS[day.getMonth()]} ${day.getFullYear()}`}
                onClick={() => commit(iso)}
                className={cn(
                  'md-ripple tap-target h-12 flex items-center justify-center rounded-xl text-sm sm:text-base font-semibold transition',
                  isSelected
                    ? 'bg-brand-500 text-slate-950 shadow-sm'
                    : isToday
                    ? 'bg-brand-500/15 text-brand-700 dark:text-brand-300 ring-1 ring-brand-500/50'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800',
                  off && 'opacity-30 pointer-events-none'
                )}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => commit(todayISO)}
            className="md-ripple tap-target px-4 h-11 rounded-xl text-sm font-bold text-brand-600 dark:text-brand-400 hover:bg-brand-500/10"
          >
            Aujourd&apos;hui
          </button>
          {clearable && selected && (
            <button
              type="button"
              onClick={() => commit('')}
              className="md-ripple tap-target px-4 h-11 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Effacer
            </button>
          )}
        </div>
      </Modal>
    </div>
  );
}
