'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  ChevronRight,
  Inbox,
  Loader2,
  Ticket,
  ArrowLeftRight,
  Receipt,
  Store,
} from 'lucide-react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { Card } from '@/components/ui/Card';
import { AddButton } from '@/components/ui/AddButton';
import { StatTile } from '@/components/ui/StatTile';
import { KpiGrid } from '@/components/ui/KpiGrid';
import { cn } from '@/lib/utils/cn';
import { formatAmountShort, formatCurrencyFCFA, formatNumber } from '@/lib/utils/format';
import { useSpaceStore } from '@/lib/stores/spaceStore';
import { useAuthStore } from '@/lib/stores/authStore';
import type { ClientDashboard, DashboardPeriod } from '@/lib/client-dashboard';
import { CollectorDashboard } from '@/components/collector/CollectorDashboard';
import { PosAccountDashboard } from '@/components/pos-account/PosAccountDashboard';
import { OnboardingCard } from '@/components/onboarding/OnboardingGuide';

const PERIODS: { value: DashboardPeriod; label: string; eyebrow: string }[] = [
  { value: 'all', label: 'Tout', eyebrow: 'Depuis le début' },
  { value: 'today', label: "Aujourd'hui", eyebrow: "Aujourd'hui" },
  { value: 'week', label: '7 jours', eyebrow: '7 derniers jours' },
  { value: 'month', label: 'Ce mois-ci', eyebrow: 'Ce mois-ci' },
];

const SHORTCUTS: { href: string; label: string; hint: string; icon: React.ElementType; tone: string; adminOnly?: boolean }[] = [
  {
    href: '/allocations/new',
    label: 'Allouer des tickets',
    hint: 'Distribuer du stock aux POS',
    icon: ArrowLeftRight,
    tone: 'bg-accent text-accent-foreground',
    adminOnly: true,
  },
  {
    href: '/collections/new',
    label: 'Nouvelle collecte',
    hint: 'Saisir un encaissement de caisse',
    icon: Receipt,
    tone: 'bg-warning text-foreground',
  },
  { href: '/pos', label: 'Points de vente', hint: 'Gérer le réseau de distribution', icon: Store, tone: 'bg-accent text-accent-foreground' },
  {
    href: '/tickets',
    label: 'Types de tickets',
    hint: 'Consulter et modifier les tarifs',
    icon: Ticket,
    tone: 'bg-success text-success-foreground',
    adminOnly: true,
  },
];

const PREVIOUS_LABEL: Record<DashboardPeriod, string> = { today: 'hier', week: '7 jours précédents', month: 'mois dernier', all: '' };

/** Montant compact sur l'axe et dans les infobulles : 962 400 F */
const money = formatAmountShort;

function Evolution({ current, previous, period }: { current: number; previous: number | undefined; period: DashboardPeriod }) {
  if (previous === undefined || period === 'all') return null;
  if (previous === 0) return <p className="text-xs text-muted">{current > 0 ? `Rien sur ${PREVIOUS_LABEL[period]}` : ' '}</p>;
  const pct = Math.round(((current - previous) / previous) * 100);
  const Icon = pct >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <p
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-semibold',
        pct >= 0 ? 'text-success-soft-foreground' : 'text-danger',
      )}
    >
      <Icon className="w-3.5 h-3.5" /> {pct > 0 ? '+' : ''}
      {pct} % <span className="font-normal text-muted">vs {PREVIOUS_LABEL[period]}</span>
    </p>
  );
}

