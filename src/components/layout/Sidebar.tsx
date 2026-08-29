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
  Settings 
} from 'lucide-react';
import { useAuthStore } from '@/lib/stores/authStore';
import { cn } from '@/lib/utils/cn';

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'administrateur';

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

  return (
    <aside className="w-64 bg-[#0b1a3a] text-white flex flex-col h-screen sticky top-0 border-r border-slate-800 shadow-xl">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800/80">
        <div className="w-9 h-9 rounded-lg overflow-hidden relative bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
          <Image src="/assets/logo.jpg" alt="OptiWifi Logo" width={36} height={36} className="object-cover" />
        </div>
        <div>
          <h1 className="font-bold text-lg leading-tight tracking-wide text-white">Opti<span className="text-amber-400">Wifi</span></h1>
          <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">Gestion Tickets</p>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {filteredNav.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition duration-150',
                isActive
                  ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              )}
            >
              <Icon className={cn('w-5 h-5', isActive ? 'text-slate-950' : 'text-slate-400')} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Role Badge Footer */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Espace :</span>
          <span className="font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider text-[10px]">
            {user?.role || 'invité'}
          </span>
        </div>
      </div>
    </aside>
  );
}
