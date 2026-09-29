'use client';

import React, { useState } from 'react';
import { Menu, Search, Bell, LogOut, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { usePlatformAuthStore } from '@/lib/stores/platformAuthStore';
import { createClient } from '@/lib/supabase/client';
import { useCanGoBack } from '@/hooks/useCanGoBack';

interface PlatformHeaderProps {
  onOpenMobileMenu?: () => void;
}

const ICON_BUTTON =
  'md-ripple tap-target flex items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition';

export function PlatformHeader({ onOpenMobileMenu }: PlatformHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const { platformUser, logout } = usePlatformAuthStore();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    logout();
    router.push('/platform/login');
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 safe-top">
      <div className="h-16 px-2 sm:px-6 flex items-center justify-between gap-2">
      <div className="flex items-center gap-1 sm:gap-3 min-w-0">
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

        <form className="hidden sm:flex items-center relative">
          <input
            type="text"
            placeholder="Rechercher un client, un utilisateur, une facture..."
            className="w-64 lg:w-80 h-10 pl-10 pr-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-full text-base sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5" />
        </form>

        <button
          type="button"
          onClick={() => setSearchOpen(!searchOpen)}
          className={`${ICON_BUTTON} sm:hidden`}
          aria-label="Rechercher"
        >
          <Search className="w-6 h-6" />
        </button>
      </div>

      <div className="flex items-center gap-1 sm:gap-3 shrink-0">
        <button
          type="button"
          className={`${ICON_BUTTON} relative`}
          aria-label="Notifications"
        >
          <Bell className="w-6 h-6" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full" />
        </button>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {platformUser?.full_name || platformUser?.email || 'Super Admin'}
            </p>
            <p className="text-xs text-slate-500">
              {platformUser?.role === 'super_admin' ? '👑 Super Administrateur' : 'Support'}
            </p>
          </div>
          <div className="w-9 h-9 rounded-full bg-[#0b1a3a] text-amber-400 flex items-center justify-center font-bold text-sm border border-amber-500/30">
            {(platformUser?.full_name?.[0] || platformUser?.email?.[0] || 'S').toUpperCase()}
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className={ICON_BUTTON}
          aria-label="Déconnexion"
          title="Déconnexion"
        >
          <LogOut className="w-6 h-6" />
        </button>
      </div>
      </div>
    </header>
  );
}
