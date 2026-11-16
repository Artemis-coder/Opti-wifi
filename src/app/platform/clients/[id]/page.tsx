'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { LicenseActivationModal } from '@/components/platform/LicenseActivationModal';
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
  Trash2,
  KeyRound,
  Loader2,
  AlertCircle,
  Copy,
  Activity,
  Gift,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Button, buttonClassName } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { formatCurrencyFCFA, formatNumber, formatDateFR, formatDateOnlyFR } from '@/lib/utils/format';
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
  trial_offer: { plan_id: string; plan_name: string; days: number; used: boolean } | null;
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
  pending_approval: { label: 'En attente', color: 'warning' },
  trial: { label: 'Essai', color: 'info' },
  active: { label: 'Actif', color: 'success' },
  expiring: { label: 'Expire bientôt', color: 'warning' },
  expired: { label: 'Expiré', color: 'danger' },
  suspended: { label: 'Suspendu', color: 'danger' },
  cancelled: { label: 'Refusé', color: 'neutral' },
  archived: { label: 'Supprimé', color: 'neutral' },
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
  const [licenseModalOpen, setLicenseModalOpen] = useState(false);
  // Instant de référence pour les durées affichées (jours restants, fin d'essai)
  const [now] = useState(() => Date.now());
  const [reloadKey, setReloadKey] = useState(0);
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
  }, [clientId, reloadKey]);

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

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success('ID copié dans le presse-papier');
  };

  if (loading || !data) {
    return (
      <div className="py-10 flex justify-center items-center gap-2 text-muted text-sm font-medium">
        <Loader2 className="w-5 h-5 animate-spin text-accent" />
        <span>Chargement de la fiche client...</span>
      </div>
    );
  }

  const org = data.organization;
  const sub = data.subscription;
  const subStatus = sub ? SUB_STATUS_CONFIG[sub.status] || { label: sub.status, color: 'neutral' } : null;
  // Forfait actif : licence ou essai en cours
  const liveSub =
    sub && (sub.status === 'active' || sub.status === 'trialing') && (!sub.end_date || new Date(sub.end_date).getTime() > now) ? sub : null;
  const daysLeft = liveSub?.end_date ? Math.ceil((new Date(liveSub.end_date).getTime() - now) / 86_400_000) : null;
  const trial = data.trial_offer;
  const trialEnd = trial ? new Date(now + trial.days * 86_400_000) : null;
  const orgConfig = STATUS_CONFIG[org.status] || { label: org.status, color: 'neutral' };

  const getSubAction = () => {
    if (!org) return null;
    if (org.status === 'pending_approval') return { action: 'approve', label: "Valider l'inscription" };
    if (org.status === 'suspended' || org.status === 'cancelled' || org.status === 'archived') return { action: 'reactivate', label: "Réactiver l'espace" };
    if (org.status === 'active' || org.status === 'trial' || org.status === 'expiring' || org.status === 'expired') return { action: 'suspend', label: "Suspendre l'espace" };
    return null;
  };

  const subAction = getSubAction();

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="space-y-3">
        <Link href="/platform/clients" className={buttonClassName({ variant: 'ghost', size: 'sm', className: '-ml-3' })}>
          <ArrowLeft className="size-4" /> Retour aux clients
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-semibold tracking-tight text-foreground">{org.name}</h1>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted">
              <span className="min-w-0 truncate">ID : {org.id}</span>
              <button
                type="button"
                onClick={() => copyId(org.id)}
                aria-label="Copier l’identifiant"
                className="shrink-0 rounded-xl p-1 hover:bg-default hover:text-foreground"
              >
                <Copy className="size-3" />
              </button>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {org.status !== 'pending_approval' && org.status !== 'cancelled' && org.status !== 'archived' && (
              <Button variant="primary" size="sm" onClick={() => setLicenseModalOpen(true)}>
                <KeyRound className="size-4" />
                Activer une licence
              </Button>
            )}
            {subAction && (
              <Button
                variant={subAction.action === 'suspend' ? 'danger-soft' : 'secondary'}
                size="sm"
                onClick={() => handleStatusAction(subAction.action, subAction.label.toLowerCase())}
                disabled={actionLoading}
              >
                {subAction.action === 'suspend' ? <PauseCircle className="size-4" /> : <CheckCircle className="size-4" />}
                {subAction.label}
              </Button>
            )}
            {org.status !== 'pending_approval' && org.status !== 'archived' && (
              <Button
                variant="danger-soft"
                size="sm"
                onClick={() => handleStatusAction('archive', 'supprimer')}
                disabled={actionLoading}
              >
                <Trash2 className="size-4" />
                Supprimer
              </Button>
            )}
          </div>
        </div>
      </div>

      {licenseModalOpen && (
      <LicenseActivationModal
        isOpen={licenseModalOpen}
        onClose={() => setLicenseModalOpen(false)}
        onActivated={() => setReloadKey((k) => k + 1)}
        organizationId={org.id}
        organizationName={org.name}
        currentEndDate={sub?.status === 'active' || sub?.status === 'trialing' ? sub?.end_date : null}
        // Forfait actuel par défaut, sauf après un essai gratuit (le client choisit alors son forfait)
        defaultPlanId={sub && !sub.trial_end ? sub.plan_id : null}
        preferTrial={!liveSub && !!trial && !trial.used}
      />
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmModalOpen.open}
        onClose={() => setConfirmModalOpen({ open: false, action: '', label: '' })}
        title="Confirmation d&apos;action"
      >
        <p className="text-sm text-foreground">
          Voulez-vous vraiment <strong>{confirmModalOpen.label}</strong> ce compte client ?
          {(confirmModalOpen.action === 'suspend' || confirmModalOpen.action === 'archive') && (
            <span className="block mt-2 text-xs text-danger">
              Tous ses membres perdent immédiatement l&apos;accès.{' '}
              {confirmModalOpen.action === 'archive'
                ? 'Les données sont conservées et l’organisation peut être réactivée.'
                : 'Vous pourrez réactiver l’espace à tout moment.'}
            </span>
          )}
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* General Info */}
        <Card className="space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-border">
            <Building2 className="w-5 h-5 text-warning-soft-foreground" />
            <h2 className="text-base font-semibold text-foreground">Informations Générales</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Building2 className="w-4 h-4 text-muted mt-0.5" />
              <div>
                <span className="font-semibold text-muted">Nom de l&apos;entreprise</span>
                <p className="text-foreground">{org.name}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <User className="w-4 h-4 text-muted mt-0.5" />
              <div>
                <span className="font-semibold text-muted">Responsable</span>
                <p className="text-foreground">{org.contact_name || '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-muted mt-0.5" />
              <div>
                <span className="font-semibold text-muted">Email</span>
                <p className="text-foreground">{org.email || '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-muted mt-0.5" />
              <div>
                <span className="font-semibold text-muted">Téléphone</span>
                <p className="text-foreground">{org.phone || '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-muted mt-0.5" />
              <div>
                <span className="font-semibold text-muted">Adresse</span>
                <p className="text-foreground">{org.address || '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-muted mt-0.5" />
              <div>
                <span className="font-semibold text-muted">Date de création</span>
                <p className="text-foreground">{formatDateFR(org.created_at)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="font-semibold text-muted">Statut du compte</span>
              <Badge variant={orgConfig.color} className="mt-0.5">
                {orgConfig.label}
              </Badge>
            </div>
          </div>
        </Card>

        {/* Activity Info */}
        <Card className="space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-border">
            <Activity className="w-5 h-5 text-accent" />
            <h2 className="text-base font-semibold text-foreground">Activité</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 text-center">
            <div className="p-3 bg-surface-secondary rounded-xl">
              <p className="text-2xl font-semibold text-foreground">
                {formatNumber(org.user_count || 0)}
              </p>
              <p className="text-xs text-muted">Utilisateurs</p>
            </div>
            <div className="p-3 bg-surface-secondary rounded-xl">
              <p className="text-2xl font-semibold text-foreground">
                {formatNumber(org.pos_count || 0)}
              </p>
              <p className="text-xs text-muted">Points de vente</p>
            </div>
            <div className="p-3 bg-surface-secondary rounded-xl">
              <p className="text-2xl font-semibold text-foreground">
                {formatNumber(org.ticket_allocated || 0)}
              </p>
              <p className="text-xs text-muted">Tickets alloués</p>
            </div>
            <div className="p-3 bg-surface-secondary rounded-xl">
              <p className="text-2xl font-semibold text-foreground">
                {formatNumber(org.tickets_sold || 0)}
              </p>
              <p className="text-xs text-muted">Tickets vendus</p>
            </div>
            <div className="p-3 bg-surface-secondary rounded-xl">
              <p className="text-2xl font-semibold text-foreground">
                {formatCurrencyFCFA(org.revenue || 0)}
              </p>
              <p className="text-xs text-muted">CA généré</p>
            </div>
            <div className="p-3 bg-surface-secondary rounded-xl">
                <p className="text-2xl font-semibold text-foreground">
                {formatNumber(org.collection_count || 0)}
              </p>
              <p className="text-xs text-muted">Collectes</p>
            </div>
          </div>
          {org.last_activity && (
            <p className="text-xs text-muted text-center pt-2 border-t border-border">
              Dernière activité: {formatDateFR(org.last_activity)}
            </p>
          )}
        </Card>

        {/* Subscription Info */}
        <Card className="space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-border">
            <Receipt className="w-5 h-5 text-warning-soft-foreground" />
            <h2 className="text-base font-semibold text-foreground">Abonnement</h2>
          </div>
          {!liveSub && trial && (
            <div className="p-3 rounded-xl bg-accent-soft space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Gift className="w-4 h-4 text-accent" />
                <p className="text-sm font-semibold text-foreground whitespace-nowrap">Période d&apos;essai</p>
                <Badge variant={trial.used ? 'neutral' : 'info'} className="ml-auto">
                  {trial.used ? 'Non disponible' : 'Disponible'}
                </Badge>
              </div>
              <p className="text-xs text-muted">
                {trial.used ? (
                  <>Ce client a déjà eu un abonnement : l&apos;essai gratuit n&apos;est offert qu&apos;à la première souscription. Activez une licence payante.</>
                ) : (
                  <>
                    Essai gratuit <strong>{trial.plan_name}</strong> de <strong>{trial.days} jour{trial.days > 1 ? 's' : ''}</strong>
                    {trialEnd && <> : du {formatDateOnlyFR(new Date(now).toISOString())} au {formatDateOnlyFR(trialEnd.toISOString())} s&apos;il démarre aujourd&apos;hui</>}.
                  </>
                )}
              </p>
              {!trial.used && org.status !== 'pending_approval' && (
                <Button size="sm" className="gap-2" onClick={() => setLicenseModalOpen(true)}>
                  <Gift className="w-4 h-4" />
                  Démarrer l&apos;essai
                </Button>
              )}
              {!trial.used && org.status === 'pending_approval' && (
                <p className="text-xs text-muted">L&apos;essai démarre automatiquement à la validation de l&apos;inscription.</p>
              )}
            </div>
          )}
          {sub ? (
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-semibold text-muted">Offre</span>
                <p className="text-foreground font-semibold">{sub.plan?.name || '—'}</p>
                {sub.plan?.price > 0 && (
                  <p className="text-xs text-muted">
                    {formatCurrencyFCFA(sub.plan.price)} / {sub.plan.billing_period}
                  </p>
                )}
              </div>
              <div>
                <span className="font-semibold text-muted">Statut</span>
                {subStatus ? (
                  <Badge variant={subStatus.color} className="mt-1 block w-fit">
                    {subStatus.label}
                  </Badge>
                ) : (
                  <Badge variant="neutral" className="mt-1">—</Badge>
                )}
              </div>
              <div>
                <span className="font-semibold text-muted">Date de début</span>
                <p className="text-foreground">{formatDateFR(sub.start_date || org.created_at)}</p>
              </div>
              <div>
                <span className="font-semibold text-muted">Date d&apos;expiration</span>
                <p className="text-foreground">{formatDateFR(sub.end_date || '—')}</p>
              </div>
              {liveSub && daysLeft !== null && (
                <div>
                  <span className="font-semibold text-muted">{liveSub.status === 'trialing' ? "Jours d'essai restants" : 'Jours restants'}</span>
                  <p className="text-foreground font-semibold">
                    {daysLeft} jour{daysLeft > 1 ? 's' : ''}
                  </p>
                </div>
              )}
              <div>
                <span className="font-semibold text-muted">Renouvellement auto</span>
                <p className="text-foreground">
                  {sub.auto_renew ? 'Activé' : 'Désactivé'}
                </p>
              </div>
              {sub.cancel_at_period_end && (
                <div className="p-2 bg-warning-soft rounded-xl">
                  <p className="text-xs text-warning-soft-foreground">
                    L&apos;abonnement sera annulé à la fin de la période en cours.
                  </p>
                </div>
              )}
            </div>
          ) : (
            !trial && <p className="text-xs text-muted">Aucun abonnement lié à cette organisation.</p>
          )}
        </Card>
      </div>

      {/* Subscription History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {/* Payments */}
        <Card className="space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-border">
            <Wallet className="w-5 h-5 text-success-soft-foreground" />
            <h2 className="text-base font-semibold text-foreground">Paiements ({data.payments.length})</h2>
          </div>
          {data.payments.length === 0 ? (
            <p className="text-xs text-muted text-center py-6">Aucun paiement enregistré.</p>
          ) : (
            <div className="space-y-2">
              {data.payments.map((p: { id: string; amount: number; currency: string; status: string; paid_at?: string | null; created_at: string; transaction_reference?: string }) => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded-xl bg-surface-secondary">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {formatCurrencyFCFA(p.amount)}
                    </p>
                    <p className="text-xs text-muted">
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
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-accent" />
              <h2 className="text-base font-semibold text-foreground">Utilisateurs ({data.users.length})</h2>
            </div>
            <Link href={`/platform/users?org=${org.id}`} className={buttonClassName({ variant: 'ghost', size: 'sm', className: 'text-xs' })}>Voir tout</Link>
          </div>
          {data.users.length === 0 ? (
            <p className="text-xs text-muted text-center py-6">Aucun utilisateur.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {data.users.map((u: { id: string; nom: string; email: string; role: string; created_at: string; last_login?: string | null }) => (
                <div key={u.id} className="flex items-center gap-3 p-2 rounded-xl bg-surface-secondary">
                  <UserAvatar name={u.nom} email={u.email} className="shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{u.nom || u.email}</p>
                    <p className="text-xs text-muted truncate">{u.email}</p>
                  </div>
                  <Badge variant={u.role === 'administrateur' ? 'warning' : 'info'} className="text-xs">
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
          <div className="flex items-center gap-3 pb-3 border-b border-border">
            <Store className="w-5 h-5 text-accent" />
            <h2 className="text-base font-semibold text-foreground">Points de Vente ({data.pos.length})</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.pos.map((p: { id: string; nom: string; statut: string; created_at: string }) => (
              <div key={p.id} className="p-3 rounded-xl bg-surface-secondary">
                <p className="font-semibold text-foreground text-sm">{p.nom}</p>
                <p className="text-xs text-muted">{p.created_at ? formatDateFR(p.created_at) : ''}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
