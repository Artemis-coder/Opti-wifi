'use client';

import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Loader2,
  Receipt,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Ban,
  Eye,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrencyFCFA, formatDateFR } from '@/lib/utils/format';
import { Invoice, InvoiceStatus } from '@/types/platform';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
import { KpiTiles } from '@/components/platform/KpiTiles';
import type { InvoiceStats } from '@/lib/billing-stats';

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  draft: { label: 'Brouillon', color: 'neutral' },
  issued: { label: 'Émise', color: 'info' },
  paid: { label: 'Payée', color: 'success' },
  overdue: { label: 'En retard', color: 'danger' },
  cancelled: { label: 'Annulée', color: 'neutral' },
};

interface InvoiceRecord {
  id: string;
  organization_id: string;
  subscription_id?: string | null;
  invoice_number: string;
  plan_name?: string | null;
  duration_months?: number | null;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  issued_at?: string | null;
  due_at?: string | null;
  paid_at?: string | null;
  created_at: string;
  organization?: { name?: string; email?: string };
}

export default function PlatformInvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [stats, setStats] = useState<InvoiceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadInvoices();
  }, [search, statusFilter]);

  async function loadInvoices() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: statusFilter, search });
      const res = await fetch(`/api/platform/invoices?${params}`);
      const result = await res.json();
      if (res.ok) {
        setInvoices(result.data || []);
        if (result.stats) setStats(result.stats);
      }
    } catch {
      // error
    } finally {
      setLoading(false);
    }
  }

  const statusFilters = [
    { value: 'all', label: 'Toutes' },
    { value: 'paid', label: 'Payées' },
    { value: 'issued', label: 'Émises' },
    { value: 'overdue', label: 'En retard' },
    { value: 'draft', label: 'Brouillons' },
    { value: 'cancelled', label: 'Annulées' },
  ];

  const totalOutstanding = invoices
    .filter((i: InvoiceRecord) => i.status !== 'paid' && i.status !== 'cancelled' && i.status !== 'draft')
    .reduce((acc: number, i: InvoiceRecord) => acc + Number(i.amount), 0);

  if (loading) {
    return (
      <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
        <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
        <span>Chargement des factures...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Factures</h1>
          <p className="text-xs text-slate-500">Factures de licence émises à chaque activation payante.</p>
        </div>
        {totalOutstanding > 0 && (
          <div className="sm:text-right">
            <p className="text-xs text-slate-500">Montant dû (impayé)</p>
            <p className="text-xl font-bold text-red-600">{formatCurrencyFCFA(totalOutstanding)}</p>
          </div>
        )}
      </div>

      {/* Chiffres clés */}
      <KpiTiles
        loading={!stats}
        tiles={[
          {
            label: 'Montant encaissé',
            value: formatCurrencyFCFA(stats?.paid_amount ?? 0),
            sub: `${stats?.paid ?? 0} facture${(stats?.paid ?? 0) > 1 ? 's' : ''} payée${(stats?.paid ?? 0) > 1 ? 's' : ''}`,
            highlight: true,
          },
          {
            label: 'Ce mois-ci',
            value: formatCurrencyFCFA(stats?.month_amount ?? 0),
            sub: `${stats?.month_count ?? 0} facture${(stats?.month_count ?? 0) > 1 ? 's' : ''} émise${(stats?.month_count ?? 0) > 1 ? 's' : ''}`,
          },
          {
            label: 'Renouvellements',
            value: String(stats?.renewals ?? 0),
            sub: `${stats?.new_count ?? 0} nouvelle${(stats?.new_count ?? 0) > 1 ? 's' : ''} · ${stats?.upgrades ?? 0} changement${(stats?.upgrades ?? 0) > 1 ? 's' : ''} de forfait`,
          },
          {
            label: 'Facture moyenne',
            value: formatCurrencyFCFA(stats?.average ?? 0),
            sub: `${stats?.clients ?? 0} client${(stats?.clients ?? 0) > 1 ? 's' : ''} facturé${(stats?.clients ?? 0) > 1 ? 's' : ''}`,
          },
        ]}
      />

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par nom de client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {statusFilters.map((f: { value: string; label: string }) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                  statusFilter === f.value
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-amber-500/10'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {invoices.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucune facture trouvée</h3>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <ResponsiveTable>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Numéro</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Montant</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Émise</th>
                  <th className="px-4 py-3">Forfait</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                {invoices.map((inv: InvoiceRecord) => {
                  const config = STATUS_CONFIG[inv.status as InvoiceStatus] || STATUS_CONFIG.draft;
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                        {inv.invoice_number}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {inv.organization?.name || '—'}
                        </p>
                        <p className="text-xs text-slate-500">{inv.organization?.email || ''}</p>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                        {formatCurrencyFCFA(Number(inv.amount))}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={config.color} className="text-xs">
                          {config.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {inv.issued_at ? formatDateFR(inv.issued_at) : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {inv.plan_name ? `${inv.plan_name}${inv.duration_months ? ` · ${inv.duration_months} mois` : ''}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/platform/invoices/${inv.id}`}
                          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                        >
                          <Eye className="w-4 h-4" /> Voir
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ResponsiveTable>
        </Card>
      )}
    </div>
  );
}
