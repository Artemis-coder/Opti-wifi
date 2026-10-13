'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';

interface HeaderProps {
  onOpenMobileMenu?: () => void;
  title?: string;
}

const TITLES: Record<string, string> = {
  '/dashboard': 'Tableau de bord',
  '/pos': 'Points de vente',
  '/tickets': 'Types de tickets',
  '/spaces': 'Espaces Wi-Fi',
  '/allocations': 'Allocations',
  '/allocations/new': 'Nouvelle allocation',
  '/allocations/exchange': 'Échange de tickets',
  '/collections': 'Collectes',
  '/collections/new': 'Nouvelle collecte',
  '/users': 'Utilisateurs',
  '/reports': 'Rapports',
  '/settings': 'Paramètres',
  '/subscription': 'Abonnement',
};

function resolveTitle(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  const match = Object.keys(TITLES)
    .filter((path) => path.includes('[') === false && pathname.startsWith(path))
    .sort((a, b) => b.length - a.length)[0];
  if (match) return TITLES[match];
  if (pathname.startsWith('/pos/')) return 'Détail du point de vente';
  if (pathname.startsWith('/spaces/')) return 'Espace Wi-Fi';
  return 'Opti Wi-Fi';
}

export function Header({ onOpenMobileMenu, title }: HeaderProps) {
  const pathname = usePathname();
  const heading = title ?? resolveTitle(pathname ?? '/');

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 dark:bg-slate-900/95 dark:border-slate-800 safe-top">
      <div className="h-16 px-2 sm:px-6 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="md-ripple tap-target lg:hidden flex items-center justify-center rounded-full text-slate-700 dark:text-slate-200 transition"
          aria-label="Ouvrir le menu"
        >
          <Menu className="w-6 h-6" />
        </button>

        <h1 className="min-w-0 flex-1 truncate text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
          {heading}
        </h1>
      </div>
    </header>
  );
}
