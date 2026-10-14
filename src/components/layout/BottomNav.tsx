'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Store,
  Receipt,
  ArrowLeftRight,
  Menu,
} from 'lucide-react';
import { useAuthStore } from '@/lib/stores/authStore';
import { cn } from '@/lib/utils/cn';

interface BottomNavProps {
  onOpenMobileMenu: () => void;
}

const primaryItems = [
  { label: 'Accueil', href: '/dashboard', icon: LayoutDashboard },
  { label: 'POS', href: '/pos', icon: Store },
  { label: 'Collectes', href: '/collections', icon: Receipt },
  { label: 'Allocations', href: '/allocations', icon: ArrowLeftRight, adminOnly: true },
];

export function BottomNav({ onOpenMobileMenu }: BottomNavProps) {
  const pathname = usePathname();
  const { user } = useAuthStore();

  const filteredItems = primaryItems.filter(
    (item) => !item.adminOnly || user?.role === 'administrateur'
  );

  return (
    <nav
      aria-label="Navigation principale mobile"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-brand-950/95 backdrop-blur-xl text-white border-t border-brand-800/80 shadow-[0_-8px_30px_rgba(0,0,0,0.4)] safe-bottom"
    >
      <div className="flex items-stretch justify-around h-16 px-1">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'md-ripple flex flex-1 min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl py-1 transition-all duration-200 tap-target',
                isActive ? 'text-brand-400 font-bold' : 'text-slate-300 hover:text-white'
              )}
            >
              {/* Material 3 active indicator: pill behind the icon */}
              <span
                className={cn(
                  'flex h-7 w-12 sm:w-14 items-center justify-center rounded-full transition-all duration-200',
                  isActive
                    ? 'bg-brand-500/25 text-brand-400 shadow-sm'
                    : 'bg-transparent text-slate-300'
                )}
              >
                <Icon
                  className="h-5 w-5 shrink-0 transition-transform active:scale-90"
                  strokeWidth={isActive ? 2.4 : 1.9}
                />
              </span>
              <span
                className={cn(
                  'w-full truncate px-0.5 text-center text-[10px] sm:text-[11px] leading-tight',
                  isActive ? 'font-bold text-white' : 'font-medium text-slate-300'
                )}
              >
                {item.label}
              </span>
              {/* Dot indicator under active icon */}
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-brand-400 mt-0.5" />
              )}
            </Link>
          );
        })}

        {/* Menu drawer trigger button */}
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Ouvrir le menu complet"
          className="md-ripple flex flex-1 min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl py-1 text-slate-300 hover:text-white transition-all duration-200 tap-target"
        >
          <span className="flex h-7 w-12 sm:w-14 items-center justify-center rounded-full bg-transparent text-slate-300 transition-colors">
            <Menu className="h-5 w-5 shrink-0 transition-transform active:scale-90" strokeWidth={1.9} />
          </span>
          <span className="w-full truncate px-0.5 text-center text-[10px] sm:text-[11px] font-medium leading-tight text-slate-300">
            Menu
          </span>
        </button>
      </div>
    </nav>
  );
}
