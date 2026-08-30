'use client';

import React from 'react';
import { Menu } from 'lucide-react';

interface HeaderProps {
  onOpenMobileMenu?: () => void;
}

export function Header({ onOpenMobileMenu }: HeaderProps) {
  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      <button
        type="button"
        onClick={onOpenMobileMenu}
        className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
        aria-label="Ouvrir le menu mobile"
      >
        <Menu className="w-5 h-5" />
      </button>
    </header>
  );
}
