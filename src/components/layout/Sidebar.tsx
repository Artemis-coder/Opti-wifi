'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Store,
  Ticket,
  ArrowLeftRight,
  Receipt,
  FileSpreadsheet,
  Users,
  Settings,
  X,
  LogOut,
  User as UserIcon,
  MapPin,
  Wifi,
  WifiOff,
  AlertTriangle,
  CreditCard,
} from 'lucide-react';
import { useAuthStore } from '@/lib/stores/authStore';
import { useSpaceStore } from '@/lib/stores/spaceStore';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { BottomSheetMenu } from '@/components/ui/BottomSheetMenu';
import { NavAccount, NavAction, NavRow, NavSection, type NavTone } from '@/components/ui/NavSheet';

interface SidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ isMobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const supabase = createClient();
  const { status, isOnline, isOffline, isUnstable } = useOnlineStatus();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    logout();
    router.push('/login');
  };

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['administrateur', 'collecteur'] },
    { label: 'Espaces Wi-Fi', href: '/spaces', icon: MapPin, roles: ['administrateur'] },
    { label: 'Points de Vente', href: '/pos', icon: Store, roles: ['administrateur', 'collecteur'] },
    { label: 'Types de Tickets', href: '/tickets', icon: Ticket, roles: ['administrateur'] },
    { label: 'Allocations', href: '/allocations', icon: ArrowLeftRight, roles: ['administrateur'] },
    { label: 'Collectes & Caisses', href: '/collections', icon: Receipt, roles: ['administrateur', 'collecteur'] },
    { label: 'Rapports & Exports', href: '/reports', icon: FileSpreadsheet, roles: ['administrateur'] },
    { label: 'Utilisateurs', href: '/users', icon: Users, roles: ['administrateur'] },
    { label: 'Abonnement', href: '/subscription', icon: CreditCard, roles: ['administrateur'] },
    { label: 'Paramètres', href: '/settings', icon: Settings, roles: ['administrateur', 'collecteur'] },
  ];

  const filteredNav = navItems.filter((item) => !user?.role || item.roles.includes(user.role));

  // La feuille mobile reprend la meme liste, mais en groupes façon Réglages iOS
  // et sans les entrées interdites au rôle courant.
  const allowed = (href: string) => {
    const item = navItems.find((n) => n.href === href);
    return !item || !user?.role || item.roles.includes(user.role);
  };

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  const posRow = (
    href: string,
    label: string,
    icon: React.ComponentType<{ className?: string }>,
    tone: NavTone
  ) =>
    allowed(href) ? (
      <NavRow
        href={href}
        label={label}
        icon={icon}
        tone={tone}
        active={isActive(href)}
        onNavigate={() => onCloseMobile?.()}
      />
    ) : null;

  const content = (
    <aside className="bg-[#0b1a3a] text-white flex flex-col h-full border-r border-slate-800 shadow-xl">
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between gap-2 px-4 sm:px-6 border-b border-slate-800/80">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 shrink-0 rounded-lg overflow-hidden relative bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
            <Image src="/assets/logo.jpg" alt="OptiWifi Logo" width={36} height={36} className="object-cover" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-base sm:text-lg leading-tight tracking-wide text-white truncate">
              👑 Espace Administrateur
            </h1>
            <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase truncate">
              Gestion Tickets
            </p>
          </div>
        </div>

        {/* Close Button on Mobile Drawer */}
        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="md-ripple tap-target lg:hidden shrink-0 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
            aria-label="Fermer le menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {filteredNav.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onCloseMobile}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'md-ripple flex items-center gap-3 min-h-12 px-3 rounded-2xl text-sm font-medium transition-colors duration-150',
                isActive
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              )}
            >
              <Icon className={cn('w-5 h-5 shrink-0', isActive ? 'text-slate-950' : 'text-slate-400')} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Role Badge Footer & Mobile Logout */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs border border-amber-500/30">
            <UserIcon className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2 overflow-hidden">
            {isOffline && <span title="Hors ligne"><WifiOff className="w-4 h-4 text-red-500 shrink-0" /></span>}
            {isUnstable && <span title="Connexion instable"><AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" /></span>}
            {isOnline && <span title="En ligne"><Wifi className="w-4 h-4 text-emerald-500 shrink-0" /></span>}
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-white truncate">{user?.nom || 'Compte Utilisateur'}</p>
              <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">{user?.role || 'Collecteur'}</p>
            </div>
          </div>
        </div>

        {onCloseMobile && (
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold text-red-400 bg-red-950/30 border border-red-900/50 hover:bg-red-900/40 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Déconnexion</span>
          </button>
        )}
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block sticky top-0 h-screen shrink-0 w-64">
        {content}
      </div>

      {/* Mobile: feuille du bas, avec paliers et glissement, facon iOS */}
      <BottomSheetMenu
        open={isMobileOpen}
        onClose={() => onCloseMobile?.()}
        title="Menu"
      >
        <NavAccount
          name={user?.nom || 'Compte Utilisateur'}
          role={user?.role || 'Collecteur'}
          online={isOnline}
          offline={isOffline}
          unstable={isUnstable}
          avatar={<UserIcon className="h-6 w-6" />}
        />

        <NavSection title="Pilotage">
          <NavRow
            href="/dashboard"
            label="Dashboard"
            icon={LayoutDashboard}
            tone="blue"
            active={isActive('/dashboard')}
            onNavigate={() => onCloseMobile?.()}
          />
        </NavSection>

        <NavSection title="Réseau">
          {posRow('/spaces', 'Espaces Wi-Fi', MapPin, 'emerald')}
          {posRow('/pos', 'Points de Vente', Store, 'amber')}
        </NavSection>

        <NavSection title="Stock & Caisses">
          {posRow('/tickets', 'Types de Tickets', Ticket, 'purple')}
          {posRow('/allocations', 'Allocations', ArrowLeftRight, 'amber')}
          {posRow('/collections', 'Collectes & Caisses', Receipt, 'emerald')}
        </NavSection>

        <NavSection title="Administration">
          {posRow('/reports', 'Rapports & Exports', FileSpreadsheet, 'blue')}
          {posRow('/users', 'Utilisateurs', Users, 'slate')}
          {posRow('/subscription', 'Abonnement', CreditCard, 'purple')}
          {posRow('/settings', 'Paramètres', Settings, 'slate')}
        </NavSection>

        <NavSection>
          <NavAction label="Se déconnecter" icon={LogOut} onClick={handleLogout} />
        </NavSection>
      </BottomSheetMenu>
    </>
  );
}
