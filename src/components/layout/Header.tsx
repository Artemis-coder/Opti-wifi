'use client';

import React from 'react';
import { LogOut, User as UserIcon, Menu } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/authStore';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  onOpenMobileMenu?: () => void;
}

export function Header({ onOpenMobileMenu }: HeaderProps) {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    logout();
    router.push('/login');
  };

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Menu Toggle */}
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
          aria-label="Ouvrir le menu mobile"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <h2 className="text-xs sm:text-sm font-bold text-[#0b1a3a] dark:text-amber-400 tracking-tight">OptiWifi</h2>
          <span className="text-slate-300">/</span>
          <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[120px] sm:max-w-none">
            {user?.role === 'administrateur' ? 'Espace Admin' : 'Espace Collecteur'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* User Profile */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#0b1a3a] text-amber-400 flex items-center justify-center font-bold text-xs shadow-xs border border-amber-500/30">
            {user?.nom ? user.nom.slice(0, 2).toUpperCase() : <UserIcon className="w-4 h-4" />}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">{user?.nom || 'Utilisateur'}</p>
            <p className="text-[10px] text-slate-500 leading-tight">{user?.email || 'session@optiwifi.co'}</p>
          </div>
        </div>

        <div className="h-5 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
          title="Se déconnecter"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden md:inline font-semibold">Déconnexion</span>
        </button>
      </div>
    </header>
  );
}
