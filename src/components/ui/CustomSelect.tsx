'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

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
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  const isSearchEnabled = searchable ?? options.length >= 6;

  const filteredOptions = useMemo(() => {
    if (!isSearchEnabled || !searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase().trim();
    return options.filter((opt) => {
      const labelMatch = opt.label.toLowerCase().includes(query);
      const sublabelMatch = opt.sublabel?.toLowerCase().includes(query);
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
          className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
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
          'w-full bg-white dark:bg-slate-900 border text-left flex items-center justify-between gap-2.5 transition',
          'border-slate-300 dark:border-slate-700 rounded-xl font-medium',
          'focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500',
          size === 'sm' ? 'px-3 py-2 text-xs min-h-[38px]' : 'px-4 py-3 text-sm min-h-[46px]',
          disabled && 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800',
          error && 'border-rose-500 dark:border-rose-500 focus:ring-rose-500/30',
          triggerClassName
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {leadingIcon && <span className="shrink-0 text-slate-500 dark:text-slate-400">{leadingIcon}</span>}
          {selectedOption ? (
            <div className="min-w-0 flex-1">
              <span className="truncate block text-slate-900 dark:text-slate-100 font-medium">
                {selectedOption.label}
              </span>
              {selectedOption.sublabel && size !== 'sm' && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate block">
                  {selectedOption.sublabel}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 truncate">{placeholder}</span>
          )}
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200',
            isOpen && 'rotate-180 text-emerald-600'
          )}
        />
      </button>

      {error && <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{error}</p>}
      {helperText && !error && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{helperText}</p>
      )}

      {/* Modal / Bottom Sheet */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-[60] flex items-end sm:items-center sm:justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs md-anim-fade"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'w-full bg-white dark:bg-slate-900 flex flex-col overflow-hidden safe-bottom',
              'max-h-[85dvh] rounded-t-3xl md-elevation-3 md-anim-sheet',
              'sm:max-w-md sm:rounded-2xl sm:max-h-[75vh] sm:md-anim-scale'
            )}
          >
            {/* Header */}
            <div className="relative flex items-center justify-between gap-3 px-4 sm:px-5 pt-3 sm:pt-4 pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
              {/* Drag handle for mobile */}
              <div
                aria-hidden
                className="sm:hidden absolute left-1/2 -translate-x-1/2 top-2 w-9 h-1 rounded-full bg-slate-300 dark:bg-slate-700"
              />
              <h3 className="min-w-0 flex-1 truncate pt-2 sm:pt-0 text-base font-semibold text-slate-900 dark:text-white">
                {title || label || 'Sélectionner une option'}
              </h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Fermer"
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Bar */}
            {isSearchEnabled && (
              <div className="p-3 border-b border-slate-100 dark:border-slate-800/80 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full pl-9 pr-8 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Options List */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-2 sm:p-3 space-y-1 md-scroll">
              {filteredOptions.length === 0 ? (
                <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                  Aucun résultat trouvé pour « {searchQuery} »
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
                        'w-full text-left px-3.5 py-3 rounded-xl flex items-center justify-between gap-3 transition min-h-[48px]',
                        isSelected
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/60 font-semibold'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200 border border-transparent',
                        opt.disabled && 'opacity-40 cursor-not-allowed pointer-events-none'
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={cn(
                            'w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors',
                            isSelected
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : 'border-slate-300 dark:border-slate-600'
                          )}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm">{opt.label}</div>
                          {opt.sublabel && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {opt.sublabel}
                            </div>
                          )}
                        </div>
                      </div>

                      {opt.badge && (
                        <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                          {opt.badge}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
