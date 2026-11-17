'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Store,
  Ticket,
  ArrowLeftRight,
  Receipt,
  FileSpreadsheet,
  Users,
  Settings,
  LogOut,
  MapPin,
  CreditCard,
  LifeBuoy,
  PlusCircle,
  Repeat,
  ClipboardCheck,
  FileText,
  Coins,
} from 'lucide-react';
import { useAuthStore } from '@/lib/stores/authStore';
import { createClient } from '@/lib/supabase/client';
import { Drawer, ScrollShadow } from '@heroui/react';
import { cn } from '@/lib/utils/cn';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { PlanBadge } from '@/components/layout/PlanBadge';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { confirmLogout } from '@/components/ui/ConfirmDialog';

interface SidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface NavSection {
  title: string;
  items: {
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    roles: string[];
    badge?: string;
  }[];
}

const navSections: NavSection[] = [
  {
    title: 'Vue d’ensemble',
    items: [
      { label: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard, roles: ['administrateur', 'collecteur'] },
      { label: 'Points de Vente', href: '/pos', icon: Store, roles: ['administrateur', 'collecteur'] },
      { label: 'Espaces Wi-Fi', href: '/spaces', icon: MapPin, roles: ['administrateur'] },
    ],
  },
  {
    title: 'Opérations & Ventes',
    items: [
      { label: 'Allocations Tickets', href: '/allocations', icon: ArrowLeftRight, roles: ['administrateur'] },
      { label: 'Collectes & Caisses', href: '/collections', icon: Receipt, roles: ['administrateur', 'collecteur'] },
      { label: 'Types de Tickets', href: '/tickets', icon: Ticket, roles: ['administrateur'] },
      { label: 'Corrections à valider', href: '/change-requests', icon: ClipboardCheck, roles: ['administrateur'] },
    ],
  },
  {
    title: 'Gestion & Système',
    items: [
      { label: 'Rapports & Exports', href: '/reports', icon: FileSpreadsheet, roles: ['administrateur'] },
      { label: 'Utilisateurs & Équipe', href: '/users', icon: Users, roles: ['administrateur'] },
      { label: 'Abonnement', href: '/subscription', icon: CreditCard, roles: ['administrateur'] },
      { label: 'Support', href: '/support', icon: LifeBuoy, roles: ['administrateur', 'collecteur'] },
      { label: "Conditions d'utilisation", href: '/conditions-utilisation', icon: FileText, roles: ['administrateur', 'collecteur'] },
      { label: 'Paramètres', href: '/settings', icon: Settings, roles: ['administrateur', 'collecteur'] },
    ],
  },
];

// Espace collecteur : sa tournée, ses points de vente et ses collectes
const collectorSections: NavSection[] = [
  {
    title: 'Ma tournée',
    items: [
      { label: 'Ma tournée', href: '/dashboard', icon: LayoutDashboard, roles: ['collecteur'] },
      { label: 'Mes points de vente', href: '/pos', icon: Store, roles: ['collecteur'] },
    ],
  },
  {
    title: 'Tickets',
    items: [
      { label: 'Attribuer des tickets', href: '/allocations/new', icon: PlusCircle, roles: ['collecteur'] },
      { label: 'Échange de tickets', href: '/allocations/exchange', icon: Repeat, roles: ['collecteur'] },
      { label: 'Mes allocations', href: '/allocations', icon: ArrowLeftRight, roles: ['collecteur'] },
    ],
  },
  {
    title: 'Encaissements',
    items: [
      { label: 'Nouvelle collecte', href: '/collections/new', icon: PlusCircle, roles: ['collecteur'] },
      { label: 'Mes collectes', href: '/collections', icon: Receipt, roles: ['collecteur'] },
      { label: 'Mes corrections', href: '/change-requests', icon: ClipboardCheck, roles: ['collecteur'] },
    ],
  },
  {
    title: 'Compte',
    items: [
      { label: 'Support', href: '/support', icon: LifeBuoy, roles: ['collecteur'] },
      { label: "Conditions d'utilisation", href: '/conditions-utilisation', icon: FileText, roles: ['collecteur'] },
      { label: 'Paramètres', href: '/settings', icon: Settings, roles: ['collecteur'] },
    ],
  },
];

// Compte « point de vente » : consultation seule de ses allocations et de ses collectes
const posAccountSections: NavSection[] = [
  {
    title: 'Mon point de vente',
    items: [
      { label: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard, roles: ['point_de_vente'] },
      { label: 'Mes allocations', href: '/allocations', icon: ArrowLeftRight, roles: ['point_de_vente'] },
      { label: 'Mes collectes', href: '/collections', icon: Receipt, roles: ['point_de_vente'] },
      { label: 'Mes commissions', href: '/commissions', icon: Coins, roles: ['point_de_vente'] },
    ],
  },
  {
    title: 'Compte',
    items: [
      { label: 'Support', href: '/support', icon: LifeBuoy, roles: ['point_de_vente'] },
      { label: "Conditions d'utilisation", href: '/conditions-utilisation', icon: FileText, roles: ['point_de_vente'] },
      { label: 'Paramètres', href: '/settings', icon: Settings, roles: ['point_de_vente'] },
    ],
  },
];

