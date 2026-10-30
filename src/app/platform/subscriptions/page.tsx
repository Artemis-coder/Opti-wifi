'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Ban,
  Banknote,
  CheckCircle2,
  ExternalLink,
  Gift,
  History,
  KeyRound,
  Loader2,
  PauseCircle,
  PlayCircle,
  Receipt,
  Search,
  UserX,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatTile } from '@/components/ui/StatTile';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
import { confirmAction } from '@/components/ui/ConfirmDialog';
import { LicenseActivationModal } from '@/components/platform/LicenseActivationModal';
import { formatCurrencyFCFA, formatDateOnlyFR } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

interface SubscriptionRow {
  id: string;
  organization_id: string;
  plan_id: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  organization_name: string;
  organization_status: string;
  plan_name: string | null;
  plan_price: number | null;
  plan_currency: string | null;
  plan_period: string | null;
  is_trial: boolean;
  days_left: number | null;
  total_days: number | null;
}

interface Kpis {
  paid_active: number;
  trials: number;
  expiring: number;
  mrr: number;
  without_licence: number;
}

type State = 'trial' | 'active' | 'expiring' | 'expired' | 'suspended' | 'cancelled';

const EXPIRING_DAYS = 10;

const STATE_CONFIG: Record<State, { label: string; color: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  trial: { label: 'Essai gratuit', color: 'info' },
  active: { label: 'Actif', color: 'success' },
  expiring: { label: 'Expire bientôt', color: 'warning' },
  expired: { label: 'Expiré', color: 'danger' },
  suspended: { label: 'Suspendu', color: 'danger' },
  cancelled: { label: 'Annulé', color: 'neutral' },
};

const FILTERS: { value: 'all' | State; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'active', label: 'Actifs' },
  { value: 'trial', label: 'Essais' },
  { value: 'expiring', label: 'Expirent bientôt' },
  { value: 'expired', label: 'Expirés' },
  { value: 'suspended', label: 'Suspendus' },
  { value: 'cancelled', label: 'Annulés' },
];

const PERIOD_LABELS: Record<string, string> = {
  monthly: 'mois',
  quarterly: 'trimestre',
  semiannual: 'semestre',
  annual: 'an',
};

/** État affiché : un abonnement « actif » dont la date est passée est expiré. */
function stateOf(s: SubscriptionRow): State {
  if (s.status === 'suspended') return 'suspended';
  if (s.status === 'cancelled') return 'cancelled';
  const live = (s.status === 'active' || s.status === 'trialing') && (s.days_left === null || s.days_left > 0);
  if (!live) return 'expired';
  if (s.is_trial) return 'trial';
  return s.days_left !== null && s.days_left <= EXPIRING_DAYS ? 'expiring' : 'active';
}

const ACTION_CONFIRM: Record<string, { message: (name: string) => string; label: string; danger: boolean }> = {
  suspend: {
    message: (n) => `Suspendre l'abonnement de « ${n} » ? L'accès du client est coupé jusqu'à sa réactivation.`,
    label: 'Suspendre',
    danger: true,
  },
  cancel: {
    message: (n) => `Annuler l'abonnement de « ${n} » ? L'accès du client est coupé immédiatement.`,
    label: "Annuler l'abonnement",
    danger: true,
  },
  reactivate: {
    message: (n) => `Réactiver l'abonnement de « ${n} » jusqu'à sa date d'expiration ?`,
    label: 'Réactiver',
    danger: false,
  },
};

