'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Receipt,
  Wallet,
  FileText,
  Users,
  BarChart3,
  Bell,
  Settings,
  History,
  LifeBuoy,
  X,
  LogOut,
  User as UserIcon,
  Wifi,
  WifiOff,
  AlertTriangle,
} from 'lucide-react';
import { usePlatformAuthStore } from '@/lib/stores/platformAuthStore';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils/cn';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { BottomSheetMenu } from '@/components/ui/BottomSheetMenu';
import { NavAccount, NavAction, NavRow, NavSection, type NavTone } from '@/components/ui/NavSheet';

interface SidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const sidebarItems = [
  { label: 'Dashboard', href: '/platform/dashboard', icon: LayoutDashboard },
  {
    section: 'CLIENTS',
    items: [
      { label: 'Tous les clients', href: '/platform/clients', icon: Building2 },
    ],
  },
  {
    section: 'ABONNEMENTS',
    items: [
      { label: 'Tous les abonnements', href: '/platform/subscriptions', icon: Receipt },
      { label: 'Plans tarifaires', href: '/platform/plans', icon: Wallet },
      { label: 'Expirations', href: '/platform/subscriptions/expiring', icon: History },
    ],
  },
  {
    section: 'PAIEMENTS',
    items: [
      { label: 'Transactions', href: '/platform/payments', icon: Receipt },
      { label: 'Factures', href: '/platform/invoices', icon: FileText },
    ],
  },
  {
    section: 'AUTRES',
    items: [
      { label: 'Utilisateurs', href: '/platform/users', icon: Users },
      { label: 'Rapports', href: '/platform/reports', icon: BarChart3 },
      { label: 'Notifications', href: '/platform/notifications', icon: Bell },
      { label: 'Journal d\'audit', href: '/platform/audit-logs', icon: History },
      { label: 'Support', href: '/platform/support', icon: LifeBuoy },
      { label: 'Paramètres', href: '/platform/settings', icon: Settings },
    ],
  },
];

export function PlatformSidebar({ isMobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const { platformUser, logout } = usePlatformAuthStore();
  const router = useRouter();
  const supabase = createClient();
  const { isOnline, isOffline, isUnstable } = useOnlineStatus();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    logout();
    router.push('/platform/login');
  };

  const row = (
    href: string,
    label: string,
    icon: React.ComponentType<{ className?: string }>,
    tone: NavTone
  ) => (
    <NavRow
      href={href}
      label={label}
      icon={icon}
      tone={tone}
      active={pathname === href || pathname.startsWith(href + '/')}
      onNavigate={() => onCloseMobile?.()}
    />
  );

  const content = (
    <aside className="bg-brand-900 text-white flex flex-col h-full border-r border-brand-800 shadow-xl">
      <div className="h-16 flex items-center justify-between gap-2 px-4 sm:px-6 border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 shrink-0 rounded-lg overflow-hidden relative bg-brand-500/20 border border-brand-500/30 flex items-center justify-center">
            <Image src="/assets/platform-logo.jpg" alt="OptiWifi Platform Logo" width={36} height={36} className="object-cover" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-base sm:text-lg leading-tight tracking-wide truncate">👑 Super Admin</h1>
            <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase truncate">
              Back-Office SaaS
            </p>
          </div>
        </div>
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

      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {sidebarItems.map((group) => {
          if ('section' in group) {
            return (
              <div key={group.section} className="space-y-1">
                <p className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  {group.section}
                </p>
                {group.items!.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onCloseMobile}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition duration-150',
                        isActive
                          ? 'bg-brand-500 text-slate-950 font-bold shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                      )}
                    >
                      <Icon className={cn('w-5 h-5', isActive ? 'text-slate-950' : 'text-slate-400')} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          }
          const Icon = group.icon;
          const isActive = pathname === group.href || pathname.startsWith(group.href + '/');
          return (
            <Link
              key={group.href}
              href={group.href}
              onClick={onCloseMobile}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition duration-150',
                isActive
                  ? 'bg-brand-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              )}
            >
              <Icon className={cn('w-5 h-5', isActive ? 'text-slate-950' : 'text-slate-400')} />
              <span>{group.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10 bg-black/20 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-xs border border-brand-500/30">
            <UserIcon className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2 overflow-hidden">
            {isOffline && <WifiOff className="w-4 h-4 text-red-500 shrink-0" />}
            {isUnstable && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
            {isOnline && <Wifi className="w-4 h-4 text-emerald-500 shrink-0" />}
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-white truncate">
                {platformUser?.full_name || platformUser?.email || 'Super Admin'}
              </p>
              <p className="text-[10px] text-brand-400 font-semibold uppercase tracking-wider">
                {platformUser?.role || 'super_admin'}
              </p>
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
      <div className="hidden lg:block sticky top-0 h-screen shrink-0 w-64 overflow-y-auto">
        {content}
      </div>

      <BottomSheetMenu
        open={isMobileOpen}
        onClose={() => onCloseMobile?.()}
        title="Menu Plateforme"
      >
        <NavAccount
          name={platformUser?.full_name || platformUser?.email || 'Super Admin'}
          role={platformUser?.role || 'super_admin'}
          online={isOnline}
          offline={isOffline}
          unstable={isUnstable}
          avatar={<UserIcon className="h-6 w-6" />}
        />

        <NavSection title="Pilotage">
          {row('/platform/dashboard', 'Dashboard', LayoutDashboard, 'blue')}
        </NavSection>

        <NavSection title="Clients">
          {row('/platform/clients', 'Tous les clients', Building2, 'blue')}
        </NavSection>

        <NavSection title="Abonnements">
          {row('/platform/subscriptions', 'Tous les abonnements', Receipt, 'brand')}
          {row('/platform/plans', 'Plans tarifaires', Wallet, 'purple')}
          {row('/platform/subscriptions/expiring', 'Expirations', History, 'red')}
        </NavSection>

        <NavSection title="Paiements">
          {row('/platform/payments', 'Transactions', Receipt, 'emerald')}
          {row('/platform/invoices', 'Factures', FileText, 'slate')}
        </NavSection>

        <NavSection title="Autres">
          {row('/platform/users', 'Utilisateurs', Users, 'blue')}
          {row('/platform/reports', 'Rapports', BarChart3, 'emerald')}
          {row('/platform/notifications', 'Notifications', Bell, 'brand')}
          {row('/platform/audit-logs', "Journal d'audit", History, 'slate')}
          {row('/platform/support', 'Support', LifeBuoy, 'purple')}
          {row('/platform/settings', 'Paramètres', Settings, 'slate')}
        </NavSection>

        <NavSection>
          <NavAction label="Se déconnecter" icon={LogOut} onClick={handleLogout} />
        </NavSection>
      </BottomSheetMenu>
    </>
  );
}
