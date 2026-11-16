'use client';

import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { toDateInputValue } from '@/lib/utils/format';

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** "2026-10-25" → Date locale (sans décalage de fuseau). */
function parse(value: string | undefined | null): Date | null {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

export interface DateFieldProps {
  /** Date au format YYYY-MM-DD ('' si vide). */
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  helperText?: string;
  error?: string;
  /** Bornes au format YYYY-MM-DD. */
  min?: string;
  max?: string;
  /** Affiche « Effacer » (filtres optionnels). */
  clearable?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/**
 * Sélecteur de date intégré au site (remplace <input type="date">) :
 * le calendrier natif d'Android est rendu par le téléphone et peut être déformé
 * par le thème du système ; celui-ci a le même rendu partout.
 */
export function DateField({
  value,
  onChange,
  label,
  placeholder = 'Choisir une date',
  helperText,
  error,
  min,
  max,
  clearable = false,
  disabled = false,
  id,
  className,
}: DateFieldProps) {
  const generatedId = React.useId();
  const fieldId = id ?? generatedId;
  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [isOpen, setIsOpen] = useState(false);
  const selected = parse(value);
  const minDate = parse(min);
  const maxDate = parse(max);
  const today = toDateInputValue();
  const [view, setView] = useState(() => {
    const base = selected || new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsOpen(false);
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const open = () => {
    if (disabled) return;
    const base = selected || maxDate || new Date();
    setView({ year: base.getFullYear(), month: base.getMonth() });
    setIsOpen(true);
  };

  // Grille du mois : semaine commençant le lundi, cases vides avant le 1er
  const cells = useMemo(() => {
    const first = new Date(view.year, view.month, 1);
    const offset = (first.getDay() + 6) % 7;
    const days = new Date(view.year, view.month + 1, 0).getDate();
    return [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)] as (number | null)[];
  }, [view]);

  const isDisabledDay = (d: Date) => (minDate !== null && d < minDate) || (maxDate !== null && d > maxDate);
  const shiftMonth = (delta: number) =>
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  const pick = (d: Date) => {
    onChange(toDateInputValue(d));
    setIsOpen(false);
  };

  const display = selected
    ? new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }).format(selected)
    : '';
  const todayDate = parse(today)!;

  return (
    <div className={cn('w-full space-y-1.5', className)}>
      {label && (
        <label htmlFor={fieldId} className="block text-xs sm:text-xs font-semibold text-muted">
          {label}
        </label>
      )}
      <button
        type="button"
        id={fieldId}
        onClick={open}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={cn(
          'w-full h-14 sm:h-11 px-4 sm:px-3.5 flex items-center justify-between gap-2 text-left',
          'bg-surface border border-border rounded-xl text-base sm:text-sm transition',
          'focus:outline-none focus:ring-2 focus:ring-focus focus:border-transparent',
          disabled && 'opacity-50 cursor-not-allowed',
          error && 'border-danger focus:ring-focus'
        )}
      >
        <span className={cn('truncate first-letter:', display ? 'text-foreground' : 'text-muted')}>
          {display || placeholder}
        </span>
        <CalendarDays className="w-5 h-5 shrink-0 text-muted" />
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
      {helperText && !error && <p className="text-xs text-muted">{helperText}</p>}

      {isOpen &&
        mounted &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={label || 'Choisir une date'}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 flex flex-col justify-end sm:justify-center items-center px-3.5 sm:px-4 bg-backdrop md-anim-fade"
            style={{ zIndex: 45 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-overlay text-overlay-foreground rounded-2xl shadow-overlay md-anim-scale elevate-above-bottom-nav overflow-hidden"
            >
              {/* En-tête : date choisie */}
              <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-border">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-muted">{label || 'Date'}</p>
                  <p className="text-lg font-semibold text-foreground first-letter: truncate">
                    {display || 'Aucune date'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Fermer"
                  className="w-10 h-10 -mr-2 rounded-xl flex items-center justify-center text-muted hover:text-muted hover:bg-default transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation mois */}
              <div className="flex items-center justify-between px-3 pt-3">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  aria-label="Mois précédent"
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-muted hover:bg-default transition"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <p className="text-sm font-semibold text-foreground capitalize">
                  {MONTHS[view.month]} {view.year}
                </p>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  aria-label="Mois suivant"
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-muted hover:bg-default transition"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Grille */}
              <div className="grid grid-cols-7 gap-1 px-3 pb-2" role="grid">
                {WEEKDAYS.map((d, i) => (
                  <span key={i} className="h-8 flex items-center justify-center text-xs font-semibold text-muted">
                    {d}
                  </span>
                ))}
                {cells.map((day, i) => {
                  if (day === null) return <span key={`e${i}`} />;
                  const date = new Date(view.year, view.month, day);
                  const iso = toDateInputValue(date);
                  const isSelected = iso === value;
                  const isToday = iso === today;
                  const off = isDisabledDay(date);
                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={off}
                      onClick={() => pick(date)}
                      aria-pressed={isSelected}
                      aria-label={new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full' }).format(date)}
                      className={cn(
                        'h-11 rounded-xl text-sm font-medium transition touch-manipulation',
                        isSelected
                          ? 'bg-accent text-accent-foreground font-semibold shadow-sm'
                          : isToday
                            ? 'text-accent ring-1 ring-accent/60 hover:bg-accent/10'
                            : 'text-foreground hover:bg-default',
                        off && 'opacity-30 cursor-not-allowed hover:bg-transparent'
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border">
                <button
                  type="button"
                  disabled={isDisabledDay(todayDate)}
                  onClick={() => pick(todayDate)}
                  className="h-10 px-4 rounded-xl text-sm font-semibold text-accent hover:bg-accent/10 disabled:opacity-40 transition"
                >
                  Aujourd&apos;hui
                </button>
                {clearable && value && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange('');
                      setIsOpen(false);
                    }}
                    className="h-10 px-4 rounded-xl text-sm font-semibold text-muted hover:bg-default transition"
                  >
                    Effacer
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
