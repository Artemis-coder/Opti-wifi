'use client';

import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Search,
  Filter,
  Loader2,
  CheckCircle,
  Clock,
  Ban,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { formatCurrencyFCFA, formatDateFR } from '@/lib/utils/format';
import { PaymentStatus } from '@/types/platform';

const STATUS_CONFIG: Record<PaymentStatus, { label: string; color: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  pending: { label: 'En attente', color: 'warning' },
  successful: { label: 'Réussi', color: 'success' },
  failed: { label: 'Échoué', color: 'danger' },
  refunded: { label: 'Remboursé', color: 'info' },
  cancelled: { label: 'Annulé', color: 'neutral' },
};

interface PaymentRecord {
  id: string;
  organization_id: string;
  subscription_id?: string | null;
  plan_id?: string | null;
  amount: number;
  currency: string;
  payment_method?: string | null;
  transaction_reference?: string | null;
  status: PaymentStatus;
  paid_at?: string | null;
  created_at: string;
  organization?: { name?: string; email?: string };
  plan?: { name?: string; price?: number; currency?: string };
}

export default function PlatformPaymentsPage() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    loadPayments();
  }, [statusFilter, search, startDate, endDate]);

  async function loadPayments() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        search,
        start_date: startDate,
        end_date: endDate,
      });
      const res = await fetch(`/api/platform/payments?${params}`);
      const result = await res.json();
      if (res.ok) {
        setPayments(result.data || []);
      }
    } catch {
      // error
    } finally {
      setLoading(false);
    }
  }

  const statusFilters = [
    { value: 'all', label: 'Tous', icon: Filter },
    { value: 'successful', label: 'Réussis', icon: CheckCircle },
    { value: 'failed', label: 'Échoués', icon: XCircle },
    { value: 'pending', label: 'En attente', icon: Clock },
    { value: 'refunded', label: 'Remboursés', icon: RefreshCw },
    { value: 'cancelled', label: 'Annulés', icon: Ban },
  ];

  const totalAmount = payments
    .filter((p) => p.status === 'successful')
    .reduce((acc, p) => acc + Number(p.amount), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Paiements</h1>
          <p className="text-xs text-slate-500">Suivez toutes les transactions de la plateforme.</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Total encaissé (réussi)</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white">
            {formatCurrencyFCFA(totalAmount)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <Input
            label="Date de début"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            label="Date de fin"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-500 uppercase">Statut</label>
            <div className="flex flex-wrap gap-1">
              {statusFilters.map((f) => {
                const Icon = f.icon;
                return (
                  <button
                    key={f.value}
                    onClick={() => setStatusFilter(f.value)}
                    className={`px-2 py-1 rounded-lg text-xs font-medium transition ${
                      statusFilter === f.value
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-amber-500/10'
                    }`}
                  >
                    <Icon className="w-3 h-3 inline mr-1" />
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* Table */}
      {loading ? (
        <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
          <span>Chargement des paiements...</span>
        </div>
      ) : payments.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <Receipt className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucun paiement trouvé</h3>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Montant</th>
                  <th className="px-4 py-3">Moyen</th>
                  <th className="px-4 py-3">Référence</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                {payments.map((p) => {
                  const config = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {p.organization?.name || '—'}
                        </p>
                        <p className="text-xs text-slate-500">{p.organization?.email || ''}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {p.plan?.name || '—'}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                        {formatCurrencyFCFA(Number(p.amount))}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {p.payment_method || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-[10px]">
                        {p.transaction_reference || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={config.color} className="text-xs">
                          {config.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {p.paid_at ? formatDateFR(p.paid_at) : formatDateFR(p.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
