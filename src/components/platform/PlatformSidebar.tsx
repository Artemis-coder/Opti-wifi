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

  const content = (
    <aside className="bg-[#0b1a3a] text-white flex flex-col h-full border-r border-slate-800 shadow-xl">
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg overflow-hidden relative bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
            <Image src="/assets/logo.jpg" alt="OptiWifi Logo" width={36} height={36} className="object-cover" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-wide">👑 Super Admin</h1>
            <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">Back-Office SaaS</p>
          </div>
        </div>
        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
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
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
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
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              )}
            >
              <Icon className={cn('w-5 h-5', isActive ? 'text-slate-950' : 'text-slate-400')} />
              <span>{group.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs border border-amber-500/30">
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
              <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">
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

      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs animate-in fade-in"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 w-screen h-[90vh] max-h-[90vh] mt-auto mx-0 mb-0 animate-in slide-in-from-bottom duration-200 rounded-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
              <div className="flex-1 flex justify-center">
                <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
              </div>
              <button
                onClick={onCloseMobile}
                className="ml-4 p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
                aria-label="Fermer le menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {content}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
