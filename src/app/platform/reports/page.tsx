'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Download,
  Loader2,
  RefreshCw,
  FileSpreadsheet,
  DollarSign,
  Activity,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatCurrencyFCFA } from '@/lib/utils/format';

interface ReportKpis {
  mrr: number;
  arr: number;
  churn_rate: number;
  revenue_this_month: number;
  revenue_prev_month: number;
  revenue_growth: number;
  new_subscriptions_this_month: number;
  active_subscriptions: number;
  arpu: number;
  currency: string;
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  border,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
  border: string;
  trend?: { value: number; label: string };
}) {
  return (
    <Card className={`border-l-4 ${border}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-3">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-semibold ${trend.value >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {trend.value >= 0 ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingDown className="w-3 h-3" />
          )}
          <span>
            {trend.value >= 0 ? '+' : ''}{trend.value.toFixed(1)}% {trend.label}
          </span>
        </div>
      )}
    </Card>
  );
}

type ExportType = 'csv_clients' | 'csv_payments' | 'csv_subscriptions' | 'csv_audit';

const EXPORTS: { type: ExportType; label: string; description: string }[] = [
  { type: 'csv_clients', label: 'Clients (CSV)', description: 'Liste complète des organisations clientes' },
  { type: 'csv_payments', label: 'Paiements (CSV)', description: 'Historique de tous les paiements' },
  { type: 'csv_subscriptions', label: 'Abonnements (CSV)', description: 'Tous les abonnements avec statut' },
  { type: 'csv_audit', label: 'Journal d\'audit (CSV)', description: '5 000 dernières actions admin (max)' },
];

export default function PlatformReportsPage() {
  const [kpis, setKpis] = useState<ReportKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<ExportType | null>(null);

  useEffect(() => {
    fetchKpis();
  }, []);

  async function fetchKpis() {
    setLoading(true);
    try {
      const res = await fetch('/api/platform/reports?type=kpi');
      const result = await res.json();
      if (res.ok && result.data) {
        setKpis(result.data);
      }
    } catch (err) {
      console.warn('Reports fetch error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport(type: ExportType) {
    setDownloading(type);
    try {
      const res = await fetch(`/api/platform/reports?type=${type}`);
      if (!res.ok) throw new Error('Erreur export');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = res.headers.get('content-disposition')?.match(/filename="?([^"]+)"?/)?.[1]
        || `export-${type}-${new Date().toISOString().split('T')[0]}.csv`;
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('Export error:', err);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Rapports</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Indicateurs commerciaux SaaS et exports de données.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 font-semibold"
          onClick={fetchKpis}
          isLoading={loading}
        >
          <RefreshCw className="w-4 h-4" />
          Actualiser
        </Button>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="py-10 flex justify-center items-center gap-2 text-slate-500 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
          <span>Calcul des indicateurs...</span>
        </div>
      ) : kpis ? (
        <>
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
              Indicateurs Clés (SaaS)
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <StatCard
                label="MRR"
                value={formatCurrencyFCFA(kpis.mrr)}
                sub="Monthly Recurring Revenue"
                icon={BarChart3}
                color="bg-amber-500/10 text-amber-600 dark:text-amber-400"
                border="border-l-amber-500"
                trend={{ value: kpis.revenue_growth, label: 'vs mois dernier' }}
              />
              <StatCard
                label="ARR"
                value={formatCurrencyFCFA(kpis.arr)}
                sub="Annual Recurring Revenue"
                icon={TrendingUp}
                color="bg-blue-900/10 text-blue-900 dark:text-blue-400"
                border="border-l-blue-900"
              />
              <StatCard
                label="Churn"
                value={`${kpis.churn_rate.toFixed(1)} %`}
                sub="Taux de résiliation du mois"
                icon={TrendingDown}
                color={kpis.churn_rate > 5 ? 'bg-red-500/10 text-red-600' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}
                border={kpis.churn_rate > 5 ? 'border-l-red-500' : 'border-l-emerald-500'}
              />
              <StatCard
                label="ARPU"
                value={formatCurrencyFCFA(kpis.arpu)}
                sub="Revenu moyen par abonné"
                icon={DollarSign}
                color="bg-purple-500/10 text-purple-600 dark:text-purple-400"
                border="border-l-purple-500"
              />
              <StatCard
                label="Revenus (mois)"
                value={formatCurrencyFCFA(kpis.revenue_this_month)}
                sub={`Mois précédent : ${formatCurrencyFCFA(kpis.revenue_prev_month)}`}
                icon={Activity}
                color="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                border="border-l-emerald-500"
                trend={{ value: kpis.revenue_growth, label: 'croissance' }}
              />
              <StatCard
                label="Nouveaux abonnés"
                value={String(kpis.new_subscriptions_this_month)}
                sub="Ce mois-ci"
                icon={Users}
                color="bg-sky-500/10 text-sky-600 dark:text-sky-400"
                border="border-l-sky-500"
              />
              <StatCard
                label="Abonnements actifs"
                value={String(kpis.active_subscriptions)}
                sub="Abonnements en cours"
                icon={Users}
                color="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                border="border-l-indigo-500"
              />
            </div>
          </div>
        </>
      ) : (
        <Card className="p-10 text-center">
          <p className="text-slate-500 text-sm">Impossible de charger les indicateurs.</p>
        </Card>
      )}

      {/* Exports Section */}
      <div>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
          Export de Données (CSV)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {EXPORTS.map((exp) => (
            <Card key={exp.type} className="flex items-center justify-between gap-4 p-5">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 mt-0.5">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{exp.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{exp.description}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-2 font-semibold"
                onClick={() => handleExport(exp.type)}
                isLoading={downloading === exp.type}
              >
                <Download className="w-4 h-4" />
                Exporter
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
