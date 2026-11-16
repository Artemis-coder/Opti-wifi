'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
  Trash2,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { KpiGrid } from '@/components/ui/KpiGrid';
import { Button, buttonClassName } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatCurrencyFCFA, formatDateFR } from '@/lib/utils/format';
import { OrganizationStatus } from '@/types/platform';
import { ResponsiveTable } from '@/components/ui/ResponsiveTable';
import { confirmAction } from '@/components/ui/ConfirmDialog';

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
  pending_approval: { label: 'En attente', color: 'warning' },
  trial: { label: 'Essai', color: 'info' },
  active: { label: 'Actif', color: 'success' },
  expiring: { label: 'Expire bientôt', color: 'warning' },
  expired: { label: 'Expiré', color: 'danger' },
  suspended: { label: 'Suspendu', color: 'danger' },
  cancelled: { label: 'Refusé', color: 'neutral' },
  archived: { label: 'Supprimé', color: 'neutral' },
};

const STATUS_ICONS: Record<OrganizationStatus, React.ElementType> = {
  pending_approval: AlertCircle,
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
  { value: 'pending_approval', label: 'En attente' },
  { value: 'active', label: 'Actifs' },
  { value: 'trial', label: 'Essai' },
  { value: 'expiring', label: 'Expire bientôt' },
  { value: 'expired', label: 'Expirés' },
  { value: 'suspended', label: 'Suspendus' },
  { value: 'archived', label: 'Supprimés' },
  { value: 'cancelled', label: 'Refusés' },
];

export default function PlatformClientsPage() {
  return (
    <Suspense>
      <PlatformClientsContent />
    </Suspense>
  );
}

