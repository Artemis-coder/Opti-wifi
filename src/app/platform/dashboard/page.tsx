'use client';

import React, { useState, useEffect } from 'react';
import { Building2, UserCheck, PauseCircle, Loader2, Clock, UserPlus, Inbox, KeyRound, AlertTriangle, ArrowRight, Globe2 } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatNumber, formatDateOnlyFR } from '@/lib/utils/format';
import { usePlatformAuthStore } from '@/lib/stores/platformAuthStore';
import { cn } from '@/lib/utils/cn';
import { DashboardKpis } from '@/types/platform';
import { StatTile, type StatAccent } from '@/components/ui/StatTile';
import type { PlatformStats } from '@/lib/platform-stats';
import { PlatformStatsSection, type StatsRange } from '@/components/platform/PlatformStats';
import type { CountryStat } from '@/lib/geo';

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
  { rank: '1er', accent: 'amber' },
  { rank: '2e', accent: 'indigo' },
  { rank: '3e', accent: 'emerald' },
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
      accent: 'amber' as StatAccent,
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
      accent: 'purple' as StatAccent,
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
      <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
        <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
        <span>Chargement du tableau de bord...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-brand-900 to-brand-700 p-6 rounded-2xl text-white shadow-lg border border-slate-800">
        <div>
          <h1 className="text-2xl font-bold">Tableau de Bord Super Administrateur</h1>
          <p className="text-sm text-slate-300 mt-1">Vue globale de la plateforme SaaS OptiWifi</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Badge variant="neutral" className="text-amber-300 border-amber-400/30">
            {platformUser?.role === 'super_admin' ? '👑 Super Admin' : 'Support'}
          </Badge>
        </div>
      </div>

      {/* À traiter */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {todoColumns.map((col) => {
          const Icon = col.icon;
          return (
            <Card key={col.title} className={cn('border-t-4', col.count > 0 ? 'border-t-amber-500' : 'border-t-emerald-500')}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-amber-500" />
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">{col.title}</h2>
                </div>
                <Badge variant={col.count > 0 ? 'warning' : 'success'} className="text-xs">
                  {col.count}
                </Badge>
              </div>
              {col.items.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">{col.empty}</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {col.items.map((it) => (
                    <li key={it.key}>
                      <Link href={it.href} className="block py-2 px-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{it.title}</p>
                        <p
                          className={cn(
                            'text-[11px] truncate',
                            'urgent' in it && it.urgent ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-slate-500'
                          )}
                        >
                          {it.sub}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href={col.href}
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-500"
              >
                Tout voir <ArrowRight className="w-3 h-3" />
              </Link>
            </Card>
          );
        })}
      </section>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
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
      </div>

      {/* Top 3 des pays où l'outil est utilisé */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-amber-500" />
            Top 3 des pays
          </h2>
          {countries && countries.unknown > 0 && (
            <p className="text-[11px] text-slate-500 text-right">
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
          <Card className="p-6 text-center text-xs text-slate-500">
            Pays encore inconnus : ils s&apos;affichent dès la prochaine connexion ou inscription des clients.
          </Card>
        )}
      </section>

      <PlatformStatsSection stats={stats} range={timeRange} onRangeChange={setTimeRange} loading={loading} />
    </div>
  );
}
