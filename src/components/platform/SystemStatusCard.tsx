'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowRight } from 'lucide-react';
import { cardVariants } from '@heroui/styles';
import { cn } from '@/lib/utils/cn';
import type { HealthSnapshot, SystemStatus } from '@/lib/system-health';

const LABELS: Record<string, string> = {
  database: 'Base de données',
  api: 'API',
  notifications: 'Notifications',
  server: 'Serveur',
  vercel: 'Vercel',
  crons: 'Tâches planifiées',
  security: 'Sécurité',
};
const DOT: Record<SystemStatus, string> = { ok: 'bg-success', warning: 'bg-warning', error: 'bg-danger' };

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
        cardVariants({ variant: 'default' }).base(),
        'group flex-col justify-between gap-3 outline-none transition-colors hover:bg-surface-hover lg:flex-row lg:items-center',
        'focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        overall === 'error' && 'ring-1 ring-danger/40',
        overall === 'warning' && 'ring-1 ring-warning/50'
      )}
    >
      <div className="flex min-w-0 items-center gap-3 lg:flex-1">
        <span className="relative flex size-3 shrink-0">
          {overall && overall !== 'ok' && (
            <span className={cn('absolute inline-flex size-full animate-ping rounded-full opacity-60 motion-reduce:hidden', DOT[overall])} />
          )}
          <span className={cn('relative inline-flex size-3 rounded-full', overall ? DOT[overall] : 'bg-default')} />
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-xs text-muted">
            <Activity className="size-3.5" /> État du système
          </p>
          <p className="font-medium text-foreground">{title}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {snapshot?.components.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1.5 text-xs text-muted" title={c.summary}>
            <span className={cn('size-2 rounded-full', DOT[c.status])} />
            {LABELS[c.id] || c.id}
          </span>
        ))}
        <span className="inline-flex items-center gap-1 text-xs font-medium text-accent transition-all group-hover:gap-2">
          Détail <ArrowRight className="size-3.5" />
        </span>
      </div>
    </Link>
  );
}
