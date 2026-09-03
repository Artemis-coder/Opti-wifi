'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2,
  Search,
  Filter,
  Loader2,
  MoreHorizontal,
  CheckCircle,
  PauseCircle,
  Ban,
  Clock,
  Zap,
  AlertCircle,
  Activity,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatCurrencyFCFA, formatDateFR } from '@/lib/utils/format';
import { OrganizationStatus } from '@/types/platform';

interface ClientOrg {
  id: string;
  name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  status: OrganizationStatus;
  currency: string;
  created_at: string;
  plan_name?: string | null;
  subscription_status?: string | null;
  subscription_end_date?: string | null;
  subscription_trial_end?: string | null;
}

const STATUS_CONFIG: Record<OrganizationStatus, { label: string; color: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  trial: { label: 'Essai', color: 'info' },
  active: { label: 'Actif', color: 'success' },
  expiring: { label: 'Expire bientôt', color: 'warning' },
  expired: { label: 'Expiré', color: 'danger' },
  suspended: { label: 'Suspendu', color: 'danger' },
  cancelled: { label: 'Annulé', color: 'neutral' },
  archived: { label: 'Archivé', color: 'neutral' },
};

const STATUS_ICONS: Record<OrganizationStatus, React.ElementType> = {
  trial: Clock,
  active: CheckCircle,
  expiring: Clock,
  expired: Ban,
  suspended: PauseCircle,
  cancelled: Ban,
  archived: AlertCircle,
};

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'trial', label: 'Essai' },
  { value: 'active', label: 'Actifs' },
  { value: 'expiring', label: 'Expire bientôt' },
  { value: 'expired', label: 'Expirés' },
  { value: 'suspended', label: 'Suspendus' },
  { value: 'cancelled', label: 'Annulés' },
];

export default function PlatformClientsPage() {
  const [clients, setClients] = useState<ClientOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionOrgId, setActionOrgId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchClients() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          search,
          status: statusFilter,
          limit: '100',
        });
        const res = await fetch(`/api/platform/clients?${params}`);
        const result = await res.json();
        if (res.ok) {
          setClients(result.data || []);
        }
      } catch (err) {
        console.warn('Clients fetch error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchClients();
  }, [search, statusFilter]);

  const handleStatusAction = async (orgId: string, action: string, orgName: string) => {
    const actionLabels: Record<string, string> = {
      activate: 'activer',
      suspend: 'suspendre',
      reactivate: 'réactiver',
      cancel: 'annuler',
    };
    const label = actionLabels[action] || action;

    if (!window.confirm(`Voulez-vous vraiment ${label} le compte "${orgName}" ?`)) {
      return;
    }

    setActionLoading(action);
    setActionOrgId(orgId);

    try {
      const res = await fetch('/api/platform/clients/action', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId, action, reason: 'Super admin action' }),
      });

      const result = await res.json();
      if (res.ok) {
        setClients((prev) =>
          prev.map((c) =>
            c.id === orgId
              ? { ...c, status: result.new_status }
              : c
          )
        );
      }
    } catch (err) {
      console.warn('Action error:', err);
    } finally {
      setActionLoading(null);
      setActionOrgId(null);
    }
  };

  const getStatusBadge = (status: OrganizationStatus) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.trial;
    return (
      <Badge variant={config.color} className="text-xs font-medium">
        {config.label}
      </Badge>
    );
  };

  const getSubStatusBadge = (status?: string | null) => {
    if (!status || status === 'none') return <Badge variant="neutral">Aucun</Badge>;
    const subStatusMap: Record<string, { label: string; color: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
      active: { label: 'Actif', color: 'success' },
      trialing: { label: 'Essai', color: 'info' },
      past_due: { label: 'En retard', color: 'warning' },
      unpaid: { label: 'Impayé', color: 'danger' },
      cancelled: { label: 'Annulé', color: 'neutral' },
      expired: { label: 'Expiré', color: 'danger' },
      suspended: { label: 'Suspendu', color: 'danger' },
    };
    const s = subStatusMap[status] || { label: status, color: 'neutral' as const };
    return <Badge variant={s.color} className="text-xs font-medium">{s.label}</Badge>;
  };

  const activeCount = clients.filter((c) => c.status === 'active').length;
  const suspendedCount = clients.filter((c) => c.status === 'suspended').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Clients</h1>
          <p className="text-xs text-slate-500">
            Gérez tous les comptes clients de la plateforme SaaS.
          </p>
        </div>
        <Button onClick={() => {}} className="gap-2 font-semibold" variant="secondary">
          <Building2 className="w-4 h-4" />
          Nouveau client
        </Button>
      </div>

      {/* KPI Mini-cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Total</span>
            <Building2 className="w-5 h-5 text-blue-900 dark:text-blue-400" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">{clients.length}</p>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Actifs</span>
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">{activeCount}</p>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Suspendus</span>
            <PauseCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">{suspendedCount}</p>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Nouveaux (7j)</span>
            <Activity className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
            {clients.filter((c) => {
              const created = new Date(c.created_at);
              const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
              return created >= weekAgo;
            }).length}
          </p>
        </Card>
      </div>

      {/* Search + Filter */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par nom, email, téléphone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {STATUS_FILTERS.map((f) => (
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

      {/* Table */}
      {loading ? (
        <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
          <span>Chargement des clients...</span>
        </div>
      ) : clients.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucun client trouvé</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {search || statusFilter !== 'all'
              ? 'Aucun résultat pour cette recherche.'
              : 'La plateforme ne comporte pas encore de clients.'}
          </p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Responsable</th>
                  <th className="px-4 py-3">Offre</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Création</th>
                  <th className="px-4 py-3">Expiration</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                {clients.map((client) => {
                  const Icon = STATUS_ICONS[client.status] || Building2;
                  const isActionDisabled = actionLoading === client.id;
                  return (
                    <tr key={client.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-900/10 text-blue-900 dark:text-amber-400 flex items-center justify-center border border-blue-900/20">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">{client.name}</p>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              {client.email && <span>{client.email}</span>}
                              {client.phone && <span>• {client.phone}</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {client.contact_name || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="info" className="text-xs">
                          {client.plan_name || 'Aucune offre'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(client.status)}
                        <div className="mt-1">
                          {getSubStatusBadge(client.subscription_status)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDateFR(client.created_at)}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {client.subscription_end_date ? formatDateFR(client.subscription_end_date) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {client.status === 'suspended' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="p-1 h-7 text-emerald-600 hover:text-emerald-700"
                              onClick={() => handleStatusAction(client.id, 'reactivate', client.name)}
                              disabled={!!isActionDisabled}
                              title="Réactiver"
                            >
                              {isActionDisabled ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                            </Button>
                          )}
                          {client.status !== 'suspended' && client.status !== 'cancelled' && client.status !== 'archived' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="p-1 h-7 text-red-600 hover:text-red-700"
                              onClick={() => handleStatusAction(client.id, 'suspend', client.name)}
                              disabled={!!isActionDisabled}
                              title="Suspendre"
                            >
                              {isActionDisabled ? <Loader2 className="w-3 h-3 animate-spin" /> : <PauseCircle className="w-3.5 h-3.5" />}
                            </Button>
                          )}
                          <Link href={`/platform/clients/${client.id}`}>
                            <Button variant="ghost" size="sm" className="p-1 h-7 text-slate-600 hover:text-slate-900">
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                        </div>
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
