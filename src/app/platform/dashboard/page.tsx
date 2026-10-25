'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  UserCheck,
  PauseCircle,
  TrendingUp,
  Calendar,
  BarChart3,
  PieChart as PieChartIcon,
  Loader2,
  Clock,
  MapPin,
  Store,
  Users,
  Ticket,
  Wallet,
  Percent,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ChartCard } from '@/components/platform/ChartCard';
import { formatCurrencyFCFA, formatNumber, formatDateOnlyFR } from '@/lib/utils/format';
import { usePlatformAuthStore } from '@/lib/stores/platformAuthStore';
import { cn } from '@/lib/utils/cn';
import {
  DashboardKpis,
  ChartDataPoint,
  SubscriptionChartDataPoint,
  RevenueChartDataPoint,
  PlanDistributionData,
  OperationsKpis,
  OperationsChartDataPoint,
  TopClient,
  InactiveClient,
} from '@/types/platform';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from 'recharts';

interface OperationsData {
  kpis: OperationsKpis;
  chart: OperationsChartDataPoint[];
  top_clients: TopClient[];
  inactive_clients: InactiveClient[];
  inactivity_days: number;
}

type TimeRange = '7d' | '30d' | '90d' | '6m' | '1y';

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: '90d', label: '3 mois' },
  { value: '6m', label: '6 mois' },
  { value: '1y', label: '1 an' },
];