function PosTooltip({ active, payload }: { active?: boolean; payload?: { payload: ClientDashboard['by_pos'][number] }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="space-y-1 rounded-xl bg-overlay text-overlay-foreground shadow-overlay px-3 py-2 text-xs min-w-40">
      <p className="font-semibold text-foreground">{p.name}</p>
      <p className="flex justify-between gap-3 text-muted">
        Ventes <span className="font-semibold tabular-nums text-foreground">{money(p.revenue)}</span>
      </p>
      <p className="flex justify-between gap-3 text-muted">
        Encaissé <span className="font-semibold tabular-nums text-foreground">{money(p.collected)}</span>
      </p>
      <p className="flex justify-between gap-3 text-muted">
        Écart{' '}
        <span className={cn('font-semibold tabular-nums', p.gap < 0 ? 'text-danger' : 'text-success-soft-foreground')}>
          {money(p.gap)}
        </span>
      </p>
    </div>
  );
}

// Le collecteur a son propre accueil (sa tournée) ; l'administrateur voit toute l'organisation.
export default function DashboardPage() {
  const role = useAuthStore((s) => s.user?.role);
  if (role === 'point_de_vente') return <PosAccountDashboard />;
  return role === 'collecteur' ? <CollectorDashboard /> : <AdminDashboard />;
}

