'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Store,
  Ticket,
  ArrowLeftRight,
  Receipt,
  FileSpreadsheet,
  Users,
  Settings,
  X,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useSpaceStore } from '@/lib/stores/spaceStore';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { SpaceSelector } from './SpaceSelector';

interface SidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ isMobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    logout();
    router.push('/login');
  };

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['administrateur', 'collecteur'] },
    { label: 'Points de Vente', href: '/pos', icon: Store, roles: ['administrateur', 'collecteur'] },
    { label: 'Types de Tickets', href: '/tickets', icon: Ticket, roles: ['administrateur'] },
    { label: 'Allocations', href: '/allocations/new', icon: ArrowLeftRight, roles: ['administrateur'] },
    { label: 'Collectes & Caisses', href: '/collections', icon: Receipt, roles: ['administrateur', 'collecteur'] },
    { label: 'Rapports & Exports', href: '/reports', icon: FileSpreadsheet, roles: ['administrateur'] },
    { label: 'Utilisateurs', href: '/users', icon: Users, roles: ['administrateur'] },
    { label: 'Paramètres', href: '/settings', icon: Settings, roles: ['administrateur', 'collecteur'] },
  ];

  const filteredNav = navItems.filter((item) => !user?.role || item.roles.includes(user.role));

  const content = (
    <aside className="w-64 bg-[#0b1a3a] text-white flex flex-col h-full border-r border-slate-800 shadow-xl">
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg overflow-hidden relative bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
            <Image src="/assets/logo.jpg" alt="OptiWifi Logo" width={36} height={36} className="object-cover" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-wide text-white">Opti<span className="text-amber-400">Wifi</span></h1>
            <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">Gestion Tickets</p>
          </div>
        </div>

        {/* Close Button on Mobile Drawer */}
        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <SpaceSelector />

      {/* Nav List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {filteredNav.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onCloseMobile}
              className={cn(
                'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition duration-150',
                isActive
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              )}
            >
              <Icon className={cn('w-5 h-5', isActive ? 'text-slate-950' : 'text-slate-400')} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Role Badge Footer & Mobile Logout */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs border border-amber-500/30">
            <UserIcon className="w-4 h-4" />
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-bold text-white truncate">{user?.nom || 'Compte Utilisateur'}</p>
            <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">{user?.role || 'Collecteur'}</p>
          </div>
        </div>

        {onCloseMobile && (
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold text-red-400 bg-red-950/30 border border-red-900/50 hover:bg-red-900/40 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Déconnexion</span>
          </button>
        )}
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block sticky top-0 h-screen shrink-0">
        {content}
      </div>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs animate-in fade-in"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 w-64 max-w-[80vw] h-full animate-in slide-in-from-left duration-200">
            {content}
          </div>
        </div>
      )}
    </>
  );
}
