'use client';

import React, { useState, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/** Texte de recherche sans accents ni majuscules (« Sénégal » est trouvé avec « sen »). */
const fold = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  disabled?: boolean;
}

export interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  label?: string;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  title?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  size?: 'sm' | 'md';
  leadingIcon?: React.ReactNode;
  id?: string;
  /** N'affiche que le libellé dans le bouton (le sous-libellé reste visible dans la liste). */
  compactTrigger?: boolean;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Sélectionner...',
  label,
  helperText,
  error,
  disabled = false,
  className,
  triggerClassName,
  title,
  searchable,
  searchPlaceholder = 'Rechercher une option...',
  size = 'md',
  leadingIcon,
  id,
  compactTrigger = false,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  const isSearchEnabled = searchable ?? options.length >= 4;

  const filteredOptions = useMemo(() => {
    if (!isSearchEnabled || !searchQuery.trim()) return options;
    const query = fold(searchQuery);
    return options.filter((opt) => {
      const labelMatch = fold(opt.label).includes(query);
      const sublabelMatch = opt.sublabel ? fold(opt.sublabel).includes(query) : false;
      return labelMatch || sublabelMatch;
    });
  }, [options, searchQuery, isSearchEnabled]);

  // Lock body scroll and focus search input when opened
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
      return () => {
        document.body.style.overflow = 'unset';
        window.removeEventListener('keydown', handleKeyDown);
        clearTimeout(timer);
      };
    }
  }, [isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleOpen = () => {
    if (disabled) return;
    setIsOpen(true);
    setSearchQuery('');
  };

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-semibold text-foreground mb-1.5"
        >
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        id={id}
        onClick={handleOpen}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          'w-full bg-field text-field-foreground shadow-field text-left flex items-center justify-between gap-2.5 transition-colors',
          'rounded-xl border border-transparent hover:bg-field-hover',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          size === 'sm' ? 'px-3 py-2 text-xs min-h-9' : 'px-3 py-2 text-sm min-h-10',
          disabled && 'opacity-50 cursor-not-allowed',
          error && 'border-danger',
          triggerClassName
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {leadingIcon && <span className="shrink-0 text-muted">{leadingIcon}</span>}
          {selectedOption ? (
            <div className="min-w-0 flex-1">
              <span className="truncate block text-foreground font-medium">
                {selectedOption.label}
              </span>
              {selectedOption.sublabel && size !== 'sm' && !compactTrigger && (
                <span className="text-xs text-muted truncate block">
                  {selectedOption.sublabel}
                </span>
              )}
            </div>
          ) : (
            <span className="text-muted truncate">{placeholder}</span>
          )}
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 shrink-0 text-muted transition-transform duration-200',
            isOpen && 'rotate-180 text-success-soft-foreground'
          )}
        />
      </button>

      {error && <p className="text-xs text-danger mt-1">{error}</p>}
      {helperText && !error && (
        <p className="text-xs text-muted mt-1">{helperText}</p>
      )}

      {/* Modal / Bottom Sheet rendered into document.body via Portal */}
      {isOpen && mounted && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 flex flex-col justify-end sm:justify-center items-center px-3.5 sm:px-4 bg-backdrop md-anim-fade"
          style={{ zIndex: 45 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'w-full max-w-lg bg-overlay text-overlay-foreground flex flex-col overflow-hidden',
              // On mobile: floating card elevated with visible gap above BottomNav
              'rounded-2xl shadow-overlay md-anim-scale',
              // Dynamic height: hugs content when few options, scrolls smoothly when many
              'h-auto max-h-[calc(100dvh-12rem)] sm:max-h-[82vh]',
              // Elevate above the fixed bottom navigation bar with an intentional gap
              'elevate-above-bottom-nav'
            )}
          >
            {/* Header */}
            <div className="relative flex items-center justify-between gap-3 px-4 sm:px-6 pt-3.5 sm:pt-4 pb-3 border-b border-border shrink-0">
              {/* Drag handle for mobile */}
              <div
                aria-hidden
                className="sm:hidden absolute left-1/2 -translate-x-1/2 top-2.5 w-12 h-1.5 rounded-full bg-default-hover"
              />
              <div className="min-w-0 flex-1 pt-2 sm:pt-0">
                <h3 className="truncate text-base sm:text-lg font-semibold text-foreground">
                  {title || label || 'Sélectionner une option'}
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  {options.length} option{options.length > 1 ? 's' : ''} disponible{options.length > 1 ? 's' : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Fermer"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-muted hover:text-muted hover:bg-default transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Bar */}
            {isSearchEnabled && (
              <div className="p-3 sm:px-6 shrink-0 bg-surface-secondary/60">
                <div className="relative">
                  <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="input input--primary w-full pl-10 pr-9"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-muted"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Options List with balanced padding */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-2 pb-3.5 sm:pb-4 md-scroll">
              {filteredOptions.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <p className="text-muted text-sm font-medium">
                    Aucun résultat trouvé pour « {searchQuery} »
                  </p>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-xs font-semibold text-success-soft-foreground hover:underline"
                  >
                    Effacer la recherche
                  </button>
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={opt.disabled}
                      onClick={() => handleSelect(opt.value)}
                      className={cn(
                        'w-full text-left p-3.5 sm:p-4 rounded-xl flex items-center justify-between gap-3.5 transition border min-h-[58px]',
                        'active:scale-[0.99] touch-manipulation',
                        isSelected
                          ? 'bg-success-soft text-success-soft-foreground shadow-xs'
                          : 'bg-surface-secondary/70 text-foreground hover:bg-default',
                        opt.disabled && 'opacity-40 cursor-not-allowed pointer-events-none'
                      )}
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div
                          className={cn(
                            'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                            isSelected
                              ? 'border-success bg-success text-success-foreground'
                              : 'border-border'
                          )}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-foreground">
                            {opt.label}
                          </div>
                          {opt.sublabel && (
                            <div className="text-xs text-muted truncate mt-0.5">
                              {opt.sublabel}
                            </div>
                          )}
                        </div>
                      </div>

                      {isSelected ? (
                        <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-success-soft text-success-soft-foreground">
                          Sélectionné
                        </span>
                      ) : opt.badge ? (
                        <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-default/80 text-muted font-medium">
                          {opt.badge}
                        </span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
