'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { HealthSnapshot, SystemStatus } from '@/lib/system-health';

const LABELS: Record<string, string> = {
  database: 'Base de données',
  api: 'API',
  notifications: 'Notifications',
  server: 'Serveur',
  vercel: 'Vercel',
  crons: 'Tâches planifiées',
};
const DOT: Record<SystemStatus, string> = { ok: 'bg-emerald-500', warning: 'bg-amber-500', error: 'bg-red-500' };

/** Carte « État du système » du tableau de bord : un coup d'œil, le détail sur la page dédiée. */
export function SystemStatusCard() {
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/platform/system-health?summary=1', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { data: null }))
      .then((json) => !cancelled && setSnapshot(json.data ?? null))
      .catch(() => !cancelled && setSnapshot(null));
    return () => {
      cancelled = true;
    };
  }, []);

  const problems = snapshot?.components.filter((c) => c.status !== 'ok') ?? [];
  const overall: SystemStatus | null = snapshot?.overall ?? null;
  const title =
    snapshot === undefined
      ? 'Vérification de l’état du système…'
      : !snapshot
        ? 'État du système indisponible'
        : overall === 'ok'
          ? 'Tous les systèmes sont opérationnels'
          : `${problems.length} alerte${problems.length > 1 ? 's' : ''} : ${problems.map((c) => LABELS[c.id] || c.id).join(', ')}`;

  return (
    <Link
      href="/platform/system"
      className={cn(
        'group flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-2xl border px-5 py-4 transition hover:shadow-md',
        overall === 'error'
          ? 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900'
          : overall === 'warning'
            ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900'
            : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800'
      )}
    >
      <div className="flex items-center gap-3 min-w-0 lg:flex-1">
        <span className="relative flex w-3 h-3 shrink-0">
          {overall && overall !== 'ok' && <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping', DOT[overall])} />}
          <span className={cn('relative inline-flex w-3 h-3 rounded-full', overall ? DOT[overall] : 'bg-slate-300')} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Activity className="w-3.5 h-3.5" /> État du système
          </p>
          <p className="font-bold text-slate-900 dark:text-white">{title}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {snapshot?.components.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300" title={c.summary}>
            <span className={cn('w-2 h-2 rounded-full', DOT[c.status])} />
            {LABELS[c.id] || c.id}
          </span>
        ))}
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 group-hover:gap-2 transition-all">
          Détail <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </Link>
  );
}
