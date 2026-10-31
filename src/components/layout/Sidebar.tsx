'use client';

import React, { useEffect } from 'react';
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
  X,
  LogOut,
  User as UserIcon,
  MapPin,
  Wifi,
  WifiOff,
  AlertTriangle,
  CreditCard,
  ChevronRight,
  ShieldCheck,
  LifeBuoy,
  PlusCircle,
  Repeat,
} from 'lucide-react';
import { useAuthStore } from '@/lib/stores/authStore';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils/cn';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

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
    ],
  },
  {
    title: 'Gestion & Système',
    items: [
      { label: 'Rapports & Exports', href: '/reports', icon: FileSpreadsheet, roles: ['administrateur'] },
      { label: 'Utilisateurs & Équipe', href: '/users', icon: Users, roles: ['administrateur'] },
      { label: 'Abonnement', href: '/subscription', icon: CreditCard, roles: ['administrateur'] },
      { label: 'Support', href: '/support', icon: LifeBuoy, roles: ['administrateur', 'collecteur'] },
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
    ],
  },
  {
    title: 'Compte',
    items: [
      { label: 'Support', href: '/support', icon: LifeBuoy, roles: ['collecteur'] },
      { label: 'Paramètres', href: '/settings', icon: Settings, roles: ['collecteur'] },
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
    if (onCloseMobile) onCloseMobile();
    await supabase.auth.signOut();
    logout();
    router.push('/login');
  };

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && onCloseMobile) onCloseMobile();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isMobileOpen, onCloseMobile]);

  const isAdmin = user?.role === 'administrateur';

  // Filter sections by user role
  const filteredSections = (user?.role === 'collecteur' ? collectorSections : navSections)
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !user?.role || item.roles.includes(user.role)),
    }))
    .filter((section) => section.items.length > 0);

  // Reusable Nav Content
  const renderNavContent = (isMobile: boolean = false) => (
    <div className="flex flex-col h-full bg-brand-950 text-white select-none">
      {/* Brand Header */}
      <div className="h-16 shrink-0 flex items-center justify-between gap-3 px-4 sm:px-5 border-b border-brand-800/80 bg-brand-950/80 backdrop-blur-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 shrink-0 rounded-xl overflow-hidden relative bg-brand-500/20 border border-brand-500/40 flex items-center justify-center shadow-inner">
            <Image
              src="/assets/logo.jpg"
              alt="OptiSpace Logo"
              width={40}
              height={40}
              className="object-cover"
              priority
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="font-bold text-base leading-tight tracking-wide text-white truncate">
                OptiSpace
              </h2>
              {isAdmin && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  PRO
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-medium tracking-wide truncate">
              {isAdmin ? 'Espace Administrateur' : 'Espace Collecteur'}
            </p>
          </div>
        </div>

        {/* Close Button on Mobile Drawer */}
        {isMobile && onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="md-ripple tap-target w-10 h-10 shrink-0 rounded-full bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition"
            aria-label="Fermer le menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* User Status Card (especially prominent on mobile drawer) */}
      <div className="p-3 mx-3 my-2 rounded-2xl bg-brand-900/50 border border-brand-800/60 flex items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center justify-center font-bold text-xs shrink-0">
            {isAdmin ? <ShieldCheck className="w-5 h-5 text-amber-400" /> : <UserIcon className="w-5 h-5 text-brand-400" />}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-white truncate">
              {user?.nom || 'Utilisateur'}
            </p>
            <p className="text-[10px] font-semibold text-brand-400 uppercase tracking-wider truncate">
              {isAdmin ? 'Administrateur' : 'Collecteur'}
            </p>
          </div>
        </div>

        {/* Network indicator pill */}
        <div className="shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-900/60 border border-slate-700/60 text-[10px] font-medium">
          {isOnline && (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-300 hidden xs:inline">En ligne</span>
            </>
          )}
          {isUnstable && (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-amber-300 hidden xs:inline">Instable</span>
            </>
          )}
          {isOffline && (
            <>
              <span className="w-2 h-2 rounded-full bg-red-400" />
              <span className="text-red-300 hidden xs:inline">Hors ligne</span>
            </>
          )}
        </div>
      </div>

      {/* Nav List with Grouping */}
      <nav className="flex-1 px-3 py-1 space-y-4 overflow-y-auto overscroll-contain">
        {filteredSections.map((section) => (
          <div key={section.title} className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400/90 uppercase tracking-wider px-3 pt-2 pb-1">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                // Entrée la plus précise : « Nouvelle collecte » ne rend pas « Mes collectes » actif
                const matches = (href: string) =>
                  pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));
                const isActive =
                  matches(item.href) &&
                  !filteredSections.some((s) =>
                    s.items.some((other) => other.href.length > item.href.length && matches(other.href))
                  );

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onCloseMobile}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'md-ripple flex items-center justify-between gap-3 h-11 sm:h-10 px-3 rounded-xl text-xs sm:text-sm font-medium transition-colors duration-150',
                      isActive
                        ? 'bg-brand-500 text-slate-950 font-bold shadow-md'
                        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon
                        className={cn(
                          'w-4 h-4 sm:w-5 sm:h-5 shrink-0 transition-colors',
                          isActive ? 'text-slate-950 stroke-[2.4]' : 'text-slate-400'
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {isActive ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-950 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500/60 shrink-0" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer Actions (Logout & Info) */}
      <div className="p-3 border-t border-brand-800/80 bg-brand-950 space-y-2 shrink-0">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full h-11 flex items-center justify-center gap-2 rounded-xl text-xs font-bold text-red-300 bg-red-950/40 border border-red-900/60 hover:bg-red-900/50 hover:text-red-200 active:scale-[0.98] transition"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Déconnexion</span>
        </button>

        <p className="text-[10px] text-center text-slate-400 font-medium pt-1">
          OptiSpace • Solution Wi-Fi Zone
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block sticky top-0 h-screen shrink-0 w-64 border-r border-brand-800/80 shadow-xl">
        {renderNavContent(false)}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex"
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navigation mobile"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm md-anim-fade"
            onClick={onCloseMobile}
          />

          {/* Drawer panel sliding in from left */}
          <div className="relative z-10 w-[85vw] max-w-[340px] h-full bg-brand-950 shadow-2xl md-anim-drawer border-r border-brand-800/80 flex flex-col safe-top safe-bottom">
            {renderNavContent(true)}
          </div>
        </div>
      )}
    </>
  );
}
