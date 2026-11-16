'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { BottomNavItem } from '@/components/layout/BottomNav';

interface PlatformBottomNavProps {
  items: BottomNavItem[];
  onOpenMobileMenu: () => void;
}

const itemClass =
  'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] outline-none transition-colors tap-target focus-visible:ring-2 focus-visible:ring-focus';

/** Barre de navigation mobile du back-office (thème HeroUI). */
export function PlatformBottomNav({ items, onOpenMobileMenu }: PlatformBottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation principale mobile"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-separator bg-surface/95 backdrop-blur-md lg:hidden"
    >
      <div className="flex h-16 items-stretch gap-1 px-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (!item.exact && pathname.startsWith(item.href + '/'));
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(itemClass, active ? 'font-medium text-accent' : 'text-muted hover:text-foreground')}
            >
              <span
                className={cn(
                  'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                  active && 'bg-accent-soft'
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
              </span>
              <span className="w-full truncate px-0.5 text-center leading-tight">{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Ouvrir le menu complet"
          className={cn(itemClass, 'text-muted hover:text-foreground')}
        >
          <span className="flex h-7 w-12 items-center justify-center rounded-full">
            <Menu className="size-5" strokeWidth={1.8} />
          </span>
          <span className="leading-tight">Menu</span>
        </button>
      </div>
    </nav>
  );
}
