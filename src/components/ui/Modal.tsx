'use client';

import React, { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      className="fixed inset-0 flex flex-col justify-end sm:justify-center items-center px-3.5 sm:px-4 bg-slate-950/70 backdrop-blur-sm md-anim-fade"
      style={{ zIndex: 45 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'w-full max-w-lg bg-white dark:bg-slate-900 flex flex-col overflow-hidden',
          // Floating card elevated with gap above mobile navigation bar
          'rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 md-anim-scale',
          'max-h-[calc(100dvh-12rem)] sm:max-h-[88vh]',
          'elevate-above-bottom-nav',
          className
        )}
      >
        <div className="relative flex items-center justify-between gap-3 px-4 sm:px-5 pt-3 sm:pt-4 pb-3 border-b border-slate-200 dark:border-slate-800">
          {/* Drag handle — Material 3 bottom sheet affordance */}
          <div aria-hidden className="sm:hidden absolute left-1/2 -translate-x-1/2 top-2 w-9 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
          <h3 className="min-w-0 flex-1 truncate pt-2 sm:pt-0 text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="md-ripple tap-target shrink-0 flex items-center justify-center rounded-full text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="md-scroll flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">{children}</div>
      </div>
    </div>,
    document.body
  );
}