export function Sidebar({ isMobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const supabase = createClient();
  const { isOnline, isOffline, isUnstable } = useOnlineStatus();

  const handleLogout = async () => {
    // Menu mobile fermé d'abord : la question s'affiche seule à l'écran
    if (onCloseMobile) onCloseMobile();
    if (!(await confirmLogout())) return;
    await supabase.auth.signOut();
    logout();
    router.push('/login');
  };

  const isAdmin = user?.role === 'administrateur';
  const isPosAccount = user?.role === 'point_de_vente';
  const roleLabel = isAdmin ? 'Administrateur' : isPosAccount ? 'Point de vente' : 'Collecteur';

  // Sections visibles selon le rôle
  const filteredSections = (
    user?.role === 'collecteur' ? collectorSections : isPosAccount ? posAccountSections : navSections
  )
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !user?.role || item.roles.includes(user.role)),
    }))
    .filter((section) => section.items.length > 0);

  // Entrée la plus précise : « Nouvelle collecte » ne rend pas « Mes collectes » actif
  const matches = (href: string) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));
  const isActive = (href: string) =>
    matches(href) && !filteredSections.some((s) => s.items.some((o) => o.href.length > href.length && matches(o.href)));

  const connection = isOffline
    ? { dot: 'bg-danger', label: 'Hors ligne' }
    : isUnstable
      ? { dot: 'bg-warning', label: 'Connexion instable' }
      : isOnline
        ? { dot: 'bg-success', label: 'En ligne' }
        : null;

  const brand = (
    <div className="flex min-w-0 items-center gap-3">
      <span className="relative size-9 shrink-0 overflow-hidden rounded-xl bg-surface-secondary">
        <Image src="/assets/logo.jpg" alt="" width={36} height={36} className="object-cover" priority />
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-foreground">OptiSpace</p>
          {/* Forfait de l'organisation : Essai, Déco, Standard ou Pro */}
          <PlanBadge userId={user?.id} />
        </div>
        <p className="truncate text-xs text-muted">Espace {roleLabel.toLowerCase()}</p>
      </div>
    </div>
  );

  const account = (
    <div className="flex items-center gap-3 rounded-xl bg-surface-secondary p-3">
      <UserAvatar name={user?.nom} email={user?.email} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{user?.nom || 'Utilisateur'}</p>
        <p className="flex items-center gap-1.5 truncate text-xs text-muted">
          {roleLabel}
          {connection && (
            <>
              <span aria-hidden>·</span>
              <span className={cn('size-1.5 shrink-0 rounded-full', connection.dot)} />
              <span className="truncate">{connection.label}</span>
            </>
          )}
        </p>
      </div>
    </div>
  );

  const nav = (onNavigate?: () => void) => (
    <nav aria-label="Navigation principale" className="flex flex-col gap-4">
      {filteredSections.map((section) => (
        <div key={section.title} className="flex flex-col gap-0.5">
          <p className="px-3 pb-1 text-xs font-medium text-muted">{section.title}</p>
          {section.items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                data-tour={`nav:${item.href}`}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground outline-none transition-colors hover:bg-default',
                  'focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                  active && 'bg-default font-medium'
                )}
              >
                <Icon className={cn('size-5 shrink-0', active ? 'text-foreground' : 'text-muted')} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  const logoutButton = (
    <button
      type="button"
      onClick={handleLogout}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-danger outline-none transition-colors hover:bg-danger-soft focus-visible:ring-2 focus-visible:ring-focus"
    >
      <LogOut className="size-5 shrink-0" />
      Déconnexion
    </button>
  );

  return (
    <>
      {/* Bureau : colonne fixe */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-separator bg-surface lg:flex">
        <div className="flex h-16 shrink-0 items-center px-5">{brand}</div>
        <ScrollShadow className="flex-1 px-3 pb-4 pt-2" hideScrollBar>
          {nav()}
        </ScrollShadow>
        <div className="shrink-0 space-y-1 border-t border-separator p-3">
          {account}
          {logoutButton}
        </div>
      </aside>

      {/* Mobile : tiroir HeroUI depuis le bas (comme le back-office), avec poignée */}
      <Drawer.Backdrop
        isOpen={isMobileOpen}
        onOpenChange={(open) => {
          if (!open) onCloseMobile?.();
        }}
        className="lg:hidden"
      >
        <Drawer.Content placement="bottom">
          <Drawer.Dialog aria-label="Menu de navigation" className="max-h-[88vh]">
            <Drawer.Handle />
            <Drawer.CloseTrigger aria-label="Fermer le menu" />
            <Drawer.Header>{brand}</Drawer.Header>
            <Drawer.Body className="space-y-4">
              {account}
              {nav(onCloseMobile)}
            </Drawer.Body>
            <Drawer.Footer className="safe-bottom">{logoutButton}</Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </>
  );
}
