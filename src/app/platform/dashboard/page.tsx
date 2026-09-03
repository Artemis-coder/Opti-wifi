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
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ChartCard } from '@/components/platform/ChartCard';
import { formatCurrencyFCFA, formatNumber } from '@/lib/utils/format';
import { usePlatformAuthStore } from '@/lib/stores/platformAuthStore';
import { cn } from '@/lib/utils/cn';
import {
  DashboardKpis,
  ChartDataPoint,
  SubscriptionChartDataPoint,
  RevenueChartDataPoint,
  PlanDistributionData,
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
} from 'recharts';

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#0b1a3a] to-[#162e63] p-6 rounded-2xl text-white shadow-lg border border-slate-800">
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
