'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Store, Ticket, Receipt, MapPin } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/authStore';
import { NetworkNavItem } from '@/components/offline/NetworkNavItem';
import { cn } from '@/lib/utils/cn';

const primaryItems = [
  { label: 'Accueil', href: '/dashboard', icon: LayoutDashboard },
  { label: 'POS', href: '/pos', icon: Store },
  { label: 'Tickets', href: '/tickets', icon: Ticket, adminOnly: true },
  { label: 'Collectes', href: '/collections', icon: Receipt },
  { label: 'Espaces', href: '/spaces', icon: MapPin },
];

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuthStore();

  const filteredItems = primaryItems.filter(
    (item) => !item.adminOnly || user?.role === 'administrateur'
  );

  return (
    <nav
      aria-label="Navigation principale"
      // Flex child of the locked app shell, not a fixed overlay: it can never
      // scroll away, whatever the content height.
      className="lg:hidden shrink-0 bg-[#0b1a3a] text-white md-elevation-3 safe-bottom"
    >
      <div className="flex items-stretch h-20 pl-1 pr-1.5">
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
                'md-ripple flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-1.5 transition-colors duration-200',
                isActive ? 'text-amber-400' : 'text-slate-300'
              )}
            >
              {/* Material 3 active indicator: 64x32dp pill behind the icon */}
              <span
                className={cn(
                  'flex h-8 w-full max-w-16 items-center justify-center rounded-full transition-colors duration-200',
                  isActive ? 'bg-amber-400/25' : 'bg-transparent'
                )}
              >
                <Icon className="h-6 w-6 shrink-0" strokeWidth={isActive ? 2.4 : 1.8} />
              </span>
              <span
                className={cn(
                  'w-full truncate px-0.5 text-center text-[11px] leading-4',
                  isActive ? 'font-semibold' : 'font-medium'
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* Trailing network indicator, pinned to the right of the bar. */}
        <NetworkNavItem />
      </div>
    </nav>
  );
}
