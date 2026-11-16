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
import { StatTile, type StatAccent } from '@/components/ui/StatTile';
import { KpiGrid } from '@/components/ui/KpiGrid';
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

const BORDER_ACCENTS: Record<string, StatAccent> = {
  'border-l-accent': 'indigo',
  'border-l-success': 'emerald',
  'border-l-danger': 'red',
  'border-l-warning': 'amber',
};

/** Cadre de chiffre clé (composant StatTile du design system), avec tendance facultative. */
function StatCard({
  label,
  value,
  sub,
  icon,
  border,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color?: string;
  border: string;
  trend?: { value: number; label: string };
}) {
  return (
    <StatTile
      label={label}
      value={value}
      icon={icon}
      accent={BORDER_ACCENTS[border] || 'slate'}
      footer={
        <>
          {sub && <p className="text-xs text-muted">{sub}</p>}
          {trend !== undefined && (
            <p
              className={`flex items-center gap-1 text-xs font-semibold ${trend.value >= 0 ? 'text-success-soft-foreground' : 'text-danger'}`}
            >
              {trend.value >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {trend.value >= 0 ? '+' : ''}
              {trend.value.toFixed(1)} % {trend.label}
            </p>
          )}
        </>
      }
    />
  );
}

type ExportType = 'csv_clients' | 'csv_payments' | 'csv_subscriptions' | 'csv_audit';

const EXPORTS: { type: ExportType; label: string; description: string }[] = [
  { type: 'csv_clients', label: 'Clients (CSV)', description: 'Liste complète des organisations clientes' },
  { type: 'csv_payments', label: 'Paiements (CSV)', description: 'Historique de tous les paiements' },
  { type: 'csv_subscriptions', label: 'Abonnements (CSV)', description: 'Tous les abonnements avec statut' },
  { type: 'csv_audit', label: "Journal d'audit (CSV)", description: '5 000 dernières actions admin (max)' },
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
      const filename =
        res.headers.get('content-disposition')?.match(/filename="?([^"]+)"?/)?.[1] ||
        `export-${type}-${new Date().toISOString().split('T')[0]}.csv`;
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
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Rapports</h1>
          <p className="text-xs text-muted mt-0.5">Indicateurs commerciaux SaaS et exports de données.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchKpis} isLoading={loading}>
          <RefreshCw className="w-4 h-4" />
          Actualiser
        </Button>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="py-10 flex justify-center items-center gap-2 text-muted text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-accent" />
          <span>Calcul des indicateurs...</span>
        </div>
      ) : kpis ? (
        <>
          <div>
            <h2 className="text-xs font-semibold text-muted mb-3">Indicateurs Clés (SaaS)</h2>
            <KpiGrid cols={{ base: 2, sm: 3, lg: 4 }}>
              <StatCard
                label="MRR"
                value={formatCurrencyFCFA(kpis.mrr)}
                sub="Monthly Recurring Revenue"
                icon={BarChart3}
                color="bg-warning-soft text-warning-soft-foreground"
                border="border-l-warning"
                trend={{ value: kpis.revenue_growth, label: 'vs mois dernier' }}
              />
              <StatCard
                label="ARR"
                value={formatCurrencyFCFA(kpis.arr)}
                sub="Annual Recurring Revenue"
                icon={TrendingUp}
                color="bg-accent-soft text-accent"
                border="border-l-accent"
              />
              <StatCard
                label="Churn"
                value={`${kpis.churn_rate.toFixed(1)} %`}
                sub="Taux de résiliation du mois"
                icon={TrendingDown}
                color={kpis.churn_rate > 5 ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success-soft-foreground'}
                border={kpis.churn_rate > 5 ? 'border-l-danger' : 'border-l-success'}
              />
              <StatCard
                label="ARPU"
                value={formatCurrencyFCFA(kpis.arpu)}
                sub="Revenu moyen par abonné"
                icon={DollarSign}
                color="bg-accent-soft text-accent"
                border="border-l-accent"
              />
              <StatCard
                label="Revenus (mois)"
                value={formatCurrencyFCFA(kpis.revenue_this_month)}
                sub={`Mois précédent : ${formatCurrencyFCFA(kpis.revenue_prev_month)}`}
                icon={Activity}
                color="bg-success-soft text-success-soft-foreground"
                border="border-l-success"
                trend={{ value: kpis.revenue_growth, label: 'croissance' }}
              />
              <StatCard
                label="Nouveaux abonnés"
                value={String(kpis.new_subscriptions_this_month)}
                sub="Ce mois-ci"
                icon={Users}
                color="bg-accent-soft text-accent"
                border="border-l-accent"
              />
              <StatCard
                label="Abonnements actifs"
                value={String(kpis.active_subscriptions)}
                sub="Abonnements en cours"
                icon={Users}
                color="bg-accent-soft text-accent"
                border="border-l-accent"
              />
            </KpiGrid>
          </div>
        </>
      ) : (
        <Card className="text-center py-8">
          <p className="text-muted text-sm">Impossible de charger les indicateurs.</p>
        </Card>
      )}

      {/* Exports Section */}
      <div>
        <h2 className="text-xs font-semibold text-muted mb-3">Export de Données (CSV)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {EXPORTS.map((exp: { type: ExportType; label: string; description: string }) => (
            <Card key={exp.type} className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-default mt-0.5">
                  <FileSpreadsheet className="w-5 h-5 text-success-soft-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{exp.label}</p>
                  <p className="text-xs text-muted mt-0.5">{exp.description}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
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