function PlatformClientsContent() {
  // ?q= : recherche lancée depuis l'en-tête du back-office
  const urlQuery = useSearchParams().get('q') ?? '';
  const [clients, setClients] = useState<ClientOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(urlQuery);
  const [prevUrlQuery, setPrevUrlQuery] = useState(urlQuery);
  if (urlQuery !== prevUrlQuery) {
    setPrevUrlQuery(urlQuery);
    setSearch(urlQuery);
  }
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionOrgId, setActionOrgId] = useState<string | null>(null);

  const [newClientsCount, setNewClientsCount] = useState(0);

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
          const list = result.data || [];
          setClients(list);
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          setNewClientsCount(list.filter((c: ClientOrg) => new Date(c.created_at) >= weekAgo).length);
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
      approve: 'valider',
      activate: "activer l'espace de",
      suspend: "suspendre l'espace de",
      reactivate: "réactiver l'espace de",
      cancel: 'refuser',
      archive: 'supprimer',
    };
    const label = actionLabels[action] || action;
    const consequence: Record<string, string> = {
      suspend: "\n\nTous ses membres perdent immédiatement l'accès. Vous pourrez le réactiver.",
      archive: "\n\nTous ses membres perdent immédiatement l'accès. Les données sont conservées et l'organisation peut être réactivée.",
    };

    const danger = ['suspend', 'archive', 'cancel'].includes(action);
    if (!(await confirmAction(`Voulez-vous vraiment ${label} « ${orgName} » ?${consequence[action] || ''}`, { danger }))) {
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
          prev.map((c: ClientOrg) =>
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

  const activeCount = clients.filter((c: ClientOrg) => c.status === 'active').length;
  const suspendedCount = clients.filter((c: ClientOrg) => c.status === 'suspended').length;
  const pendingCount = clients.filter((c: ClientOrg) => c.status === 'pending_approval').length;


  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Clients</h1>
          <p className="text-xs text-muted">
            Gérez tous les comptes clients de la plateforme SaaS.
          </p>
        </div>
      </div>

      {/* Chiffres clés */}
      <KpiGrid cols={{ base: 2, lg: pendingCount > 0 ? 5 : 4 }}>
        <StatTile label="Total" value={clients.length} icon={Building2} accent="indigo" hint="Clients inscrits" />
        {pendingCount > 0 && (
          <StatTile label="En attente" value={pendingCount} icon={AlertCircle} accent="amber" hint="Inscriptions à valider" href="/platform/registrations" />
        )}
        <StatTile label="Actifs" value={activeCount} icon={CheckCircle} accent="emerald" hint="Espaces en service" />
        <StatTile label="Suspendus" value={suspendedCount} icon={PauseCircle} accent="red" hint="Accès coupé" />
        <StatTile label="Nouveaux (7 j)" value={newClientsCount} icon={Activity} accent="blue" hint="Inscrits cette semaine" />
      </KpiGrid>

      {/* Search + Filter */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted" />
            <input
              type="text"
              placeholder="Rechercher par nom, email, téléphone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input input--primary w-full pl-10 pr-3"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {STATUS_FILTERS.map((f: { value: string; label: string }) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition whitespace-nowrap ${
                  statusFilter === f.value
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'bg-default text-muted hover:bg-default-hover hover:text-foreground'
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
        <div className="py-10 flex justify-center items-center gap-2 text-muted text-sm font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-accent" />
          <span>Chargement des clients...</span>
        </div>
      ) : clients.length === 0 ? (
        <Card className="text-center space-y-3 py-8">
          <Building2 className="w-12 h-12 text-muted mx-auto" />
          <h3 className="text-base font-semibold text-foreground">Aucun client trouvé</h3>
          <p className="text-xs text-muted max-w-sm mx-auto">
            {search || statusFilter !== 'all'
              ? 'Aucun résultat pour cette recherche.'
              : 'La plateforme ne comporte pas encore de clients.'}
          </p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <ResponsiveTable>
            <table className="w-full text-left text-xs">
              <thead className="bg-default text-muted font-semibold">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Téléphone</th>
                  <th className="px-4 py-3">Responsable</th>
                  <th className="px-4 py-3">Offre</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Création</th>
                  <th className="px-4 py-3">Expiration</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-separator font-medium">
                {clients.map((client: ClientOrg) => {
                  const Icon = STATUS_ICONS[client.status as OrganizationStatus] || Building2;
                  const isActionDisabled = actionLoading === client.id;
                  return (
                    <tr key={client.id} className="hover:bg-surface-secondary transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-accent-soft text-accent flex items-center justify-center">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{client.name}</p>
                            {client.email && <p className="text-xs text-muted">{client.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {client.phone ? (
                          <a
                            href={`tel:${client.phone.replace(/\s/g, '')}`}
                            className="font-semibold text-foreground hover:text-accent tabular-nums"
                            title="Appeler"
              >
                            {client.phone}
                          </a>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {client.contact_name || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="info" className="text-xs">
                          {client.plan_name || 'Aucune offre'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {/* Statut de l'espace et de la licence côte à côte */}
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          {getStatusBadge(client.status)}
                          {getSubStatusBadge(client.subscription_status)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {formatDateFR(client.created_at)}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {client.subscription_end_date ? formatDateFR(client.subscription_end_date) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {client.status === 'pending_approval' && (
                            <Button
                              variant="primary"
                              size="sm"
                              className="bg-success hover:bg-success-hover text-success-foreground flex items-center shadow-xs"
                              onClick={() => handleStatusAction(client.id, 'approve', client.name)}
                              disabled={!!isActionDisabled}
                              title="Valider et approuver ce client"
              >
                              {isActionDisabled ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                              <span>Valider</span>
                            </Button>
                          )}
                          {(client.status === 'suspended' || client.status === 'cancelled' || client.status === 'archived') && (
                            <Button isIconOnly
                              variant="ghost"
                              size="sm"
                              className="text-success-soft-foreground hover:text-success-soft-foreground"
                              onClick={() => handleStatusAction(client.id, 'reactivate', client.name)}
                              disabled={!!isActionDisabled}
                              title="Réactiver l'espace"
              >
                              {isActionDisabled ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                            </Button>
                          )}
                          {client.status !== 'suspended' && client.status !== 'cancelled' && client.status !== 'archived' && client.status !== 'pending_approval' && (
                            <Button isIconOnly
                              variant="ghost"
                              size="sm"
                              onClick={() => handleStatusAction(client.id, 'suspend', client.name)}
                              disabled={!!isActionDisabled}
                              title="Suspendre l'espace"
              >
                              {isActionDisabled ? <Loader2 className="w-3 h-3 animate-spin" /> : <PauseCircle className="w-3.5 h-3.5" />}
                            </Button>
                          )}
                          {client.status !== 'archived' && client.status !== 'pending_approval' && (
                            <Button isIconOnly
                              variant="ghost"
                              size="sm"
                              onClick={() => handleStatusAction(client.id, 'archive', client.name)}
                              disabled={!!isActionDisabled}
                              title="Supprimer l'organisation"
              >
                              {isActionDisabled ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </Button>
                          )}
                          <Link href={`/platform/clients/${client.id}`} className={buttonClassName({ variant: 'ghost', size: 'sm', className: 'text-muted hover:text-foreground', isIconOnly: true})}>
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </Link>
                        </div>
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
