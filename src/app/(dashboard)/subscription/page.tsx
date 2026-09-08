'use client';

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  PauseCircle,
  AlertTriangle,
  Calendar,
  Zap,
  Loader2,
  RefreshCw,
  ArrowRight,
  Activity,
  Ban,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'sonner';
import { formatCurrencyFCFA, formatDateFR } from '@/lib/utils/format';
import { SubscriptionWithPlan, SubscriptionStatus } from '@/types/platform';

const STATUS_CONFIG: Record<SubscriptionStatus, { label: string; color: 'success' | 'warning' | 'danger' | 'info' | 'neutral'; icon: React.ReactNode }> = {
  trialing: { label: 'Période d\'essai', color: 'info', icon: <Clock className="w-5 h-5" /> },
  active: { label: 'Actif', color: 'success', icon: <CheckCircle className="w-5 h-5" /> },
  past_due: { label: 'Paiement en retard', color: 'warning', icon: <AlertTriangle className="w-5 h-5" /> },
  unpaid: { label: 'Impayé', color: 'danger', icon: <XCircle className="w-5 h-5" /> },
  cancelled: { label: 'Annulé', color: 'neutral', icon: <XCircle className="w-5 h-5" /> },
  expired: { label: 'Expiré', color: 'danger', icon: <XCircle className="w-5 h-5" /> },
  suspended: { label: 'Suspendu', color: 'danger', icon: <PauseCircle className="w-5 h-5" /> },
};

