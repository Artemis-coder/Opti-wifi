'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Store,
  Ticket,
  Receipt,
  MapPin,
  Menu,
} from 'lucide-react';
import { useAuthStore } from '@/lib/stores/authStore';
import { cn } from '@/lib/utils/cn';

interface BottomNavProps {
  onOpenMobileMenu: () => void;
}

export function BottomNav({ onOpenMobileMenu }: BottomNavProps) {
  const pathname = usePathname();
  const { user } = useAuthStore();

  const primaryItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'POS', href: '/pos', icon: Store },
    { label: 'Tickets', href: '/tickets', icon: Ticket, adminOnly: true },
    { label: 'Collectes', href: '/collections', icon: Receipt },
    { label: 'Espaces', href: '/spaces', icon: MapPin },
  ];

  const filteredItems = primaryItems.filter((item) => !item.adminOnly || user?.role === 'administrateur');

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#0b1a3a] border-t border-slate-800 text-white z-40 px-2 flex items-center justify-around shadow-2xl">
      {filteredItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center justify-center w-full h-full py-1 text-[11px] font-medium transition duration-150',
              isActive ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
            )}
          >
            <div className={cn('p-1 rounded-lg', isActive && 'bg-amber-500/20')}>
              <Icon className="w-5 h-5" />
            </div>
            <span className="truncate max-w-[64px]">{item.label}</span>
          </Link>
        );
      })}

      <button
        type="button"
        onClick={onOpenMobileMenu}
        className="flex flex-col items-center justify-center w-full h-full py-1 text-[11px] font-medium text-slate-400 hover:text-slate-200"
      >
        <div className="p-1">
          <Menu className="w-5 h-5" />
        </div>
        <span>Menu</span>
      </button>
    </nav>
  );
}
