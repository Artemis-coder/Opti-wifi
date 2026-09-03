'use client';

import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Search,
  Loader2,
  CheckCircle,
  PauseCircle,
  Ban,
  Clock,
  Zap,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { toast } from 'sonner';
import { formatCurrencyFCFA, formatDateFR } from '@/lib/utils/format';
import { SubscriptionWithPlan, SubscriptionStatus } from '@/types/platform';

const STATUS_CONFIG: Record<string, { label: string; color: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  trialing: { label: 'Essai', color: 'info' },
  active: { label: 'Actif', color: 'success' },
  past_due: { label: 'En retard', color: 'warning' },
  unpaid: { label: 'Impayé', color: 'danger' },
  cancelled: { label: 'Annulé', color: 'neutral' },
  expired: { label: 'Expiré', color: 'danger' },
  suspended: { label: 'Suspendu', color: 'danger' },
};

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'active', label: 'Actifs' },
  { value: 'trialing', label: 'Essai' },
  { value: 'past_due', label: 'En retard' },
  { value: 'unpaid', label: 'Impayés' },
  { value: 'expired', label: 'Expirés' },
  { value: 'cancelled', label: 'Annulés' },
  { value: 'suspended', label: 'Suspendus' },
];

export default function PlatformSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionWithPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; subscription: SubscriptionWithPlan | null; action: string }>({
    open: false,
    subscription: null,
    action: '',
  });

  useEffect(() => {
    loadSubscriptions();
  }, []);

  async function loadSubscriptions() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: statusFilter, search });
      const res = await fetch(`/api/platform/subscriptions?${params}`);
      const result = await res.json();
      if (res.ok) {
        setSubscriptions(result.data || []);
      }
    } catch {
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSubscriptions();
  }, [statusFilter, search]);

  const handleAction = (sub: SubscriptionWithPlan, action: string) => {
    setConfirmModal({ open: true, subscription: sub, action });
  };

  const executeAction = async () => {
    const { subscription, action } = confirmModal;
    if (!subscription) return;

    setActionLoading(subscription.id);
    setConfirmModal({ open: false, subscription: null, action: '' });

    try {
      const res = await fetch('/api/platform/subscriptions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: subscription.id, action, reason: 'Super admin' }),
      });
      const result = await res.json();
      if (res.ok) {
        toast.success(result.message);
        setSubscriptions((prev) =>
          prev.map((s) => (s.id === subscription.id ? result.data : s))
        );
      } else {
        toast.error(result.error || 'Erreur');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setActionLoading(null);
    }
  };

  const getActionButtons = (sub: SubscriptionWithPlan) => {
    const status = sub.status;
    const isExpiring =
      sub.end_date &&
      new Date(sub.end_date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) &&
      new Date(sub.end_date) <= new Date();

    const buttons = [];

    if (status === 'active' && !sub.cancel_at_period_end) {
      buttons.push({
        label: 'Annuler à la fin',
        action: 'cancel_at_period_end',
        variant: 'outline' as const,
        icon: <Clock className="w-4 h-4" />,
      });
    }

    if (status === 'active' || status === 'suspended') {
      buttons.push({
        label: 'Réactiver',
        action: 'reactivate',
        variant: 'secondary' as const,
        icon: <CheckCircle className="w-4 h-4" />,
      });
    }

    if (isExpiring || status === 'active' || status === 'trialing') {
      buttons.push({
        label: 'Annuler',
        action: 'cancel',
        variant: 'danger' as const,
        icon: <Ban className="w-4 h-4" />,
      });
    }

    if (status === 'active') {
      buttons.push({
        label: 'Suspendre',
        action: 'suspend',
        variant: 'danger' as const,
        icon: <PauseCircle className="w-4 h-4" />,
      });
    }

    return buttons;
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
        <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
        <span>Chargement des abonnements...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Abonnements</h1>
          <p className="text-xs text-slate-500">Gérez tous les abonnements clients de la plateforme.</p>
        </div>
        <Link href="/platform/plans">
          <Button variant="secondary" className="gap-2 font-semibold">
            <Zap className="w-4 h-4" /> Gérer les plans
          </Button>
        </Link>
      </div>

      {/* Search + Filter */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par nom d'entreprise..."
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
      {subscriptions.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <Receipt className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Aucun abonnement trouvé</h3>
          <p className="text-xs text-slate-500">Aucun abonnement ne correspond à votre recherche.</p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Début</th>
                  <th className="px-4 py-3">Expiration</th>
                  <th className="px-4 py-3">Renouvellement</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                {subscriptions.map((sub) => {
                  const config = STATUS_CONFIG[sub.status] || { label: sub.status, color: 'neutral' as const };
                  const actionButtons = getActionButtons(sub);

                  return (
                    <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3">
                        <Link href={`/platform/clients/${sub.organization?.id || ''}`} className="font-semibold text-slate-900 dark:text-white hover:text-amber-500">
                          {sub.organization?.name || '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {sub.plan?.name || '—'}
                        {sub.plan && sub.plan?.price > 0 && (
                          <span className="text-xs text-slate-500 block">
                            {formatCurrencyFCFA(sub.plan.price)} / {sub.plan?.billing_period}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={config.color} className="text-xs">
                          {config.label}
                        </Badge>
                        {sub.cancel_at_period_end && (
                          <Badge variant="warning" className="ml-1 text-xs">
                            Annulation programmée
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {sub.start_date ? formatDateFR(sub.start_date) : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {sub.end_date ? formatDateFR(sub.end_date) : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {sub.auto_renew ? 'Activé' : 'Désactivé'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {actionButtons.map((btn) => (
                            <Button
                              key={btn.action}
                              variant={btn.variant}
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => handleAction(sub, btn.action)}
                              disabled={actionLoading === sub.id}
                            >
                              {actionLoading === sub.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                btn.icon
                              )}
                              {btn.label}
                            </Button>
                          ))}
                          <Link href={`/platform/clients/${sub.organization?.id || ''}`}>
                            <Button variant="ghost" size="sm" className="text-xs h-7">
                              <ExternalLink className="w-3 h-3" /> Voir le client
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

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmModal.open}
        onClose={() => setConfirmModal({ open: false, subscription: null, action: '' })}
        title="Confirmation"
      >
        {confirmModal.subscription && (
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Voulez-vous vraiment effectuer l&apos;action{' '}
            <strong>
              {confirmModal.action === 'cancel' ? 'Annuler' :
               confirmModal.action === 'cancel_at_period_end' ? 'Annuler à la fin de la période' :
               confirmModal.action === 'reactivate' ? 'Réactiver' :
               confirmModal.action === 'suspend' ? 'Suspendre' : confirmModal.action}
            </strong>
            {' '}sur l&apos;abonnement du client{' '}
            <strong>{confirmModal.subscription.organization?.name}</strong> ?
          </p>
        )}
        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setConfirmModal({ open: false, subscription: null, action: '' })}
          >
            Annuler
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={executeAction}
          >
            Confirmer
          </Button>
        </div>
      </Modal>
    </div>
  );
}
