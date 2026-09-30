'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, ArrowLeft } from 'lucide-react';
import { useCanGoBack } from '@/hooks/useCanGoBack';

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
    .filter((path) => !path.includes('[') && pathname.startsWith(path))
    .sort((a, b) => b.length - a.length)[0];
  if (match) return TITLES[match];
  if (pathname.startsWith('/pos/')) return 'Détail du point de vente';
  if (pathname.startsWith('/spaces/')) return 'Espace Wi-Fi';
  return 'Opti Wi-Fi';
}

const ICON_BUTTON =
  'md-ripple tap-target flex items-center justify-center rounded-full text-slate-700 dark:text-slate-200 transition';

export function Header({ onOpenMobileMenu, title }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const heading = title ?? resolveTitle(pathname ?? '/');

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 dark:bg-slate-900/95 dark:border-slate-800 safe-top">
      <div className="h-16 px-2 sm:px-6 flex items-center gap-1">
        {/* Back is offered as soon as the user has drilled in; the drawer
            button stays so every section remains reachable. */}
        {canGoBack && (
          <button
            type="button"
            onClick={() => router.back()}
            className={ICON_BUTTON}
            aria-label="Revenir à la page précédente"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        )}

        <button
          type="button"
          onClick={onOpenMobileMenu}
          className={`${ICON_BUTTON} lg:hidden`}
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
