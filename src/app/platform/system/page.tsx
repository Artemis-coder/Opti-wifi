'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Database,
  Info,
  Loader2,
  RefreshCw,
  Server,
  XCircle,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';
import type { HealthSnapshot, SystemComponent, SystemHealth, SystemStatus } from '@/lib/system-health';

const REFRESH_MS = 30_000;

const ICONS: Record<SystemComponent['id'], LucideIcon> = {
  database: Database,
  api: Zap,
  notifications: Bell,
  server: Server,
  crons: Clock,
};

const STATUS: Record<SystemStatus, { label: string; dot: string; pill: string; bar: string; icon: LucideIcon }> = {
  ok: {
    label: 'Opérationnel',
    dot: 'bg-emerald-500',
    pill: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    bar: 'bg-emerald-500',
    icon: CheckCircle2,
  },
  warning: {
    label: 'À surveiller',
    dot: 'bg-amber-500',
    pill: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
    bar: 'bg-amber-500',
    icon: AlertTriangle,
  },
  error: {
    label: 'En panne',
    dot: 'bg-red-500',
    pill: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
    bar: 'bg-red-500',
    icon: XCircle,
  },
};

const SOURCE_LABEL: Record<string, string> = {
  api: 'API',
  server: 'Serveur',
  push: 'Push',
  email: 'E-mail',
  telegram: 'Telegram',
  cron: 'Tâche',
};

const time = (d: string) => new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(d));
const dateTime = (d: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d));

function StatusPill({ status }: { status: SystemStatus }) {
  const s = STATUS[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap', s.pill)}>
      <span className={cn('w-2 h-2 rounded-full', s.dot)} />
      {s.label}
    </span>
  );
}

/** Frise des derniers contrôles d'un composant (un trait par contrôle) */
function HistoryStrip({ id, history }: { id: string; history: HealthSnapshot[] }) {
  const points = history
    .map((h) => ({ at: h.checked_at, status: h.components.find((c) => c.id === id)?.status }))
    .filter((p): p is { at: string; status: SystemStatus } => !!p.status)
    .slice(-60);
  if (points.length === 0) {
    return <p className="text-[11px] text-slate-400">Historique disponible après les prochains contrôles.</p>;
  }
  const okShare = Math.round((points.filter((p) => p.status === 'ok').length / points.length) * 100);
  return (
    <div>
      <div className="flex items-end gap-[2px] h-6" aria-label={`Historique : ${okShare} % des contrôles opérationnels`}>
        {points.map((p) => (
          <span
            key={p.at}
            title={`${dateTime(p.at)} · ${STATUS[p.status].label}`}
            className={cn('flex-1 min-w-[3px] max-w-[10px] rounded-sm h-full', STATUS[p.status].bar, p.status === 'ok' && 'opacity-70')}
          />
        ))}
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        {okShare} % des {points.length} derniers contrôles sans problème
      </p>
    </div>
  );
}