function AdminDashboard() {
  const { currentSpaceId } = useSpaceStore();
  const isAdmin = useAuthStore((s) => s.user?.role) === 'administrateur';
  const [period, setPeriod] = useState<DashboardPeriod>('all');
  const key = `${period}|${currentSpaceId || ''}`;
  const [result, setResult] = useState<{ key: string; data: ClientDashboard | null } | null>(null);
  const loading = result?.key !== key;
  const data = result?.data ?? null;

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ period });
    if (currentSpaceId) params.set('space', currentSpaceId);
    fetch(`/api/dashboard?${params}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { data: null }))
      .then((json) => !cancelled && setResult({ key, data: json.data }))
      .catch(() => !cancelled && setResult({ key, data: null }));
    return () => {
      cancelled = true;
    };
  }, [period, currentSpaceId, key]);

  const eyebrow = PERIODS.find((p) => p.value === period)!.eyebrow;
  const t = data?.totals;
  const gapAlert = !!t && t.gap < 0;

  return (
    <div className="space-y-5">
      {/* Guide de démarrage d'un nouvel espace */}
      <OnboardingCard />

      {/* En-tête : période en surtitre, filtres de période */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted">{eyebrow}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Tableau de bord</h1>
        </div>
        <div role="group" aria-label="Période" className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              aria-pressed={period === p.value}
              className={cn(
                'shrink-0 h-9 px-3.5 rounded-xl text-xs font-semibold border transition',
                period === p.value
                  ? 'bg-foreground text-background border-border'
                  : 'bg-surface text-muted border-border hover:border-border',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chiffres clés */}
      <KpiGrid cols={{ base: 2, lg: 4 }} className={cn('transition-opacity', loading && 'opacity-60')}>
        <StatTile
          label="Tickets vendus"
          value={formatNumber(t?.tickets ?? 0)}
          icon={Ticket}
          accent="amber"
          footer={
            <p className="text-xs text-muted">
              {t?.collections ?? 0} encaissement{(t?.collections ?? 0) > 1 ? 's' : ''}
            </p>
          }
        />
        <StatTile
          label="Chiffre d'affaires"
          value={money(t?.revenue ?? 0)}
          icon={Banknote}
          accent="indigo"
          footer={<Evolution current={t?.revenue ?? 0} previous={data?.previous?.revenue} period={period} />}
        />
        <StatTile
          label="Total encaissé"
          value={money(t?.collected ?? 0)}
          icon={CheckCircle2}
          accent="emerald"
          footer={<Evolution current={t?.collected ?? 0} previous={data?.previous?.collected} period={period} />}
        />
        <StatTile
          label="Écart"
          value={`${(t?.gap ?? 0) > 0 ? '+' : ''}${money(t?.gap ?? 0)}`}
          icon={AlertTriangle}
          accent="red"
          alert={gapAlert}
          footer={
            <p className={cn('text-xs', gapAlert ? 'text-danger' : 'text-muted')}>
              {gapAlert ? 'Manque à justifier' : 'Aucun manque'}
            </p>
          }
        />
      </KpiGrid>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Raccourcis */}
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Raccourcis</h2>
          <ul className="space-y-2">
            {SHORTCUTS.filter((s) => !s.adminOnly || isAdmin).map((s) => {
              const Icon = s.icon;
              return (
                <li key={s.href}>
                  <Link
                    href={s.href}
                    className="flex items-center gap-3 rounded-xl bg-surface-secondary px-3.5 py-3 hover:bg-surface-tertiary transition"
                  >
                    <span className={cn('w-9 h-9 shrink-0 rounded-lg flex items-center justify-center', s.tone)}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-foreground truncate">{s.label}</span>
                      <span className="block text-xs text-muted truncate">{s.hint}</span>
                    </span>
                    <ChevronRight className="w-4 h-4 shrink-0 text-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Ventes par point de vente */}
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Ventes par point de vente</h2>
            <span className="text-xs text-muted">{data?.pos_count ?? 0} POS</span>
          </div>
          {loading && !data ? (
            <div className="h-56 flex items-center justify-center text-muted">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : !data?.by_pos.length ? (
            <div className="h-56 flex flex-col items-center justify-center gap-2 text-center">
              <Inbox className="w-8 h-8 text-muted" />
              <p className="text-sm text-muted">Aucune vente sur cette période.</p>
            </div>
          ) : (
            <>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.by_pos} margin={{ top: 8, right: 4, left: 4, bottom: 0 }} barCategoryGap="14%">
                    <defs>
                      <linearGradient id="pos-ok" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6cc06c" />
                        <stop offset="100%" stopColor="#2f8a3f" />
                      </linearGradient>
                      <linearGradient id="pos-gap" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#e05a5a" />
                        <stop offset="100%" stopColor="#c23a3a" />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickFormatter={(v: string) => (v.length > 11 ? `${v.slice(0, 10)}…` : v)}
                    />
                    <Tooltip cursor={{ fill: 'rgba(100,116,139,0.08)' }} content={<PosTooltip />} />
                    <Bar dataKey="revenue" radius={[6, 6, 0, 0]} maxBarSize={72}>
                      {data.by_pos.map((p) => (
                        <Cell key={p.pos_id} fill={p.gap < 0 ? 'url(#pos-gap)' : 'url(#pos-ok)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-[#3f9a4c]" /> Ventes du point de vente
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-[#d04848]" /> Avec un écart de caisse
                </span>
              </p>
            </>
          )}
        </Card>

        {/* Derniers encaissements */}
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Derniers encaissements</h2>
            <Link href="/collections" className="text-xs font-semibold text-accent hover:underline">
              Voir tout
            </Link>
          </div>
          {loading && !data ? (
            <div className="py-10 flex justify-center text-muted">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : !data?.recent.length ? (
            <div className="py-6 text-center space-y-3">
              <p className="text-sm text-muted">Aucun encaissement enregistré.</p>
              <AddButton what="une collecte de caisse" href="/collections/new" />
            </div>
          ) : (
            <ul className="space-y-2">
              {data.recent.map((c) => {
                const gap = c.gap < 0;
                const draft = c.status === 'brouillon';
                return (
                  <li key={c.id}>
                    <Link
                      href={`/collections/${c.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl bg-surface-secondary px-3.5 py-3 hover:bg-surface-tertiary transition"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-foreground truncate">{c.pos}</span>
                        <span className="block text-xs text-muted truncate">
                          {c.collector || 'Collecteur'} · {formatCurrencyFCFA(c.collected)}
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={cn(
                            'text-xs font-semibold px-2.5 py-1 rounded-full',
                            draft
                              ? 'bg-warning-soft text-warning-soft-foreground'
                              : gap
                                ? 'bg-danger-soft text-danger'
                                : 'bg-success-soft text-success-soft-foreground',
                          )}
                        >
                          {draft ? 'Brouillon' : gap ? 'Écart' : 'Validée'}
                        </span>
                        <ChevronRight className="w-4 h-4 text-muted" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
