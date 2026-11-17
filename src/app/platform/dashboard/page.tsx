'use client';

import React, { useState, useEffect } from 'react';
import { Building2, UserCheck, PauseCircle, Clock, UserPlus, Inbox, KeyRound, AlertTriangle, ArrowRight, Globe2 } from 'lucide-react';
import Link from 'next/link';
import { Card, Chip, Spinner } from '@heroui/react';
import { formatNumber, formatDateOnlyFR } from '@/lib/utils/format';
import { usePlatformAuthStore } from '@/lib/stores/platformAuthStore';
import { cn } from '@/lib/utils/cn';
import { DashboardKpis } from '@/types/platform';
import { StatTile, type StatAccent } from '@/components/ui/StatTile';
import { KpiGrid } from '@/components/ui/KpiGrid';
import type { PlatformStats } from '@/lib/platform-stats';
import { PlatformStatsSection, type StatsRange } from '@/components/platform/PlatformStats';
import type { CountryStat } from '@/lib/geo';
import { SystemStatusCard } from '@/components/platform/SystemStatusCard';

interface TodoData {
  pending_registrations: { id: string; name: string; contact_name: string | null; phone: string | null; created_at: string }[];
  pending_license_requests: {
    id: string;
    type: string;
    organization_id: string;
    organization_name: string;
    plan_name: string | null;
    duration_months: number;
    created_at: string;
  }[];
  upcoming_expirations: {
    id: string;
    organization_id: string;
    organization_name: string;
    plan_name: string | null;
    end_date: string;
    is_trial: boolean;
    days_left: number;
  }[];
}

interface CountriesData {
  top: CountryStat[];
  known: number;
  unknown: number;
}

/** Colonnes de la rangée du Top pays selon le nombre de pays affichés (classes Tailwind complètes) */
const COUNTRY_COLUMNS: Record<number, string> = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' };

const PODIUM: { rank: string; accent: StatAccent }[] = [
  { rank: '1er', accent: 'indigo' },
  { rank: '2e', accent: 'slate' },
  { rank: '3e', accent: 'slate' },
];

function whenLabel(days: number): string {
  return days <= 0 ? "aujourd'hui" : days === 1 ? 'demain' : `dans ${days} jours`;
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  renewal: 'Renouvellement',
  new: 'Nouvelle licence',
  upgrade: 'Changement de forfait',
};

