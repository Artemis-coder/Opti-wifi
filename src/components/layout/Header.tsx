'use client';

import React from 'react';
import { LogOut, User as UserIcon, Globe } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/authStore';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export function Header() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    logout();
    router.push('/login');
  };

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium text-slate-500">OptiWifi SaaS</h2>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Session Active</span>
      </div>

      <div className="flex items-center gap-4">
        {/* User Info */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#0b1a3a] text-amber-400 flex items-center justify-center font-bold text-xs shadow-xs border border-amber-500/30">
            {user?.nom ? user.nom.slice(0, 2).toUpperCase() : <UserIcon className="w-4 h-4" />}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">{user?.nom || 'Utilisateur'}</p>
            <p className="text-[10px] text-slate-500 leading-tight">{user?.email || 'session@optiwifi.co'}</p>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
          title="Se déconnecter"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Déconnexion</span>
        </button>
      </div>
    </header>
  );
}