export default function PlatformDashboardPage() {
  const { platformUser } = usePlatformAuthStore();
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [registrationsChart, setRegistrationsChart] = useState<ChartDataPoint[]>([]);
  const [subscriptionsChart, setSubscriptionsChart] = useState<SubscriptionChartDataPoint[]>([]);
  const [revenueChart, setRevenueChart] = useState<RevenueChartDataPoint[]>([]);
  const [planDistribution, setPlanDistribution] = useState<PlanDistributionData[]>([]);
  const [operations, setOperations] = useState<OperationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/platform/dashboard?range=${timeRange}`);
        const result = await res.json();

        if (res.ok && result.kpis) {
          setKpis(result.kpis);
          setRegistrationsChart(result.charts?.registrations || []);
          setSubscriptionsChart(result.charts?.subscriptions || []);
          setRevenueChart(result.charts?.revenue || []);
          setPlanDistribution(result.charts?.planDistribution || []);
          setOperations(result.operations || null);
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
      color: 'bg-blue-900/10 text-blue-900 dark:text-blue-400',
      border: 'border-l-blue-900',
    },
    {
      label: 'Clients Actifs',
      value: kpis?.active_clients ?? 0,
      icon: UserCheck,
      color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      border: 'border-l-emerald-500',
    },
    {
      label: 'Clients Suspendus',
      value: kpis?.suspended_clients ?? 0,
      icon: PauseCircle,
      color: 'bg-red-500/10 text-red-600 dark:text-red-400',
      border: 'border-l-red-500',
    },
    {
      label: 'Nouveaux (7j)',
      value: kpis?.new_clients_this_week ?? 0,
      icon: TrendingUp,
      color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
      border: 'border-l-purple-500',
    },
    {
      label: 'Abonnements Actifs',
      value: kpis?.active_subscriptions ?? 0,
      icon: Calendar,
      color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      border: 'border-l-amber-500',
    },
    {
      label: 'Expirations (30j)',
      value: kpis?.expiring_subscriptions ?? 0,
      icon: Clock,
      color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
      border: 'border-l-orange-500',
    },
  ];

  const revenueCards = [
    { label: "Aujourd'hui", value: kpis?.revenue_today ?? 0, period: 'today' as const },
    { label: '7 jours', value: kpis?.revenue_this_week ?? 0, period: 'week' as const },
    { label: 'Ce mois', value: kpis?.revenue_this_month ?? 0, period: 'month' as const },
    { label: 'Cette année', value: kpis?.revenue_this_year ?? 0, period: 'year' as const },
  ];

  const ops = operations?.kpis;
  const operationCards = [
    { label: 'Espaces WiFi', value: formatNumber(ops?.spaces ?? 0), icon: MapPin },
    { label: 'POS actifs', value: `${formatNumber(ops?.pos_active ?? 0)} / ${formatNumber(ops?.pos_total ?? 0)}`, icon: Store },
    { label: 'Utilisateurs clients', value: formatNumber(ops?.users_total ?? 0), icon: Users },
    { label: 'Tickets alloués', value: formatNumber(ops?.tickets_allocated ?? 0), icon: Ticket },
    { label: 'Tickets vendus', value: formatNumber(ops?.tickets_sold ?? 0), icon: Ticket },
    { label: 'Montant encaissé', value: formatCurrencyFCFA(ops?.amount_collected ?? 0), icon: Wallet },
    { label: 'Commissions', value: formatCurrencyFCFA(ops?.commissions ?? 0), icon: Percent },
    { label: 'Écarts négatifs', value: formatCurrencyFCFA(ops?.shortfall ?? 0), icon: AlertTriangle, danger: (ops?.shortfall ?? 0) < 0 },
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
          <h1 className="text-2xl font-bold">
            Tableau de Bord Super Administrateur
          </h1>
          <p className="text-sm text-slate-300 mt-1">
            Vue globale de la plateforme SaaS OptiWifi
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Badge variant="neutral" className="text-amber-300 border-amber-400/30">
            {platformUser?.role === 'super_admin' ? '👑 Super Admin' : 'Support'}
          </Badge>
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 uppercase">Période :</span>
        {TIME_RANGES.map((r) => (
          <Button
            key={r.value}
            variant={timeRange === r.value ? 'primary' : 'outline'}
            size="sm"
            className="text-xs font-medium"
            onClick={() => setTimeRange(r.value)}
          >
            {r.label}
          </Button>
        ))}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className={cn('border-l-4', kpi.border)}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {kpi.label}
                </span>
                <div className={cn('p-2 rounded-lg', kpi.color)}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-3">
                {formatNumber(kpi.value)}
              </p>
            </Card>
          );
        })}
      </div>

      {/* Revenue Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {revenueCards.map((r) => (
          <Card key={r.period} className="border-l-4 border-l-emerald-500">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {r.label}
              </span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <BarChart3 className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-3">
              {formatCurrencyFCFA(r.value)}
            </p>
          </Card>
        ))}
      </div>

      {/* Operations (all clients) */}
      {operations && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Activité opérationnelle</h2>
              <p className="text-xs text-slate-500">
                Tous clients confondus · {ops?.collections_count ?? 0} encaissement(s) validé(s) sur la période
              </p>
            </div>
            <Link href="/platform/explorer">
              <Button variant="outline" size="sm" className="text-xs">
                Explorer les données <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {operationCards.map((c) => {
              const Icon = c.icon;
              return (
                <Card key={c.label} className={cn('border-l-4', c.danger ? 'border-l-red-500' : 'border-l-sky-500')}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{c.label}</span>
                    <div className={cn('p-2 rounded-lg', c.danger ? 'bg-red-500/10 text-red-600' : 'bg-sky-500/10 text-sky-600 dark:text-sky-400')}>
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                  <p className={cn('text-xl font-extrabold mt-3', c.danger ? 'text-red-600' : 'text-slate-900 dark:text-white')}>
                    {c.value}
                  </p>
                </Card>
              );
            })}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <ChartCard title="Encaissements quotidiens (tous clients)">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={operations.chart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3a3' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3a3' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                      labelStyle={{ fontSize: 11 }}
                      formatter={(value: unknown, name: unknown) =>
                        name === 'amount'
                          ? [formatCurrencyFCFA(Number(value)), 'Montant']
                          : [formatNumber(Number(value)), 'Tickets']
                      }
                    />
                    <Bar dataKey="amount" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <ChartCard title="Top clients (montant encaissé)">
              {operations.top_clients.length > 0 ? (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {operations.top_clients.map((c, idx) => (
                    <li key={c.id}>
                      <Link
                        href={`/platform/clients/${c.id}`}
                        className="flex items-center justify-between py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded px-1"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold text-slate-400 w-4">{idx + 1}</span>
                          <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{c.name}</span>
                        </span>
                        <span className="text-right shrink-0">
                          <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                            {formatCurrencyFCFA(c.amount)}
                          </span>
                          <span className="block text-[10px] text-slate-500">{c.collections_count} encaissement(s)</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
                  Aucun encaissement sur la période
                </div>
              )}
            </ChartCard>
          </div>

          {operations.inactive_clients.length > 0 && (
            <Card className="border-l-4 border-l-orange-500">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Clients actifs sans encaissement depuis {operations.inactivity_days} jours
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {operations.inactive_clients.map((c) => (
                  <Link
                    key={c.id}
                    href={`/platform/clients/${c.id}`}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-orange-400 text-slate-700 dark:text-slate-300"
                  >
                    <span className="font-semibold">{c.name}</span>
                    <span className="text-slate-500 ml-1.5">
                      {c.last_collection ? `dernier : ${formatDateOnlyFR(c.last_collection)}` : 'jamais'}
                    </span>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </section>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Inscription Evolution */}
        <ChartCard title="Évolution des Inscriptions">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={registrationsChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3a3' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3a3' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                labelStyle={{ fontSize: 11 }}
              />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
              <Line type="monotone" dataKey="new_accounts" stroke="#F59E0B" strokeWidth={2} dot={false} name="Nouveaux" />
              <Line type="monotone" dataKey="activated" stroke="#10B981" strokeWidth={2} dot={false} name="Activés" />
              <Line type="monotone" dataKey="deactivated" stroke="#EF4444" strokeWidth={2} dot={false} name="Désactivés" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Subscription Evolution */}
        <ChartCard title="Évolution des Abonnements">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={subscriptionsChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3a3' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3a3' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                labelStyle={{ fontSize: 11 }}
              />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
              <Line type="monotone" dataKey="new_subscriptions" stroke="#3B82F6" strokeWidth={2} dot={false} name="Nouveaux" />
              <Line type="monotone" dataKey="renewals" stroke="#8B5CF6" strokeWidth={2} dot={false} name="Renouvellements" />
              <Line type="monotone" dataKey="expirations" stroke="#F59E0B" strokeWidth={2} dot={false} name="Expirations" />
              <Line type="monotone" dataKey="cancellations" stroke="#EF4444" strokeWidth={2} dot={false} name="Annulations" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Revenue Evolution */}
        <ChartCard title="Évolution des Revenus">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={revenueChart}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3a3' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3a3' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                labelStyle={{ fontSize: 11 }}
                formatter={(value: unknown) => [formatCurrencyFCFA(Number(value)), 'Revenus']}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#10B981"
                fill="url(#revenueGradient)"
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Plan Distribution */}
        <ChartCard title="Répartition des Abonnements">
          {planDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={planDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }: { name?: string; percent?: number }) =>
                    name && percent !== undefined ? `${name}: ${(percent * 100).toFixed(0)}%` : ''
                  }
                  labelLine={false}
                >
                  {planDistribution.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                  formatter={(value: unknown) => [Number(value), 'Abonnements']}
                />
                <Legend
                  layout="horizontal"
                  verticalAlign="bottom"
                  align="center"
                  wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
              <PieChartIcon className="w-8 h-8 mr-2" />
              Aucun abonnement enregistré
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
