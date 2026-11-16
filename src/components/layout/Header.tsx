'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button, Dropdown, Label, Separator } from '@heroui/react';
import { LogOut, Menu, Settings } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { createClient } from '@/lib/supabase/client';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { cn } from '@/lib/utils/cn';

interface HeaderProps {
  onOpenMobileMenu?: () => void;
  title?: string;
}

const TITLES: Record<string, string> = {
  '/dashboard': 'Tableau de bord',
  '/pos': 'Points de vente',
  '/tickets': 'Types de tickets',
  '/spaces': 'Espaces Wi-Fi',
  '/allocations': 'Allocations',
  '/allocations/new': 'Nouvelle allocation',
  '/allocations/exchange': 'Échange de tickets',
  '/collections': 'Collectes',
  '/collections/new': 'Nouvelle collecte',
  '/users': 'Utilisateurs',
  '/reports': 'Rapports',
  '/settings': 'Paramètres',
  '/conditions-utilisation': "Conditions d'utilisation",
  '/subscription': 'Abonnement',
  '/support': 'Support',
};

// Le collecteur ne voit que ses points de vente et ses collectes
const COLLECTOR_TITLES: Record<string, string> = {
  '/dashboard': 'Ma tournée',
  '/pos': 'Mes points de vente',
  '/collections': 'Mes collectes',
  '/allocations': 'Mes allocations',
  '/allocations/new': 'Attribuer des tickets',
};

// Compte point de vente : consultation seule
const POS_ACCOUNT_TITLES: Record<string, string> = {
  '/dashboard': 'Mon point de vente',
  '/collections': 'Mes collectes',
  '/allocations': 'Mes allocations',
  '/commissions': 'Mes commissions',
};

function resolveTitle(pathname: string, isCollector: boolean, isPosAccount = false): string {
  if (isPosAccount && POS_ACCOUNT_TITLES[pathname]) return POS_ACCOUNT_TITLES[pathname];
  if (isCollector && COLLECTOR_TITLES[pathname]) return COLLECTOR_TITLES[pathname];
  if (TITLES[pathname]) return TITLES[pathname];
  const match = Object.keys(TITLES)
    .filter((path) => path.includes('[') === false && pathname.startsWith(path))
    .sort((a, b) => b.length - a.length)[0];
  if (match) return TITLES[match];
  if (pathname.startsWith('/pos/')) return 'Détail du point de vente';
  if (pathname.startsWith('/spaces/')) return 'Espace Wi-Fi';
  return 'OptiSpace';
}

export function Header({ title, onOpenMobileMenu }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const heading = title ?? resolveTitle(pathname ?? '/', user?.role === 'collecteur', user?.role === 'point_de_vente');
  const { isOnline, isOffline, isUnstable } = useOnlineStatus();

  const roleLabel = user?.role === 'administrateur' ? 'Administrateur' : user?.role === 'point_de_vente' ? 'Point de vente' : 'Collecteur';
  const connection = isOffline
    ? { dot: 'bg-danger', label: 'Hors ligne', text: 'text-danger' }
    : isUnstable
      ? { dot: 'bg-warning', label: 'Connexion instable', text: 'text-muted' }
      : isOnline
        ? { dot: 'bg-success', label: 'En ligne', text: 'text-muted' }
        : null;

  const handleLogout = async () => {
    await createClient().auth.signOut();
    logout();
    router.push('/login');
  };

  return (
    <header className="safe-top sticky top-0 z-30 border-b border-separator bg-background/85 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {/* Mobile : bouton Menu du modèle HeroUI « Navigation Drawer » */}
          {onOpenMobileMenu && (
            <Button isIconOnly variant="secondary" size="sm" aria-label="Ouvrir le menu" className="shrink-0 lg:hidden" onPress={onOpenMobileMenu}>
              <Menu className="size-4" />
            </Button>
          )}
          <h1 className="min-w-0 truncate text-base font-semibold text-foreground lg:text-lg">{heading}</h1>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {/* Hors ligne : toujours visible, c'est une information qui change ce que l'on peut faire */}
          {connection && isOffline && (
            <span role="status" className="flex items-center gap-1.5 rounded-full bg-danger-soft px-2.5 py-1 text-xs font-medium text-danger">
              <span className="size-2 rounded-full bg-danger" />
              Hors ligne
            </span>
          )}
          <NotificationBell />

          {user && (
            <Dropdown>
              <Dropdown.Trigger
                aria-label="Menu du compte"
                className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <UserAvatar name={user.nom} email={user.email} />
                <span className="hidden text-left sm:block">
                  <span className="block max-w-40 truncate text-sm font-medium text-foreground">{user.nom || 'Utilisateur'}</span>
                  <span className="block text-xs text-muted">{roleLabel}</span>
                </span>
              </Dropdown.Trigger>
              <Dropdown.Popover placement="bottom end" className="min-w-64">
                <div className="px-3 pb-2 pt-3">
                  <p className="truncate text-sm font-medium text-foreground">{user.nom || 'Utilisateur'}</p>
                  <p className="truncate text-xs text-muted">{user.email || roleLabel}</p>
                  {connection && (
                    <p className={cn('mt-2 flex items-center gap-1.5 text-xs', connection.text)}>
                      <span className={cn('size-2 rounded-full', connection.dot)} />
                      {connection.label}
                    </p>
                  )}
                </div>
                <Separator />
                <Dropdown.Menu
                  aria-label="Compte"
                  onAction={(key) => {
                    if (key === 'settings') router.push('/settings');
                    if (key === 'logout') void handleLogout();
                  }}
                >
                  <Dropdown.Item id="settings" textValue="Paramètres">
                    <div className="flex w-full items-center justify-between gap-2">
                      <Label>Paramètres</Label>
                      <Settings className="size-3.5 text-muted" />
                    </div>
                  </Dropdown.Item>
                  <Dropdown.Item id="logout" textValue="Déconnexion" variant="danger">
                    <div className="flex w-full items-center justify-between gap-2">
                      <Label>Déconnexion</Label>
                      <LogOut className="size-3.5 text-danger" />
                    </div>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          )}
        </div>
      </div>
    </header>
  );
}
