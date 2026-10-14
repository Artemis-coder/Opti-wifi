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

const primaryItems = [
  { label: 'Accueil', href: '/dashboard', icon: LayoutDashboard },
  { label: 'POS', href: '/pos', icon: Store },
  { label: 'Tickets', href: '/tickets', icon: Ticket, adminOnly: true },
  { label: 'Collectes', href: '/collections', icon: Receipt },
  { label: 'Espaces', href: '/spaces', icon: MapPin },
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
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-brand-900/95 backdrop-blur-md text-white border-t border-slate-800/80 shadow-[0_-4px_25px_rgba(0,0,0,0.35)] safe-bottom"
    >
      <div className="flex items-stretch justify-around h-16 sm:h-20 px-1">
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
                'md-ripple flex flex-1 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl py-1.5 transition-colors duration-200',
                isActive ? 'text-brand-400' : 'text-slate-300'
              )}
            >
              {/* Material 3 active indicator: 64x32dp pill behind the icon */}
              <span
                className={cn(
                  'flex h-7 w-14 sm:h-8 sm:w-16 max-w-full items-center justify-center rounded-full transition-colors duration-200',
                  isActive ? 'bg-brand-400/25' : 'bg-transparent'
                )}
              >
                <Icon className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" strokeWidth={isActive ? 2.4 : 1.8} />
              </span>
              <span
                className={cn(
                  'w-full truncate px-0.5 text-center text-[10px] sm:text-[11px] leading-3 sm:leading-4',
                  isActive ? 'font-semibold' : 'font-medium'
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Ouvrir le menu complet"
          className="md-ripple flex flex-1 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl py-1.5 text-slate-300 transition-colors duration-200"
        >
          <span className="flex h-7 w-14 sm:h-8 sm:w-16 max-w-full items-center justify-center rounded-full">
            <Menu className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" strokeWidth={1.8} />
          </span>
          <span className="w-full truncate px-0.5 text-center text-[10px] sm:text-[11px] font-medium leading-3 sm:leading-4">
            Menu
          </span>
        </button>
      </div>
    </nav>
  );
}
