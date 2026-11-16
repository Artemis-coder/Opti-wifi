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
  PlusCircle,
  Coins,
} from 'lucide-react';
import { useAuthStore } from '@/lib/stores/authStore';
import { cn } from '@/lib/utils/cn';

export interface BottomNavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  adminOnly?: boolean;
  /** Actif uniquement sur l'adresse exacte (page d'accueil d'un espace). */
  exact?: boolean;
}

interface BottomNavProps {
  onOpenMobileMenu: () => void;
  /** Entrées de la barre ; par défaut celles de l'espace client. */
  items?: BottomNavItem[];
}

const primaryItems: BottomNavItem[] = [
  { label: 'Accueil', href: '/dashboard', icon: LayoutDashboard, exact: true },
  { label: 'POS', href: '/pos', icon: Store },
  { label: 'Collectes', href: '/collections', icon: Receipt },
  { label: 'Allocations', href: '/allocations', icon: ArrowLeftRight, adminOnly: true },
];

// Barre du collecteur : la saisie d'une collecte au centre, à portée de pouce
const collectorItems: BottomNavItem[] = [
  { label: 'Tournée', href: '/dashboard', icon: LayoutDashboard, exact: true },
  { label: 'Mes POS', href: '/pos', icon: Store },
  { label: 'Collecter', href: '/collections/new', icon: PlusCircle, exact: true },
  { label: 'Collectes', href: '/collections', icon: Receipt },
];

// Barre d'un compte point de vente (consultation seule)
const posAccountItems: BottomNavItem[] = [
  { label: 'Accueil', href: '/dashboard', icon: LayoutDashboard, exact: true },
  { label: 'Allocations', href: '/allocations', icon: ArrowLeftRight },
  { label: 'Collectes', href: '/collections', icon: Receipt },
  { label: 'Commissions', href: '/commissions', icon: Coins },
];

export function BottomNav({ onOpenMobileMenu, items }: BottomNavProps) {
  const pathname = usePathname();
  const { user } = useAuthStore();

  const defaultItems =
    user?.role === 'collecteur' ? collectorItems : user?.role === 'point_de_vente' ? posAccountItems : primaryItems;
  const filteredItems = (items ?? defaultItems).filter(
    (item) => !item.adminOnly || user?.role === 'administrateur'
  );

  const itemClass =
    'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] outline-none transition-colors tap-target focus-visible:ring-2 focus-visible:ring-focus';

  return (
    <nav
      aria-label="Navigation principale mobile"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-separator bg-surface/95 backdrop-blur-md lg:hidden"
    >
      <div className="flex h-16 items-stretch gap-1 px-2">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const matches = (it: BottomNavItem) =>
            pathname === it.href || (!it.exact && pathname.startsWith(it.href + '/'));
          // Une entrée plus précise l'emporte (« Collecter » plutôt que « Collectes » sur /collections/new)
          const isActive =
            matches(item) && !filteredItems.some((o) => o.href.length > item.href.length && pathname === o.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour={`nav:${item.href}`}
              aria-current={isActive ? 'page' : undefined}
              className={cn(itemClass, isActive ? 'font-medium text-accent' : 'text-muted hover:text-foreground')}
            >
              <span className={cn('flex h-7 w-12 items-center justify-center rounded-full transition-colors', isActive && 'bg-accent-soft')}>
                <Icon className="size-5 shrink-0" strokeWidth={isActive ? 2.2 : 1.8} />
              </span>
              <span className="w-full truncate px-0.5 text-center leading-tight">{item.label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={onOpenMobileMenu}
          data-tour="nav:menu"
          aria-label="Ouvrir le menu complet"
          className={cn(itemClass, 'text-muted hover:text-foreground')}
        >
          <span className="flex h-7 w-12 items-center justify-center rounded-full">
            <Menu className="size-5 shrink-0" strokeWidth={1.8} />
          </span>
          <span className="leading-tight">Menu</span>
        </button>
      </div>
    </nav>
  );
}
