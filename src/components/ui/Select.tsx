'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils/cn';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  /** Seuil au-delà duquel un champ de recherche est proposé. */
  searchThreshold?: number;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Liste de sélection pensée pour le tactile.
 *
 * Le <select> natif s'ouvre dans une fenêtre système qui, sur Android et
 * dans la WebView Capacitor, tronque les libellés longs et propose des
 * cibles minuscules. Ce composant le remplace par une feuille Material 3 :
 * une ligne pleine largeur par option, hauteur de 56px minimum, titre et
 * précision sur deux lignes, coche sur l'option retenue, et recherche
 * automatique dès qu'il y a beaucoup d'entrées.
 */
export function Select({
  options,
  value,
  onChange,
  label,
  placeholder = 'Sélectionner...',
  searchThreshold = 8,
  searchPlaceholder = 'Rechercher...',
  emptyMessage = 'Aucun résultat',
  disabled = false,
  className,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);
  const isSearchable = options.length > searchThreshold;

  useEffect(() => {
    if (!open || !isSearchable) return;
    // Le champ de recherche reçoit le focus pour eviter une saisie au
    // clavier materiel juste apres l'ouverture de la feuille.
    const t = setTimeout(() => searchRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [open, isSearchable]);

  useEffect(() => {
    if (!open) return;
    // Au retour du fond apres fermeture, le focus revient sur le declencheur
    // pour que la navigation au clavier ne soit jamais perdue.
    const trigger = triggerRef.current;
    return () => trigger?.focus();
  }, [open]);

  const openSheet = () => {
    setQuery('');
    setOpen(true);
  };

  const closeSheet = () => {
    setQuery('');
    setOpen(false);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.description ?? '').toLowerCase().includes(q)
    );
  }, [options, query]);

  const commit = (v: string) => {
    onChange(v);
    setQuery('');
    setOpen(false);
  };

  return (
    // min-w-0 est indispensable : le corps de l'application est un flex
    // column, donc sans lui la racine herite d'une largeur min-content et
    // elargit toute la page des qu'un libelle long est selectionne.
    <div className={cn('w-full min-w-0 space-y-1.5', className)}>
      {label && (
        <span className="block text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
          {label}
        </span>
      )}

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={openSheet}
        className={cn(
          // M3 outlined field: 56dp sur telephone, corps 16px pour qu'Android
          // ne zoom jamais le viewport au focus.
          'md-ripple tap-target w-full h-14 sm:h-11 pl-4 sm:pl-3.5 pr-3 flex items-center justify-between gap-3 text-left',
          'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl',
          'text-base sm:text-sm font-medium transition duration-150',
          'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          selected ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400'
        )}
      >
        <span className="min-w-0 flex-1 truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown
          className={cn(
            'w-5 h-5 sm:w-4 sm:h-4 shrink-0 text-slate-400 transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>

      <Modal
        isOpen={open}
        onClose={closeSheet}
        title={label ?? 'Sélectionner'}
        className="sm:max-w-md"
      >
        {isSearchable && (
          <div className="relative mb-3">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full h-12 sm:h-11 pl-10 pr-3 bg-slate-100 dark:bg-slate-800 border border-transparent rounded-xl text-base sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        )}

        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">{emptyMessage}</p>
        ) : (
          <ul role="listbox" className="space-y-1.5 -mx-1">
            {filtered.map((o) => {
              const isSelected = o.value === value;
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={o.disabled}
                    onClick={() => commit(o.value)}
                    className={cn(
                      'md-ripple tap-target w-full min-h-14 flex items-center gap-3 px-3 rounded-xl text-left transition',
                      isSelected
                        ? 'bg-amber-500/10 border border-amber-500/40'
                        : 'border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800',
                      o.disabled && 'opacity-40 cursor-not-allowed'
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm sm:text-sm font-semibold text-slate-900 dark:text-slate-100 break-words">
                        {o.label}
                      </span>
                      {o.description && (
                        <span className="block text-xs text-slate-500 mt-0.5 break-words">
                          {o.description}
                        </span>
                      )}
                    </span>
                    {isSelected && <Check className="w-5 h-5 shrink-0 text-amber-500" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Modal>
    </div>
  );
}
