'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Menu, Wifi, WifiOff, AlertTriangle, ShieldCheck, User as UserIcon } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { NotificationBell } from '@/components/notifications/NotificationBell';

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
  return 'OptiSpace';
}

export function Header({ onOpenMobileMenu, title }: HeaderProps) {
  const pathname = usePathname();
  const heading = title ?? resolveTitle(pathname ?? '/');
  const { user } = useAuthStore();
  const { isOnline, isOffline, isUnstable } = useOnlineStatus();

  const isAdmin = user?.role === 'administrateur';

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 dark:bg-slate-900/95 dark:border-slate-800 safe-top">
      <div className="h-16 px-3 sm:px-6 flex items-center justify-between gap-3">
        {/* Left: Hamburger trigger on mobile */}
        <div className="flex items-center gap-2.5 min-w-0">
          {onOpenMobileMenu && (
            <button
              type="button"
              onClick={onOpenMobileMenu}
              className="md-ripple tap-target lg:hidden w-10 h-10 shrink-0 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
              aria-label="Ouvrir le menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <h1 className="min-w-0 truncate text-base sm:text-lg font-bold text-slate-900 dark:text-white">
            {heading}
          </h1>
        </div>

        {/* Right: Quick mobile indicators & avatar button */}
        <div className="flex items-center gap-2 shrink-0">
          <NotificationBell />
          {/* Network status pill on mobile */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300">
            {isOnline && (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="hidden sm:inline">En ligne</span>
              </>
            )}
            {isUnstable && (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="hidden sm:inline">Instable</span>
              </>
            )}
            {isOffline && (
              <>
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-red-600 dark:text-red-400 font-semibold">Hors ligne</span>
              </>
            )}
          </div>

          {/* User quick profile button on mobile */}
          {user && (
            <button
              type="button"
              onClick={onOpenMobileMenu}
              className="lg:hidden flex items-center gap-2 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Ouvrir le profil et menu"
              aria-label="Profil utilisateur"
            >
              <div className="w-8 h-8 rounded-full bg-brand-500/20 text-brand-700 dark:text-brand-300 border border-brand-500/40 flex items-center justify-center font-bold text-xs">
                {isAdmin ? <ShieldCheck className="w-4 h-4 text-amber-500" /> : <UserIcon className="w-4 h-4" />}
              </div>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
