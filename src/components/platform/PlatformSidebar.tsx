'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Chip, Drawer, ScrollShadow } from '@heroui/react';
import {
  Activity,
  UserX,
  LayoutDashboard,
  Building2,
  Receipt,
  Wallet,
  FileText,
  Users,
  UserPlus,
  Inbox,
  KeyRound,
  Bell,
  Settings,
  History,
  LifeBuoy,
  Smartphone,
  Globe,
  ScrollText,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface SidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

type NavIcon = React.ComponentType<{ className?: string; strokeWidth?: number }>;

interface NavItem {
  label: string;
  href: string;
  icon: NavIcon;
}

interface NavSection {
  section: string | null;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    section: null,
    items: [{ label: 'Tableau de bord', href: '/platform/dashboard', icon: LayoutDashboard }],
  },
  {
    section: 'Clients',
    items: [
      { label: 'Inscriptions', href: '/platform/registrations', icon: UserPlus },
      { label: 'Tous les clients', href: '/platform/clients', icon: Building2 },
      { label: 'Suppressions de compte', href: '/platform/deletion-requests', icon: UserX },
    ],
  },
  {
    section: 'Licences',
    items: [
      { label: 'Demandes de licence', href: '/platform/license-requests', icon: Inbox },
      { label: 'Abonnements', href: '/platform/subscriptions', icon: KeyRound },
      { label: 'Expirations', href: '/platform/subscriptions/expiring', icon: History },
      { label: 'Forfaits', href: '/platform/plans', icon: Wallet },
    ],
  },
  {
    section: 'Paiements',
    items: [
      { label: 'Moyens de paiement', href: '/platform/payment-methods', icon: Smartphone },
      { label: 'Transactions', href: '/platform/payments', icon: Receipt },
      { label: 'Factures', href: '/platform/invoices', icon: FileText },
    ],
  },
  {
    section: 'Plateforme',
    items: [
      { label: 'Utilisateurs', href: '/platform/users', icon: Users },
      { label: 'Notifications', href: '/platform/notifications', icon: Bell },
      { label: 'Support', href: '/platform/support', icon: LifeBuoy },
      { label: 'Site vitrine', href: '/platform/site', icon: Globe },
      { label: 'État du système', href: '/platform/system', icon: Activity },
      { label: "Journal d'audit", href: '/platform/audit-logs', icon: ScrollText },
      { label: 'Paramètres', href: '/platform/settings', icon: Settings },
    ],
  },
];

/** Barre de navigation mobile du back-office (le bouton Menu ouvre la liste complète). */
export const PLATFORM_BOTTOM_NAV = [
  { label: 'Accueil', href: '/platform/dashboard', icon: LayoutDashboard, exact: true },
  { label: 'Inscriptions', href: '/platform/registrations', icon: UserPlus },
  { label: 'Demandes', href: '/platform/license-requests', icon: Inbox },
  { label: 'Clients', href: '/platform/clients', icon: Building2 },
];

const ALL_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);
const ALL_HREFS = ALL_ITEMS.map((i) => i.href);

/** Titre de la page courante du back-office (en-tête). */
export function getPlatformPageTitle(pathname: string): string {
  if (/^\/platform\/clients\/[^/]+/.test(pathname)) return 'Fiche client';
  let best = { href: '', label: 'Super admin' };
  for (const item of ALL_ITEMS) {
    if ((pathname === item.href || pathname.startsWith(item.href + '/')) && item.href.length > best.href.length) best = item;
  }
  return best.label;
}

// Un lien est actif sur sa page et ses sous-pages, sauf si un lien plus précis correspond.
function isLinkActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (!pathname.startsWith(href + '/')) return false;
  return !ALL_HREFS.some((h) => h !== href && h.startsWith(href + '/') && (pathname === h || pathname.startsWith(h + '/')));
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="relative size-9 shrink-0 overflow-hidden rounded-xl bg-surface-secondary">
        <Image src="/assets/logo.jpg" alt="" width={36} height={36} className="object-cover" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">OptiSpace</p>
        <Chip size="sm" variant="soft" color="accent" className="mt-0.5">
          Super admin
        </Chip>
      </div>
    </div>
  );
}

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Navigation du back-office" className="flex flex-col gap-4">
      {NAV_SECTIONS.map((group) => (
        <div key={group.section ?? 'main'} className="flex flex-col gap-0.5">
          {group.section && <p className="px-3 pb-1 text-xs font-medium text-muted">{group.section}</p>}
          {group.items.map((item) => {
            const Icon = item.icon;
            const active = isLinkActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
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
}

export function PlatformSidebar({ isMobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Bureau : colonne fixe */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-separator bg-surface lg:flex">
        <div className="flex h-16 items-center px-5">
          <Brand />
        </div>
        <ScrollShadow className="flex-1 px-3 pb-6 pt-2" hideScrollBar>
          <NavList pathname={pathname} />
        </ScrollShadow>
      </aside>

      {/* Mobile : modèle HeroUI « Navigation Drawer » (tiroir depuis la gauche) */}
      <Drawer.Backdrop
        isOpen={isMobileOpen}
        onOpenChange={(open) => {
          if (!open) onCloseMobile?.();
        }}
        className="lg:hidden"
      >
        <Drawer.Content placement="left">
          <Drawer.Dialog>
            <Drawer.CloseTrigger aria-label="Fermer le menu" />
            <Drawer.Header>
              <Drawer.Heading>Menu</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body>
              <NavList pathname={pathname} onNavigate={onCloseMobile} />
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </>
  );
}
