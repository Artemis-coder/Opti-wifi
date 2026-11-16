'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
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
  CheckCircle2,
  CalendarDays,
  Banknote,
  AlertTriangle,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrencyFCFA, formatDateFR } from '@/lib/utils/format';
import { PaymentStatus } from '@/types/platform';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
import { DateField } from '@/components/ui/DateField';
import { KpiTiles } from '@/components/platform/KpiTiles';
import type { PaymentStats } from '@/lib/billing-stats';
import { OnlinePaymentsSection } from '@/components/platform/OnlinePaymentsSection';
import { PaymentChannelSwitch, type PaymentChannel } from '@/components/platform/PaymentChannelSwitch';

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
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  // Vue : paiements en ligne (SasPay) ou manuels ; par défaut, le mode actif pour les clients
  const [channel, setChannel] = useState<PaymentChannel | null>(null);

  // Chargement à chaque changement de filtre ; « loading » = la liste affichée ne correspond pas encore aux filtres
  const filterKey = JSON.stringify([statusFilter, search, startDate, endDate]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== filterKey;

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ status: statusFilter, search, start_date: startDate, end_date: endDate });
    fetch(`/api/platform/payments?${params}`)
      .then(async (res) => ({ ok: res.ok, result: await res.json().catch(() => ({})) }))
      .then(({ ok, result }) => {
        if (cancelled) return;
        if (ok) {
          // Liste « paiement manuel » : sans les paiements SasPay (affichés dans l'onglet en ligne)
          setPayments(
            ((result.data || []) as PaymentRecord[]).filter((p) => !(p.payment_method || '').startsWith('SasPay'))
          );
          if (result.stats) setStats(result.stats);
        } else {
          toast.error(result.error || 'Impossible de charger les paiements.');
        }
      })
      .catch((err) => {
        console.error('Chargement des paiements :', err);
        if (!cancelled) toast.error('Impossible de charger les paiements. Vérifiez votre connexion.');
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(filterKey);
      });
    return () => {
      cancelled = true;
    };
  }, [statusFilter, search, startDate, endDate, filterKey]);

  const statusFilters = [
    { value: 'all', label: 'Tous', icon: Filter },
    { value: 'successful', label: 'Réussis', icon: CheckCircle },
    { value: 'failed', label: 'Échoués', icon: XCircle },
    { value: 'pending', label: 'En attente', icon: Clock },
    { value: 'refunded', label: 'Remboursés', icon: RefreshCw },
    { value: 'cancelled', label: 'Annulés', icon: Ban },
  ];

  const totalAmount = payments
    .filter((p: PaymentRecord) => p.status === 'successful')
    .reduce((acc: number, p: PaymentRecord) => acc + Number(p.amount), 0);

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Transactions</h1>
          <p className="text-xs text-muted">Paiements de licence enregistrés à chaque activation validée.</p>
        </div>
        <div className="sm:text-right">
          <p className="text-xs text-muted">Total de la liste filtrée</p>
          <p className="text-lg font-semibold text-foreground">{formatCurrencyFCFA(totalAmount)}</p>
        </div>
      </div>

      {/* Chiffres clés */}
      <KpiTiles
        loading={!stats}
        tiles={[
          {
            label: 'Total encaissé',
            icon: CheckCircle2,
            accent: 'emerald',
            value: formatCurrencyFCFA(stats?.successful_amount ?? 0),
            sub: `${stats?.successful ?? 0} transaction${(stats?.successful ?? 0) > 1 ? 's' : ''} réussie${(stats?.successful ?? 0) > 1 ? 's' : ''}`,
            highlight: true,
          },
          {
            label: 'Ce mois-ci',
            icon: CalendarDays,
            accent: 'indigo',
            value: formatCurrencyFCFA(stats?.month_amount ?? 0),
            sub: `${stats?.month_count ?? 0} transaction${(stats?.month_count ?? 0) > 1 ? 's' : ''}`,
          },
          {
            label: 'Montant moyen',
            icon: Banknote,
            accent: 'purple',
            value: formatCurrencyFCFA(stats?.average ?? 0),
            sub: 'par transaction réussie',
          },
          {
            label: 'À vérifier',
            icon: AlertTriangle,
            accent: 'amber',
            value: String((stats?.pending ?? 0) + (stats?.failed ?? 0)),
            sub: `${stats?.pending ?? 0} en attente · ${stats?.failed ?? 0} échouée${(stats?.failed ?? 0) > 1 ? 's' : ''}`,
          },
        ]}
      />

      {stats && stats.by_method.length > 0 && (
        <Card className="space-y-3">
          <p className="text-xs font-semibold text-muted">Par moyen de paiement</p>
          <ul className="space-y-2.5">
            {stats.by_method.map((m) => {
              const pct = stats.successful_amount ? Math.round((m.amount / stats.successful_amount) * 100) : 0;
              return (
                <li key={m.method} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-semibold text-foreground">{m.method}</span>
                    <span className="tabular-nums font-semibold text-foreground">
                      {formatCurrencyFCFA(m.amount)}{' '}
                      <span className="font-medium text-muted">
                        · {m.count} · {pct} %
                      </span>
                    </span>
                  </div>
                  <div
                    className="h-2 rounded-full bg-default overflow-hidden"
                    role="img"
                    aria-label={`${m.method} : ${pct} % des encaissements`}
                  >
                    <div className="h-full rounded-full bg-[#2a78d6] dark:bg-[#3987e5]" style={{ width: `${Math.max(pct, 2)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <PaymentChannelSwitch view={channel} onChange={setChannel} />

      {channel === 'online' && <OnlinePaymentsSection />}

      {channel === 'manual' && (
      <>
      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted" />
            <input
              type="text"
              placeholder="Rechercher un client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input input--primary w-full pl-10 pr-3"
            />
          </div>
          <DateField label="Date de début" value={startDate} onChange={setStartDate} max={endDate || undefined} clearable />
          <DateField label="Date de fin" value={endDate} onChange={setEndDate} min={startDate || undefined} clearable />
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-muted">Statut</label>
            <div className="flex flex-wrap gap-1">
              {statusFilters.map((f: { value: string; label: string; icon: React.ElementType }) => {
                const Icon = f.icon;
                return (
                  <button
                    key={f.value}
                    onClick={() => setStatusFilter(f.value)}
                    className={`px-2 py-1 rounded-xl text-xs font-medium transition ${
                      statusFilter === f.value
                        ? 'bg-accent text-accent-foreground font-medium'
                        : 'bg-default text-muted hover:bg-default-hover hover:text-foreground'
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
        <div className="py-10 flex justify-center items-center gap-2 text-muted text-sm font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-accent" />
          <span>Chargement des paiements...</span>
        </div>
      ) : payments.length === 0 ? (
        <Card className="text-center space-y-3 py-8">
          <Receipt className="w-12 h-12 text-muted mx-auto" />
          <h3 className="text-base font-semibold text-foreground">Aucun paiement trouvé</h3>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <ResponsiveTable>
            <table className="w-full text-left text-xs">
              <thead className="bg-default text-muted font-semibold">
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
              <tbody className="divide-y divide-separator font-medium">
                {payments.map((p: PaymentRecord) => {
                  const config = STATUS_CONFIG[p.status as PaymentStatus] || STATUS_CONFIG.pending;
                  return (
                    <tr key={p.id} className="hover:bg-surface-secondary transition">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-foreground">{p.organization?.name || '—'}</p>
                        <p className="text-xs text-muted">{p.organization?.email || ''}</p>
                      </td>
                      <td className="px-4 py-3 text-muted">{p.plan?.name || '—'}</td>
                      <td className="px-4 py-3 font-semibold text-foreground">{formatCurrencyFCFA(Number(p.amount))}</td>
                      <td className="px-4 py-3 text-muted">{p.payment_method || '—'}</td>
                      <td className="px-4 py-3 text-muted font-mono text-xs">{p.transaction_reference || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={config.color} className="text-xs">
                          {config.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted">{p.paid_at ? formatDateFR(p.paid_at) : formatDateFR(p.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ResponsiveTable>
        </Card>
      )}
      </>
      )}
    </div>
  );
}
