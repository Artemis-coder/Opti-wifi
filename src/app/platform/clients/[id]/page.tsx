'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Edit,
  CheckCircle,
  PauseCircle,
  Ban,
  Clock,
  Users,
  Store,
  Ticket,
  ShoppingCart,
  Receipt,
  BarChart3,
  Wallet,
  ExternalLink,
  Loader2,
  AlertCircle,
  Copy,
  Activity,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { formatCurrencyFCFA, formatNumber, formatDateFR } from '@/lib/utils/format';
import { toast } from 'sonner';
import {
  Organization,
  OrganizationStatus,
  Subscription,
  PaymentStatus,
  InvoiceStatus,
} from '@/types/platform';

interface ClientDetailData {
  organization: Organization & {
    user_count?: number;
    pos_count?: number;
    ticket_allocated?: number;
    tickets_sold?: number;
    revenue?: number;
    collection_count?: number;
    last_activity?: string | null;
  };
  subscription: (Subscription & {
    plan: {
      id: string;
      name: string;
      description?: string;
      price: number;
      currency: string;
      billing_period: string;
      features?: Record<string, unknown> | null;
    };
  }) | null;
  subscriptions_history: (Subscription & {
    plan: { id: string; name: string; price: number; currency: string };
  })[];
  payments: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    paid_at?: string | null;
    created_at: string;
    transaction_reference?: string;
  }[];
  users: {
    id: string;
    nom: string;
    email: string;
    role: string;
    created_at: string;
    last_login?: string | null;
  }[];
  pos: { id: string; nom: string; statut: string; created_at: string }[];
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

