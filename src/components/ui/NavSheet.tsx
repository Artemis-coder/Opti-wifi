'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export type NavTone = 'amber' | 'emerald' | 'red' | 'blue' | 'purple' | 'slate';

const TONES: Record<NavTone, string> = {
  amber: 'bg-amber-500 text-white',
  emerald: 'bg-emerald-500 text-white',
  red: 'bg-red-500 text-white',
  blue: 'bg-blue-500 text-white',
  purple: 'bg-purple-500 text-white',
  slate: 'bg-slate-400 text-white',
};

/** Groupe de lignes, encadre et retracte comme dans les Reglages d'iOS. */
export function NavSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="mb-5 last:mb-0">
      {title && (
        <h3 className="px-4 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {title}
        </h3>
      )}
      <div className="overflow-hidden rounded-2xl bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 shadow-sm">
        {children}
      </div>
    </section>
  );
}

function rowClass(active: boolean) {
  return cn(
    'md-ripple flex w-full items-center gap-3.5 min-h-14 px-4 text-left transition-colors duration-150',
    active ? 'bg-amber-500/10' : 'active:bg-slate-100 dark:active:bg-slate-800'
  );
}

function Icon({ icon: Icon, tone, active }: { icon: React.ComponentType<{ className?: string }>; tone: NavTone; active: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] transition-colors duration-150',
        active ? TONES[tone] : 'bg-slate-200/80 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
      )}
    >
      <Icon className="h-[18px] w-[18px]" />
    </span>
  );
}

interface NavRowProps {
  href: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: NavTone;
  active?: boolean;
  onNavigate?: () => void;
}

export function NavRow({ href, label, description, icon, tone = 'slate', active = false, onNavigate }: NavRowProps) {
  return (
    <Link href={href} onClick={onNavigate} aria-current={active ? 'page' : undefined} className={rowClass(active)}>
      <Icon icon={icon} tone={tone} active={active} />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate text-[15px] font-medium',
            active ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'
          )}
        >
          {label}
        </span>
        {description && (
          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{description}</span>
        )}
      </span>
      {active && <ChevronRight className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />}
    </Link>
  );
}

interface NavActionProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  tone?: NavTone;
  danger?: boolean;
}

/** Ligne d'action sans navigation, pour la deconnexion par exemple. */
export function NavAction({ label, icon, onClick, tone = 'red', danger = true }: NavActionProps) {
  return (
    <button type="button" onClick={onClick} className={rowClass(false)}>
      <Icon icon={icon} tone={tone} active={false} />
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-[15px] font-medium',
          danger ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'
        )}
      >
        {label}
      </span>
    </button>
  );
}

/** Carte de compte en tete de feuille, facon profil iOS. */
export function NavAccount({
  name,
  role,
  online,
  offline,
  unstable,
  avatar,
}: {
  name: string;
  role: string;
  online?: boolean;
  offline?: boolean;
  unstable?: boolean;
  avatar: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-center gap-3.5 rounded-2xl bg-white dark:bg-slate-900 px-4 py-3.5 shadow-sm">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/30">
        {avatar}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-slate-900 dark:text-white">{name}</p>
        <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{role}</p>
      </div>
      {offline && <span title="Hors ligne" className="shrink-0"><span className="block h-2 w-2 rounded-full bg-red-500" /></span>}
      {unstable && <span title="Connexion instable" className="shrink-0"><span className="block h-2 w-2 rounded-full bg-amber-500" /></span>}
      {online && !offline && !unstable && <span title="En ligne" className="shrink-0"><span className="block h-2 w-2 rounded-full bg-emerald-500" /></span>}
    </div>
  );
}
