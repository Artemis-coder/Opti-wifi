'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Avatar, Button, Dropdown, Label, SearchField, Separator } from '@heroui/react';
import { LogOut, Menu, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { getPlatformPageTitle } from '@/components/platform/PlatformSidebar';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { usePlatformAuthStore } from '@/lib/stores/platformAuthStore';
import { createClient } from '@/lib/supabase/client';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

function initials(name: string): string {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? 'S') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function ConnectionIndicator() {
  const { isOnline, isOffline, isUnstable } = useOnlineStatus();
  if (isOffline) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-danger">
        <WifiOff className="size-3.5" /> Hors ligne
      </span>
    );
  }
  if (isUnstable) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-warning">
        <AlertTriangle className="size-3.5" /> Connexion instable
      </span>
    );
  }
  if (isOnline) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-success">
        <Wifi className="size-3.5" /> En ligne
      </span>
    );
  }
  return null;
}

/** En-tête du back-office : titre de page, recherche client, notifications, compte. */
export function PlatformHeader({ onOpenMobileMenu }: { onOpenMobileMenu?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { platformUser, logout } = usePlatformAuthStore();
  const supabase = createClient();

  const displayName = platformUser?.full_name || platformUser?.email || 'Super admin';
  const roleLabel = platformUser?.role === 'super_admin' ? 'Super administrateur' : 'Support';

  const handleLogout = async () => {
    await supabase.auth.signOut();
    logout();
    router.push('/login');
  };

  const handleSearch = (value: string) => {
    const q = value.trim();
    router.push(q ? `/platform/clients?q=${encodeURIComponent(q)}` : '/platform/clients');
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-separator bg-background/85 px-4 backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {/* Mobile : bouton Menu du modèle HeroUI « Navigation Drawer » */}
        {onOpenMobileMenu && (
          <Button isIconOnly variant="secondary" size="sm" aria-label="Ouvrir le menu" className="shrink-0 lg:hidden" onPress={onOpenMobileMenu}>
            <Menu className="size-4" />
          </Button>
        )}
        <h1 className="truncate text-base font-semibold text-foreground lg:text-lg">{getPlatformPageTitle(pathname)}</h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <SearchField aria-label="Rechercher un client" className="hidden w-64 md:block lg:w-80" onSubmit={handleSearch}>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Rechercher un client…" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>

        <NotificationBell />

        <Dropdown>
          <Dropdown.Trigger
            aria-label="Menu du compte"
            className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Avatar size="sm" color="accent" variant="soft">
              <Avatar.Fallback>{initials(displayName)}</Avatar.Fallback>
            </Avatar>
            <span className="hidden text-left sm:block">
              <span className="block max-w-40 truncate text-sm font-medium text-foreground">{displayName}</span>
              <span className="block text-xs text-muted">{roleLabel}</span>
            </span>
          </Dropdown.Trigger>
          <Dropdown.Popover placement="bottom end" className="min-w-64">
            <div className="px-3 pb-2 pt-3">
              <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
              <p className="text-xs text-muted">{roleLabel}</p>
              <div className="mt-2">
                <ConnectionIndicator />
              </div>
            </div>
            <Separator />
            <Dropdown.Menu
              aria-label="Compte"
              onAction={(key) => {
                if (key === 'logout') void handleLogout();
              }}
            >
              <Dropdown.Item id="logout" textValue="Déconnexion" variant="danger">
                <div className="flex w-full items-center justify-between gap-2">
                  <Label>Déconnexion</Label>
                  <LogOut className="size-3.5 text-danger" />
                </div>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>
    </header>
  );
}