const SUB_STATUS_CONFIG: Record<string, { label: string; color: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  trialing: { label: 'Essai', color: 'info' },
  active: { label: 'Actif', color: 'success' },
  past_due: { label: 'En retard', color: 'warning' },
  unpaid: { label: 'Impayé', color: 'danger' },
  cancelled: { label: 'Annulé', color: 'neutral' },
  expired: { label: 'Expiré', color: 'danger' },
  suspended: { label: 'Suspendu', color: 'danger' },
};

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params?.id as string;

  const [data, setData] = useState<ClientDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState<{
    open: boolean;
    action: string;
    label: string;
  }>({ open: false, action: '', label: '' });

  useEffect(() => {
    async function fetchClient() {
      if (!clientId) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/platform/clients/${clientId}`);
        const result = await res.json();
        if (res.ok) {
          setData(result.data);
        } else {
          toast.error(result.error || 'Erreur de chargement');
        }
      } catch {
        toast.error('Erreur de chargement du client');
      } finally {
        setLoading(false);
      }
    }
    fetchClient();
  }, [clientId]);

  const handleStatusAction = async (action: string, label: string) => {
    setConfirmModalOpen({ open: true, action, label });
  };

  const executeAction = async () => {
    setConfirmModalOpen({ open: false, action: '', label: '' });
    setActionLoading(true);

    try {
      const res = await fetch('/api/platform/clients/action', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: clientId,
          action: confirmModalOpen.action,
          reason: `Super admin: ${confirmModalOpen.label}`,
        }),
      });

      const result = await res.json();
      if (res.ok) {
        toast.success(result.message);
        if (data) {
          setData({
            ...data,
            organization: { ...data.organization, status: result.new_status },
          });
        }
      } else {
        toast.error(result.error || 'Erreur');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setActionLoading(false);
    }
  };

  const handleImpersonate = async () => {
    const res = await fetch('/api/platform/clients/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: clientId }),
    });

    const result = await res.json();
    if (res.ok && result.url) {
      window.open(result.url, '_blank', 'noopener,noreferrer');
      toast.success(`Accès au compte client ouvert dans un nouvel onglet.`);
    } else {
      toast.error(result.error || 'Erreur d\'impersonation');
    }
  };

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success('ID copié dans le presse-papier');
  };

  if (loading || !data) {
    return (
      <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
        <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
        <span>Chargement de la fiche client...</span>
      </div>
    );
  }

  const org = data.organization;
  const sub = data.subscription;
  const subStatus = sub ? SUB_STATUS_CONFIG[sub.status] || { label: sub.status, color: 'neutral' } : null;
  const orgConfig = STATUS_CONFIG[org.status] || { label: org.status, color: 'neutral' };

  const getSubAction = () => {
    if (org.status === 'suspended') return { action: 'reactivate', label: 'Réactiver' };
    if (org.status === 'active' || org.status === 'trial' || org.status === 'expiring') return { action: 'suspend', label: 'Suspendre' };
    return null;
  };

  const subAction = getSubAction();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/platform/clients">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Retour aux clients
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{org.name}</h1>
            <p className="text-xs text-slate-500 mt-1">
              ID: {org.id} <button onClick={() => copyId(org.id)} className="hover:text-amber-500"><Copy className="w-3 h-3 inline" /></button>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {subAction && (
            <Button
              variant={subAction.action === 'suspend' ? 'danger' : 'secondary'}
              size="sm"
              className="font-semibold"
              onClick={() => handleStatusAction(subAction.action, subAction.label.toLowerCase())}
              disabled={actionLoading}
            >
              {subAction.action === 'suspend' ? <PauseCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
              {subAction.label}
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-2" onClick={handleImpersonate}>
            <ExternalLink className="w-4 h-4" />
            Accéder à l&apos;espace client
          </Button>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmModalOpen.open}
        onClose={() => setConfirmModalOpen({ open: false, action: '', label: '' })}
        title="Confirmation d&apos;action"
      >
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Voulez-vous vraiment <strong>{confirmModalOpen.label}</strong> ce compte client ?
          Cette action affectera immédiatement l&apos;accès du client à la plateforme.
        </p>
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="ghost"
            onClick={() => setConfirmModalOpen({ open: false, action: '', label: '' })}
          >
            Annuler
          </Button>
          <Button
            type="button"
            variant={confirmModalOpen.action === 'suspend' ? 'danger' : 'secondary'}
            onClick={executeAction}
            isLoading={actionLoading}
          >
            Confirmer
          </Button>
        </div>
      </Modal>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* General Info */}
        <Card className="space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
            <Building2 className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Informations Générales</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Building2 className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-500">Nom de l&apos;entreprise</span>
                <p className="text-slate-900 dark:text-white">{org.name}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <User className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-500">Responsable</span>
                <p className="text-slate-900 dark:text-white">{org.contact_name || '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-500">Email</span>
                <p className="text-slate-900 dark:text-white">{org.email || '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-500">Téléphone</span>
                <p className="text-slate-900 dark:text-white">{org.phone || '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-500">Adresse</span>
                <p className="text-slate-900 dark:text-white">{org.address || '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-500">Date de création</span>
                <p className="text-slate-900 dark:text-white">{formatDateFR(org.created_at)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="font-semibold text-slate-500">Statut du compte</span>
              <Badge variant={orgConfig.color} className="mt-0.5">
                {orgConfig.label}
              </Badge>
            </div>
          </div>
        </Card>

        {/* Activity Info */}
        <Card className="space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
            <Activity className="w-5 h-5 text-blue-900 dark:text-blue-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Activité</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {formatNumber(org.user_count || 0)}
              </p>
              <p className="text-xs text-slate-500">Utilisateurs</p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {formatNumber(org.pos_count || 0)}
              </p>
              <p className="text-xs text-slate-500">Points de vente</p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {formatNumber(org.ticket_allocated || 0)}
              </p>
              <p className="text-xs text-slate-500">Tickets alloués</p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {formatNumber(org.tickets_sold || 0)}
              </p>
              <p className="text-xs text-slate-500">Tickets vendus</p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {formatCurrencyFCFA(org.revenue || 0)}
              </p>
              <p className="text-xs text-slate-500">CA généré</p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {formatNumber(org.collection_count || 0)}
              </p>
              <p className="text-xs text-slate-500">Collectes</p>
            </div>
          </div>
          {org.last_activity && (
            <p className="text-xs text-slate-500 text-center pt-2 border-t border-slate-200 dark:border-slate-800">
              Dernière activité: {formatDateFR(org.last_activity)}
            </p>
          )}
        </Card>

        {/* Subscription Info */}
        <Card className="space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
            <Receipt className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Abonnement</h2>
          </div>
          {sub ? (
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-semibold text-slate-500">Offre</span>
                <p className="text-slate-900 dark:text-white font-bold">{sub.plan?.name || '—'}</p>
                {sub.plan?.price > 0 && (
                  <p className="text-xs text-slate-500">
                    {formatCurrencyFCFA(sub.plan.price)} / {sub.plan.billing_period}
                  </p>
                )}
              </div>
              <div>
                <span className="font-semibold text-slate-500">Statut</span>
                {subStatus ? (
                  <Badge variant={subStatus.color} className="mt-1 block w-fit">
                    {subStatus.label}
                  </Badge>
                ) : (
                  <Badge variant="neutral" className="mt-1">—</Badge>
                )}
              </div>
              <div>
                <span className="font-semibold text-slate-500">Date de début</span>
                <p className="text-slate-900 dark:text-white">{formatDateFR(sub.start_date || org.created_at)}</p>
              </div>
              <div>
                <span className="font-semibold text-slate-500">Date d'expiration</span>
                <p className="text-slate-900 dark:text-white">{formatDateFR(sub.end_date || '—')}</p>
              </div>
              <div>
                <span className="font-semibold text-slate-500">Renouvellement auto</span>
                <p className="text-slate-900 dark:text-white">
                  {sub.auto_renew ? 'Activé' : 'Désactivé'}
                </p>
              </div>
              {sub.cancel_at_period_end && (
                <div className="p-2 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    L&apos;abonnement sera annulé à la fin de la période en cours.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Aucun abonnement lié à cet organisation.</p>
          )}
        </Card>
      </div>

      {/* Subscription History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payments */}
        <Card className="space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
            <Wallet className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Paiements ({data.payments.length})</h2>
          </div>
          {data.payments.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">Aucun paiement enregistré.</p>
          ) : (
            <div className="space-y-2">
              {data.payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {formatCurrencyFCFA(p.amount)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {p.paid_at ? formatDateFR(p.paid_at) : formatDateFR(p.created_at)}
                    </p>
                  </div>
                  <Badge variant={
                    ['successful', 'refunded'].includes(p.status) ? 'success' :
                    p.status === 'failed' ? 'danger' : 'warning'
                  }>
                    {p.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Users List */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-purple-600" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Utilisateurs ({data.users.length})</h2>
            </div>
            <Link href={`/platform/users?org=${org.id}`}>
              <Button variant="ghost" size="sm" className="text-xs">Voir tout</Button>
            </Link>
          </div>
          {data.users.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">Aucun utilisateur.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {data.users.map((u) => (
                <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                  <div className="w-7 h-7 rounded-full bg-[#0b1a3a] text-amber-400 flex items-center justify-center font-bold text-xs">
                    {u.nom?.[0] || u.email?.[0] || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{u.nom || u.email}</p>
                    <p className="text-xs text-slate-500 truncate">{u.email}</p>
                  </div>
                  <Badge variant={u.role === 'administrateur' ? 'warning' : 'info'} className="text-[10px]">
                    {u.role}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* POS List */}
      {data.pos.length > 0 && (
        <Card className="space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
            <Store className="w-5 h-5 text-blue-900 dark:text-blue-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Points de Vente ({data.pos.length})</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.pos.map((p) => (
              <div key={p.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <p className="font-semibold text-slate-900 dark:text-white text-sm">{p.nom}</p>
                <p className="text-xs text-slate-500">{p.created_at ? formatDateFR(p.created_at) : ''}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
