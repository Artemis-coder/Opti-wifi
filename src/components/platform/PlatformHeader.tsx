'use client';

import React, { useState } from 'react';
import { Menu, Search, LogOut } from 'lucide-react';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useRouter } from 'next/navigation';
import { usePlatformAuthStore } from '@/lib/stores/platformAuthStore';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils/cn';

interface PlatformHeaderProps {
  onOpenMobileMenu?: () => void;
}

export function PlatformHeader({ onOpenMobileMenu }: PlatformHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const router = useRouter();
  const { platformUser, logout } = usePlatformAuthStore();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    logout();
    router.push('/login');
  };

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
          aria-label="Ouvrir le menu mobile"
        >
          <Menu className="w-5 h-5" />
        </button>

        <form className="hidden sm:flex items-center relative">
          <input
            type="text"
            placeholder="Rechercher un client, un utilisateur, une facture..."
            className="w-64 lg:w-80 h-9 pl-10 pr-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3" />
        </form>

        <button
          type="button"
          onClick={() => setSearchOpen(!searchOpen)}
          className="sm:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
          aria-label="Rechercher"
        >
          <Search className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <NotificationBell />

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {platformUser?.full_name || platformUser?.email || 'Super Admin'}
            </p>
            <p className="text-xs text-slate-500">
              {platformUser?.role === 'super_admin' ? '👑 Super Administrateur' : 'Support'}
            </p>
          </div>
          <div className="w-8 h-8 rounded-full bg-brand-900 text-brand-400 flex items-center justify-center font-bold text-sm border border-brand-500/30">
            {platformUser?.full_name?.[0] || platformUser?.email?.[0] || 'S'}
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className={cn(
            'p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition'
          )}
          aria-label="Déconnexion"
          title="Déconnexion"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
