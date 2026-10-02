'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building2, CreditCard } from 'lucide-react';
import { NetworkNavItem } from '@/components/offline/NetworkNavItem';
import { cn } from '@/lib/utils/cn';

const items = [
  { label: 'Accueil', href: '/platform/dashboard', icon: LayoutDashboard },
  { label: 'Clients', href: '/platform/clients', icon: Building2 },
  { label: 'Abonnements', href: '/platform/subscriptions', icon: CreditCard },
];

export function PlatformBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation plateforme"
      // Flex child of the locked app shell, not a fixed overlay: it can never
      // scroll away, whatever the content height.
      className="lg:hidden shrink-0 bg-brand-900 text-white md-elevation-3 safe-bottom"
    >
      <div className="flex items-stretch h-20 pl-1 pr-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== '/platform/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'md-ripple flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-1.5 transition-colors duration-200',
                isActive ? 'text-brand-400' : 'text-slate-300'
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-full max-w-16 items-center justify-center rounded-full transition-colors duration-200',
                  isActive ? 'bg-brand-400/25' : 'bg-transparent'
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

        <NetworkNavItem />
      </div>
    </nav>
  );
}