function ComponentCard({ c, history }: { c: SystemComponent; history: HealthSnapshot[] }) {
  const Icon = ICONS[c.id] ?? Activity;
  return (
    <Card className="p-4 sm:p-5 flex flex-col gap-4 hover:shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
              c.status === 'ok'
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40'
                : c.status === 'warning'
                  ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40'
                  : 'bg-red-50 text-red-600 dark:bg-red-950/40'
            )}
          >
            <Icon className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="font-bold text-slate-900 dark:text-white">{c.label}</p>
            <p className="text-xs text-slate-500 truncate">{c.summary}</p>
          </div>
        </div>
        <StatusPill status={c.status} />
      </div>

      {c.metrics.length > 0 && (
        <dl className="grid grid-cols-2 gap-2">
          {c.metrics.map((m) => (
            <div key={m.label} className="rounded-lg bg-slate-50 dark:bg-slate-800/60 px-3 py-2 min-w-0">
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{m.label}</dt>
              <dd className="text-sm font-bold text-slate-900 dark:text-white truncate" title={m.value}>
                {m.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {c.checks.length > 0 && (
        <ul className="space-y-2">
          {c.checks.map((check) => {
            const S = STATUS[check.status];
            return (
              <li key={check.label} className="flex items-start gap-2 text-sm">
                <S.icon
                  className={cn(
                    'w-4 h-4 mt-0.5 shrink-0',
                    check.status === 'ok' ? 'text-emerald-600' : check.status === 'warning' ? 'text-amber-600' : 'text-red-600'
                  )}
                />
                <span className="min-w-0">
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{check.label}</span>
                  <span className="text-slate-500"> — {check.message}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800">
        <HistoryStrip id={c.id} history={history} />
      </div>
    </Card>
  );
}

export default function SystemStatusPage() {
  const [hours, setHours] = useState<24 | 168>(24);
  const [state, setState] = useState<{ health: SystemHealth; history: HealthSnapshot[] } | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealth = useCallback(async () => {
    const res = await fetch(`/api/platform/system-health?hours=${hours}`, { cache: 'no-store' });
    if (!res.ok) throw new Error();
    const json = await res.json();
    return { health: json.data as SystemHealth, history: (json.history || []) as HealthSnapshot[] };
  }, [hours]);

  // Premier chargement puis actualisation toutes les 30 s tant que la page est affichée
  useEffect(() => {
    let cancelled = false;
    const run = () =>
      fetchHealth()
        .then((data) => {
          if (cancelled) return;
          setState(data);
          setError(false);
        })
        .catch(() => !cancelled && setError(true));
    void run();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void run();
    }, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [fetchHealth]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      setState(await fetchHealth());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setRefreshing(false);
    }
  };

  const health = state?.health;
  const problems = health?.components.filter((c) => c.status !== 'ok') ?? [];
  const Overall = health ? STATUS[health.overall].icon : Activity;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">État du système</h1>
          <p className="text-xs text-slate-500">
            Base de données, API, notifications, serveur et tâches planifiées. Actualisation automatique toutes les 30 secondes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            {([24, 168] as const).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHours(h)}
                className={cn(
                  'h-8 px-3 rounded-lg text-xs font-semibold whitespace-nowrap',
                  hours === h ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
                )}
              >
                {h === 24 ? '24 h' : '7 jours'}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" icon={RefreshCw} isLoading={refreshing} onClick={refresh} className="whitespace-nowrap">
            Relancer les vérifications
          </Button>
        </div>
      </div>

      {!health && !error && (
        <Card className="p-10 flex items-center justify-center gap-3 text-slate-500 hover:shadow-xs">
          <Loader2 className="w-5 h-5 animate-spin" /> Vérification en cours…
        </Card>
      )}
      {error && !health && (
        <Card className="p-6 text-sm text-red-700 bg-red-50 dark:bg-red-950/30 border-red-200 hover:shadow-xs">
          Impossible de lancer les vérifications. Le serveur ne répond peut-être pas : réessayez dans un instant.
        </Card>
      )}

      {health && (
        <>
          {/* Bandeau global */}
          <div
            className={cn(
              'rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border',
              health.overall === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-200'
                : health.overall === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-200'
                  : 'bg-red-50 border-red-200 text-red-900 dark:bg-red-950/30 dark:border-red-900 dark:text-red-200'
            )}
          >
            <div className="flex items-center gap-3">
              <Overall className="w-6 h-6 shrink-0" />
              <div>
                <p className="font-bold">
                  {health.overall === 'ok'
                    ? 'Tous les systèmes sont opérationnels'
                    : health.overall === 'warning'
                      ? `${problems.length} composant${problems.length > 1 ? 's' : ''} à surveiller`
                      : `Panne : ${problems.filter((c) => c.status === 'error').map((c) => c.label).join(', ')}`}
                </p>
                {problems.length > 0 && <p className="text-xs opacity-80">{problems.map((c) => `${c.label} — ${c.summary}`).join(' · ')}</p>}
              </div>
            </div>
            <p className="text-xs opacity-80 whitespace-nowrap">
              Dernière vérification à {time(health.checked_at)}
              {error && ' · actualisation en échec'}
            </p>
          </div>

          {/* Composants */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {health.components.map((c) => (
              <ComponentCard key={c.id} c={c} history={state.history} />
            ))}
          </div>

          {/* Dernières erreurs */}
          <Card className="p-0 overflow-hidden hover:shadow-xs">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-bold text-slate-900 dark:text-white">Dernières erreurs</h2>
              <p className="text-xs text-slate-500">Erreurs serveur et échecs d&apos;envoi, conservés 30 jours. Aucune donnée personnelle n&apos;est enregistrée.</p>
            </div>
            {health.recent_errors.length === 0 ? (
              <p className="px-5 py-8 text-sm text-center text-slate-500">Aucune erreur enregistrée.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {health.recent_errors.map((e, i) => (
                  <li key={`${e.occurred_at}-${i}`} className="px-5 py-3 flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 text-sm">
                    <span className="text-xs text-slate-500 whitespace-nowrap sm:w-32 shrink-0">{dateTime(e.occurred_at)}</span>
                    <span className="inline-flex w-fit rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 shrink-0">
                      {SOURCE_LABEL[e.source] || e.source}
                    </span>
                    <span className="min-w-0">
                      {e.route && <span className="font-mono text-xs text-slate-500 mr-2">{e.route}</span>}
                      <span className="text-slate-800 dark:text-slate-200 break-words">{e.message}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Surveillance extérieure */}
          <Card className="p-5 flex gap-3 bg-slate-50 dark:bg-slate-900/60 hover:shadow-xs">
            <Info className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
            <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
              <p className="font-semibold text-slate-900 dark:text-white">Être prévenu même si le site est en panne</p>
              <p>
                Cette page ne peut pas signaler que le site lui-même est arrêté. Configurez un service de surveillance
                extérieur (UptimeRobot, Better Stack…) qui appelle <code className="font-mono text-xs">/api/ping</code> chaque
                minute.
              </p>
              <p>
                Les contrôles enregistrés tournent une fois par jour (tâche Vercel). Pour un historique plus fin et des
                alertes plus rapides, faites appeler <code className="font-mono text-xs">/api/cron/health-check</code> toutes
                les 5 minutes (par exemple avec cron-job.org) avec l&apos;en-tête{' '}
                <code className="font-mono text-xs">Authorization: Bearer CRON_SECRET</code>.
              </p>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