export default function PlatformSubscriptionsPage() {
  const [rows, setRows] = useState<SubscriptionRow[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | State>('all');
  const [history, setHistory] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [licenseFor, setLicenseFor] = useState<SubscriptionRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/platform/subscriptions${history ? '?scope=all' : ''}`)
      .then(async (res) => {
        const result = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          toast.error(result.error || 'Erreur de chargement');
          return;
        }
        setRows(result.data || []);
        setKpis(result.kpis || null);
      })
      .catch(() => {
        if (!cancelled) toast.error('Erreur réseau');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [history, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  const withState = useMemo(() => rows.map((r) => ({ ...r, state: stateOf(r) })), [rows]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: withState.length };
    for (const r of withState) c[r.state] = (c[r.state] || 0) + 1;
    return c;
  }, [withState]);

  const q = search.trim().toLowerCase();
  const visible = withState.filter(
    (r) =>
      (filter === 'all' || r.state === filter) &&
      (!q || r.organization_name.toLowerCase().includes(q) || (r.plan_name || '').toLowerCase().includes(q))
  );

  async function runAction(row: SubscriptionRow, action: keyof typeof ACTION_CONFIRM) {
    const cfg = ACTION_CONFIRM[action];
    const ok = await confirmAction(cfg.message(row.organization_name), { confirmLabel: cfg.label, danger: cfg.danger });
    if (!ok) return;
    setBusyId(row.id);
    try {
      const res = await fetch('/api/platform/subscriptions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: row.id, action, reason: 'Super admin' }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || 'Action impossible');
        return;
      }
      toast.success(result.message);
      reload();
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <KeyRound className="w-6 h-6 text-amber-500" />
            Abonnements
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            La licence en cours de chaque client : essais, renouvellements à prévoir et licences expirées.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/platform/subscriptions/expiring">
            <Button variant="outline" size="sm" icon={History}>
              Expirations
            </Button>
          </Link>
          <Link href="/platform/plans">
            <Button variant="secondary" size="sm" icon={Zap}>
              Forfaits
            </Button>
          </Link>
        </div>
      </div>

      {/* Chiffres clés */}
      <div
        className={cn(
          'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 transition-opacity',
          loading && 'opacity-50'
        )}
      >
        <StatTile
          label="Licences payantes"
          value={kpis?.paid_active ?? '—'}
          icon={CheckCircle2}
          accent="emerald"
          hint="Forfait payant en cours"
        />
        <StatTile
          label="Essais en cours"
          value={kpis?.trials ?? '—'}
          icon={Gift}
          accent="blue"
          hint="Essais gratuits actifs"
        />
        <StatTile
          label="Expirent bientôt"
          value={kpis?.expiring ?? '—'}
          icon={AlertTriangle}
          accent="amber"
          hint={`Dans les ${EXPIRING_DAYS} jours`}
          alert={!!kpis && kpis.expiring > 0}
        />
        <StatTile
          label="Sans licence"
          value={kpis?.without_licence ?? '—'}
          icon={UserX}
          accent="red"
          hint="Clients validés"
        />
        <StatTile
          label="Revenu mensuel"
          value={kpis ? formatCurrencyFCFA(kpis.mrr) : '—'}
          icon={Banknote}
          accent="indigo"
          hint="Licences en cours, par mois"
          className="col-span-2 md:col-span-1"
        />
      </div>

      {/* Recherche et filtres */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Rechercher un client ou un forfait…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={history}
              onChange={(e) => {
                setLoading(true);
                setHistory(e.target.checked);
              }}
              className="w-4 h-4 accent-amber-500"
            />
            Historique complet
          </label>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap flex items-center gap-1.5',
                filter === f.value
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-amber-500/10'
              )}
            >
              {f.label}
              <span
                className={cn(
                  'min-w-5 px-1 rounded-md text-[10px] tabular-nums',
                  filter === f.value ? 'bg-slate-950/15' : 'bg-slate-200 dark:bg-slate-700'
                )}
              >
                {counts[f.value] || 0}
              </span>
            </button>
          ))}
        </div>
        {history && (
          <p className="text-[11px] text-slate-500">
            Historique complet : une ligne par période de licence. Les périodes remplacées par un renouvellement
            apparaissent comme expirées.
          </p>
        )}
      </Card>

      {/* Liste */}
      {loading && rows.length === 0 ? (
        <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
          <span>Chargement des abonnements…</span>
        </div>
      ) : visible.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <Receipt className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucun abonnement</h3>
          <p className="text-xs text-slate-500">Aucun abonnement ne correspond à ces critères.</p>
        </Card>
      ) : (
        <Card className={cn('p-0 overflow-hidden transition-opacity', loading && 'opacity-50')}>
          <ResponsiveTable>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 dark:bg-slate-800/60 text-[11px] text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Forfait</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Période</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {visible.map((s) => {
                  const cfg = STATE_CONFIG[s.state];
                  const live = s.state === 'active' || s.state === 'trial' || s.state === 'expiring';
                  const progress =
                    live && s.total_days && s.days_left !== null
                      ? Math.min(100, Math.max(0, Math.round(((s.total_days - s.days_left) / s.total_days) * 100)))
                      : null;
                  const canReactivate =
                    (s.state === 'suspended' || s.state === 'cancelled') && s.days_left !== null && s.days_left > 0;
                  const busy = busyId === s.id;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3">
                        <Link
                          href={`/platform/clients/${s.organization_id}`}
                          className="font-semibold text-slate-900 dark:text-white hover:text-amber-600"
                        >
                          {s.organization_name}
                        </Link>
                        {s.organization_status === 'suspended' && (
                          <span className="block text-[11px] text-red-600 dark:text-red-400">Espace suspendu</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-800 dark:text-slate-200">{s.plan_name || '—'}</span>
                        <span className="block text-[11px] text-slate-500">
                          {s.is_trial
                            ? 'Gratuit'
                            : s.plan_price
                              ? `${formatCurrencyFCFA(s.plan_price)} / ${PERIOD_LABELS[s.plan_period || ''] || s.plan_period}`
                              : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant={cfg.color} className="text-[11px]">
                            {cfg.label}
                          </Badge>
                          {s.cancel_at_period_end && live && (
                            <Badge variant="warning" className="text-[11px]">
                              Non renouvelé
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <div className="mb-0.5">
                          {live && s.days_left !== null ? (
                            <span
                              className={cn(
                                'text-xs font-bold tabular-nums',
                                s.days_left <= 3
                                  ? 'text-red-600 dark:text-red-400'
                                  : s.days_left <= EXPIRING_DAYS
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-slate-900 dark:text-white'
                              )}
                            >
                              {s.days_left} jour{s.days_left > 1 ? 's' : ''} restant{s.days_left > 1 ? 's' : ''}
                            </span>
                          ) : s.state === 'expired' && s.days_left !== null ? (
                            <span className="text-xs text-slate-500">
                              expiré depuis {-s.days_left} jour{-s.days_left > 1 ? 's' : ''}
                            </span>
                          ) : null}
                        </div>
                        {s.start_date ? formatDateOnlyFR(s.start_date) : '—'} →{' '}
                        {s.end_date ? formatDateOnlyFR(s.end_date) : 'sans fin'}
                        {progress !== null && (
                          <div className="mt-1.5 h-1.5 w-32 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                s.state === 'expiring'
                                  ? 'bg-amber-500'
                                  : s.state === 'trial'
                                    ? 'bg-blue-500'
                                    : 'bg-emerald-500'
                              )}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant={live && s.state !== 'expiring' ? 'outline' : 'primary'}
                            className="text-xs h-8 whitespace-nowrap"
                            onClick={() => setLicenseFor(s)}
                            disabled={busy}
                            icon={KeyRound}
                          >
                            {live ? 'Prolonger' : 'Activer un forfait'}
                          </Button>
                          {canReactivate && (
                            <IconAction title="Réactiver" onClick={() => runAction(s, 'reactivate')} busy={busy}>
                              <PlayCircle className="w-4 h-4 text-emerald-600" />
                            </IconAction>
                          )}
                          {live && (
                            <IconAction title="Suspendre" onClick={() => runAction(s, 'suspend')} busy={busy}>
                              <PauseCircle className="w-4 h-4 text-amber-600" />
                            </IconAction>
                          )}
                          {live && (
                            <IconAction title="Annuler l'abonnement" onClick={() => runAction(s, 'cancel')} busy={busy}>
                              <Ban className="w-4 h-4 text-red-600" />
                            </IconAction>
                          )}
                          <Link
                            href={`/platform/clients/${s.organization_id}`}
                            title="Voir le client"
                            aria-label="Voir le client"
                            className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <ExternalLink className="w-4 h-4 text-slate-500" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ResponsiveTable>
        </Card>
      )}

      {licenseFor && (
        <LicenseActivationModal
          isOpen={!!licenseFor}
          onClose={() => setLicenseFor(null)}
          onActivated={reload}
          organizationId={licenseFor.organization_id}
          organizationName={licenseFor.organization_name}
          currentEndDate={
            licenseFor.status === 'active' || licenseFor.status === 'trialing' ? licenseFor.end_date : null
          }
          // Un essai ne se prolonge pas : on propose le forfait de base
          defaultPlanId={licenseFor.is_trial ? null : licenseFor.plan_id}
        />
      )}
    </div>
  );
}

function IconAction({
  title,
  onClick,
  busy,
  children,
}: {
  title: string;
  onClick: () => void;
  busy: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={busy}
      className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : children}
    </button>
  );
}