export default function OrganizationSubscriptionPage() {
  const [currentSubscription, setCurrentSubscription] = useState<SubscriptionWithPlan | null>(null);
  const [otherSubscriptions, setOtherSubscriptions] = useState<SubscriptionWithPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const res = await fetch('/api/subscription');
        const result = await res.json();
        if (mounted && res.ok) {
          setCurrentSubscription(result.current || null);
          setOtherSubscriptions(result.others || []);
        }
      } catch {
        if (mounted) {
          toast.error('Erreur réseau');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const calculateDaysRemaining = (endDate: string | null | undefined): number | null => {
    if (!endDate) return null;
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center items-center gap-2 text-slate-500 text-sm font-medium">
        <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
        <span>Chargement de votre abonnement...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Mon Abonnement</h1>
        <p className="text-xs text-slate-500 mt-1">Gérez votre abonnement et consultez son statut.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Abonnement en cours</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-3">
            {currentSubscription ? 'Oui' : 'Non'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {currentSubscription ? STATUS_CONFIG[currentSubscription.status]?.label || currentSubscription.status : 'Aucun actif'}
          </p>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Désactivés</span>
            <div className="p-2 rounded-lg bg-red-500/10 text-red-600">
              <Ban className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-3">
            {otherSubscriptions.filter((s) => s.status === 'cancelled' || s.status === 'suspended').length}
          </p>
          <p className="text-xs text-slate-500 mt-1">Abonnements annulés ou suspendus</p>
        </Card>

        <Card className="border-l-4 border-l-amber-500 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Jours restants</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-3">
            {currentSubscription?.end_date ? (calculateDaysRemaining(currentSubscription.end_date) ?? 0) : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {currentSubscription?.end_date ? `Jusqu'au ${formatDateFR(currentSubscription.end_date)}` : 'Date non définie'}
          </p>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total abonnements</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-3">
            {otherSubscriptions.length + (currentSubscription ? 1 : 0)}
          </p>
          <p className="text-xs text-slate-500 mt-1">Enregistrés sur l&apos;organisation</p>
        </Card>
      </div>

      {/* Current Subscription */}
      {currentSubscription ? (
        <Card className="p-6 border-2 border-amber-500/30 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-slate-900">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Zap className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {currentSubscription.plan?.name || 'Abonnement'}
                </h2>
                <Badge variant={STATUS_CONFIG[currentSubscription.status]?.color || 'neutral'}>
                  {STATUS_CONFIG[currentSubscription.status]?.label || currentSubscription.status}
                </Badge>
                {currentSubscription.cancel_at_period_end && (
                  <Badge variant="warning">Annulation programmée</Badge>
                )}
              </div>
              {currentSubscription.plan && currentSubscription.plan.price > 0 && (
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {formatCurrencyFCFA(currentSubscription.plan.price)} / {currentSubscription.plan.billing_period}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Days Remaining */}
            {currentSubscription.end_date && (
              <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
                  <Calendar className="w-4 h-4" />
                  Jours restants
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {calculateDaysRemaining(currentSubscription.end_date) ?? 0}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Expire le {formatDateFR(currentSubscription.end_date)}
                </div>
              </div>
            )}

            {/* Start Date */}
            {currentSubscription.start_date && (
              <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
                  <Clock className="w-4 h-4" />
                  Date de début
                </div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">
                  {formatDateFR(currentSubscription.start_date)}
                </div>
              </div>
            )}

            {/* Auto Renew */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
                <RefreshCw className="w-4 h-4" />
                Renouvellement auto
              </div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {currentSubscription.auto_renew ? 'Activé' : 'Désactivé'}
              </div>
            </div>
          </div>

          {/* Trial Info */}
          {currentSubscription.status === 'trialing' && currentSubscription.trial_end && (
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 border border-blue-200 dark:border-blue-800 mb-6">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                    Période d&apos;essai en cours
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    Votre période d&apos;essai se termine le <strong>{formatDateFR(currentSubscription.trial_end)}</strong>.
                    {calculateDaysRemaining(currentSubscription.trial_end) !== null && (
                      <> Il reste <strong>{calculateDaysRemaining(currentSubscription.trial_end)} jour(s)</strong>.</>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Warning for expiring soon */}
          {currentSubscription.end_date &&
           calculateDaysRemaining(currentSubscription.end_date) !== null &&
           calculateDaysRemaining(currentSubscription.end_date)! <= 7 &&
           calculateDaysRemaining(currentSubscription.end_date)! > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-4 border border-amber-200 dark:border-amber-800 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                    Abonnement arrive à échéance
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    Votre abonnement expire dans <strong>{calculateDaysRemaining(currentSubscription.end_date)} jour(s)</strong>.
                    Pensez à le renouveler pour continuer à bénéficier des services.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Plan Features */}
          {currentSubscription.plan && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Détails du plan</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                {currentSubscription.plan.max_users && (
                  <div>
                    <span className="text-slate-500">Utilisateurs max:</span>
                    <span className="font-semibold text-slate-900 dark:text-white ml-1">
                      {currentSubscription.plan.max_users}
                    </span>
                  </div>
                )}
                {currentSubscription.plan.max_points_of_sale && (
                  <div>
                    <span className="text-slate-500">PDV max:</span>
                    <span className="font-semibold text-slate-900 dark:text-white ml-1">
                      {currentSubscription.plan.max_points_of_sale}
                    </span>
                  </div>
                )}
                {currentSubscription.plan.max_tickets_per_month && (
                  <div>
                    <span className="text-slate-500">Tickets/mois:</span>
                    <span className="font-semibold text-slate-900 dark:text-white ml-1">
                      {currentSubscription.plan.max_tickets_per_month}
                    </span>
                  </div>
                )}
                {currentSubscription.plan.trial_days && (
                  <div>
                    <span className="text-slate-500">Jours d&apos;essai:</span>
                    <span className="font-semibold text-slate-900 dark:text-white ml-1">
                      {currentSubscription.plan.trial_days}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-8 text-center">
          <CreditCard className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Aucun abonnement actif</h3>
          <p className="text-xs text-slate-500 mt-1">
            Vous n&apos;avez pas d&apos;abonnement en cours. Contactez l&apos;administrateur pour souscrire à un plan.
          </p>
        </Card>
      )}

      {/* Other Subscriptions */}
      {otherSubscriptions.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
            Historique des abonnements
          </h2>
          <div className="space-y-3">
            {otherSubscriptions.map((sub) => {
              const config = STATUS_CONFIG[sub.status] || STATUS_CONFIG.cancelled;

              return (
                <Card key={sub.id} className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                        {config.icon}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white text-sm">
                          {sub.plan?.name || 'Abonnement'}
                        </p>
                        {sub.plan && sub.plan.price > 0 && (
                          <p className="text-xs text-slate-500">
                            {formatCurrencyFCFA(sub.plan.price)} / {sub.plan.billing_period}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <div className="text-right">
                        {sub.start_date && (
                          <p className="text-xs text-slate-500">
                            Du {formatDateFR(sub.start_date)}
                          </p>
                        )}
                        {sub.end_date && (
                          <p className="text-xs text-slate-500">
                            Au {formatDateFR(sub.end_date)}
                          </p>
                        )}
                      </div>
                      <Badge variant={config.color} className="shrink-0">{config.label}</Badge>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Contact Support */}
      <Card className="p-6 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <ArrowRight className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Besoin d&apos;aide ?</h3>
            <p className="text-xs text-slate-500 mt-1">
              Pour modifier votre abonnement, renouveler ou toute question, contactez le support OptiWifi.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
