'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Building2, CreditCard, Menu, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface PlatformBottomNavProps {
  onOpenMobileMenu: () => void;
}

const items = [
  { label: 'Accueil', href: '/platform/dashboard', icon: LayoutDashboard },
  { label: 'Clients', href: '/platform/clients', icon: Building2 },
  { label: 'Abonnements', href: '/platform/subscriptions', icon: CreditCard },
];

/**
 * Next.js stores a monotonically increasing `idx` in each history entry, so
 * `idx > 0` means the router has somewhere to go back to. The snapshot is
 * re-read on every render and the popstate subscription covers back/forward.
 */
function useCanGoBack(): boolean {
  return React.useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener('popstate', onStoreChange);
      return () => window.removeEventListener('popstate', onStoreChange);
    },
    () => ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0,
    () => false
  );
}

export function PlatformBottomNav({ onOpenMobileMenu }: PlatformBottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const canGoBack = useCanGoBack();

  return (
    <nav
      aria-label="Navigation plateforme"
      // Flex child of the locked app shell, not a fixed overlay: it can never
      // scroll away, whatever the content height.
      className="lg:hidden shrink-0 bg-[#0b1a3a] text-white md-elevation-3 safe-bottom"
    >
      <div className="flex items-stretch justify-around h-20 px-1">
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
                'md-ripple flex flex-1 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl py-1.5 transition-colors duration-200',
                isActive ? 'text-amber-400' : 'text-slate-300'
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-16 max-w-full items-center justify-center rounded-full transition-colors duration-200',
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

        {/* Last slot is a back action once the user has drilled in, and falls
            back to the full menu at the entry point of a section. */}
        {canGoBack ? (
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Revenir à la page précédente"
            className="md-ripple flex flex-1 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl py-1.5 text-amber-400 transition-colors duration-200"
          >
            <span className="flex h-8 w-16 max-w-full items-center justify-center rounded-full bg-amber-400/25">
              <ArrowLeft className="h-6 w-6 shrink-0" strokeWidth={2.4} />
            </span>
            <span className="w-full truncate px-0.5 text-center text-[11px] font-semibold leading-4">
              Retour
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Ouvrir le menu complet"
            className="md-ripple flex flex-1 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl py-1.5 text-slate-300 transition-colors duration-200"
          >
            <span className="flex h-8 w-16 max-w-full items-center justify-center rounded-full">
              <Menu className="h-6 w-6 shrink-0" strokeWidth={1.8} />
            </span>
            <span className="w-full truncate px-0.5 text-center text-[11px] font-medium leading-4">
              Menu
            </span>
          </button>
        )}
      </div>
    </nav>
  );
}