export default function PlatformDashboardPage() {
  const { platformUser } = usePlatformAuthStore();
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [todo, setTodo] = useState<TodoData | null>(null);
  const [countries, setCountries] = useState<CountriesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<StatsRange>('30d');

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/platform/dashboard?range=${timeRange}`);
        const result = await res.json();

        if (res.ok && result.kpis) {
          setKpis(result.kpis);
          setStats(result.stats || null);
          setTodo(result.todo || null);
          setCountries(result.countries || null);
        }
      } catch (err) {
        console.warn('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [timeRange]);

  const kpiCards = [
    {
      label: 'Clients',
      value: kpis?.total_clients ?? 0,
      icon: Building2,
      accent: 'indigo' as StatAccent,
      href: '/platform/clients',
    },
    {
      label: 'Espaces actifs',
      value: kpis?.active_clients ?? 0,
      icon: UserCheck,
      accent: 'emerald' as StatAccent,
      href: '/platform/clients',
    },
    {
      label: 'Espaces désactivés',
      value: kpis?.suspended_clients ?? 0,
      icon: PauseCircle,
      accent: 'red' as StatAccent,
      href: '/platform/clients',
    },
    {
      label: 'Licences actives',
      value: kpis?.active_subscriptions ?? 0,
      icon: KeyRound,
      accent: 'emerald' as StatAccent,
      href: '/platform/subscriptions',
    },
    {
      label: 'Expirent sous 7 j',
      value: kpis?.expiring_7d ?? 0,
      icon: Clock,
      accent: 'amber' as StatAccent,
      href: '/platform/subscriptions/expiring',
      alert: (kpis?.expiring_7d ?? 0) > 0,
    },
    {
      label: 'Sans licence active',
      value: kpis?.clients_without_license ?? 0,
      icon: AlertTriangle,
      accent: 'amber' as StatAccent,
      href: '/platform/clients',
    },
  ];

  const todoColumns = [
    {
      title: 'Inscriptions à valider',
      count: kpis?.pending_registrations ?? 0,
      icon: UserPlus,
      href: '/platform/registrations',
      empty: 'Aucune inscription en attente',
      items: (todo?.pending_registrations || []).map((r) => ({
        key: r.id,
        href: `/platform/clients/${r.id}`,
        title: r.name,
        sub: `${r.contact_name || r.phone || ''} · ${formatDateOnlyFR(r.created_at)}`,
      })),
    },
    {
      title: 'Demandes de licence',
      count: kpis?.pending_license_requests ?? 0,
      icon: Inbox,
      href: '/platform/license-requests',
      empty: 'Aucune demande en attente',
      items: (todo?.pending_license_requests || []).map((r) => ({
        key: r.id,
        href: '/platform/license-requests',
        title: r.organization_name,
        sub: `${REQUEST_TYPE_LABELS[r.type] || 'Demande'} · ${r.plan_name || 'Forfait'} · ${r.duration_months} mois`,
      })),
    },
    {
      title: 'Licences qui expirent (7 j)',
      count: kpis?.expiring_7d ?? 0,
      icon: Clock,
      href: '/platform/subscriptions/expiring',
      empty: 'Aucune licence n’expire dans les 7 jours',
      items: (todo?.upcoming_expirations || []).map((r) => ({
        key: r.id,
        href: `/platform/clients/${r.organization_id}`,
        title: r.organization_name,
        sub: `${r.is_trial ? 'Essai' : r.plan_name || 'Forfait'} · fin ${whenLabel(r.days_left)}`,
        urgent: r.days_left <= 2,
      })),
    },
  ];

  if (loading && !kpis) {
    return (
      <div className="flex items-center justify-center gap-3 py-10 text-sm text-muted">
        <Spinner size="sm" />
        <span>Chargement du tableau de bord…</span>
      </div>
    );
  }

  const firstName = (platformUser?.full_name || '').trim().split(/\s+/)[0];
  const today = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const pendingTotal = todoColumns.reduce((n, c) => n + c.count, 0);

  return (
    <div className="space-y-5">
      {/* En-tête de page */}
      <div className="flex flex-col gap-1">
        <p className="text-sm capitalize text-muted">{today}</p>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          {firstName ? `Bonjour ${firstName}` : 'Bonjour'}
        </h2>
        <p className="text-sm text-muted">
          {pendingTotal > 0
            ? `${pendingTotal} élément${pendingTotal > 1 ? 's' : ''} à traiter sur la plateforme.`
            : 'Rien à traiter pour le moment : tout est à jour.'}
        </p>
      </div>

      {/* État du système */}
      <SystemStatusCard />

      {/* À traiter */}
      <section aria-labelledby="todo-title" className="space-y-3">
        <h2 id="todo-title" className="text-lg font-semibold text-foreground">
          À traiter
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
          {todoColumns.map((col) => {
            const Icon = col.icon;
            return (
              <Card key={col.title} className="">
                <Card.Header className="flex-row items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Icon className="size-4 shrink-0 text-muted" />
                    <Card.Title className="truncate">{col.title}</Card.Title>
                  </div>
                  <Chip size="sm" variant="soft" color={col.count > 0 ? 'warning' : 'success'}>
                    {col.count}
                  </Chip>
                </Card.Header>
                <Card.Content className="gap-0">
                  {col.items.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted">{col.empty}</p>
                  ) : (
                    <ul className="-mx-2 flex flex-col">
                      {col.items.map((it) => (
                        <li key={it.key}>
                          <Link
                            href={it.href}
                            className="block rounded-xl px-2 py-2 outline-none transition-colors hover:bg-default focus-visible:ring-2 focus-visible:ring-focus"
                          >
                            <p className="truncate text-sm font-medium text-foreground">{it.title}</p>
                            <p
                              className={cn(
                                'truncate text-xs',
                                'urgent' in it && it.urgent ? 'font-medium text-danger' : 'text-muted'
                              )}
                            >
                              {it.sub}
                            </p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card.Content>
                <Card.Footer>
                  <Link
                    href={col.href}
                    className="inline-flex items-center gap-1 rounded-xl text-sm font-medium text-accent outline-none transition-all hover:gap-2 focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    Tout voir <ArrowRight className="size-3.5" />
                  </Link>
                </Card.Footer>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Chiffres clés */}
      <section aria-labelledby="kpi-title" className="space-y-3">
        <h2 id="kpi-title" className="text-lg font-semibold text-foreground">
          Vue d&apos;ensemble
        </h2>
        <KpiGrid cols={{ base: 2, sm: 3, xl: 6 }}>
          {kpiCards.map((kpi) => (
            <StatTile
              key={kpi.label}
              label={kpi.label}
              value={formatNumber(kpi.value)}
              icon={kpi.icon}
              accent={kpi.accent}
              href={kpi.href}
              alert={'alert' in kpi ? kpi.alert : undefined}
              className="h-full"
            />
          ))}
        </KpiGrid>
      </section>

      {/* Top 3 des pays où l'outil est utilisé */}
      <section aria-labelledby="countries-title" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="countries-title" className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Globe2 className="size-4 text-muted" />
            Top 3 des pays
          </h2>
          {countries && countries.unknown > 0 && (
            <p className="text-xs text-muted">
              Pays inconnu pour {countries.unknown} client{countries.unknown > 1 ? 's' : ''} (enregistré à leur prochaine
              connexion)
            </p>
          )}
        </div>
        {countries && countries.top.length > 0 ? (
          // Les cartes se partagent toute la ligne : 1, 2 ou 3 colonnes selon le nombre de pays
          <div className={cn('grid grid-cols-1 gap-3 sm:gap-4', COUNTRY_COLUMNS[Math.min(3, countries.top.length)])}>
            {countries.top.slice(0, 3).map((c, i) => (
              <StatTile
                key={c.code}
                label={`${PODIUM[i].rank} · ${c.name}`}
                value={
                  <span className="flex items-center gap-2">
                    <span aria-hidden className="text-2xl leading-none">
                      {c.flag}
                    </span>
                    {formatNumber(c.clients)} client{c.clients > 1 ? 's' : ''}
                  </span>
                }
                accent={PODIUM[i].accent}
                hint={`${c.share} % des clients`}
              />
            ))}
          </div>
        ) : (
          <Card>
            <Card.Content>
              <p className="py-2 text-center text-sm text-muted">
                Pays encore inconnus : ils s&apos;affichent dès la prochaine connexion ou inscription des clients.
              </p>
            </Card.Content>
          </Card>
        )}
      </section>

      <PlatformStatsSection stats={stats} range={timeRange} onRangeChange={setTimeRange} loading={loading} />
    </div>
  );
}
