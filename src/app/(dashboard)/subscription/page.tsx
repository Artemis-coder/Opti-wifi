'use client';

import React, { useState, useEffect } from 'react';
import { CreditCard, Calendar, CheckCircle2, Clock, Package, AlertCircle, RotateCcw, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/lib/stores/authStore';
import { createClient } from '@/lib/supabase/client';
import { formatCurrencyFCFA, formatDateFR } from '@/lib/utils/format';
import { toast } from 'sonner';

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  billing_period: string;
  features?: unknown;
  max_users?: number;
  max_points_of_sale?: number;
  max_tickets_per_month?: number;
}

interface Subscription {
  id: string;
  status: string;
  start_date: string;
  end_date: string | null;
  plan_id: string;
  organization_id: string;
  plan?: SubscriptionPlan;
  organization?: { name: string };
}

export default function SubscriptionPage() {
  const [loading, setLoading] = useState(true);
  const [renewing, setRenewing] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [allPlans, setAllPlans] = useState<SubscriptionPlan[]>([]);
  const { user } = useAuthStore();
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const { data: plansData } = await supabase
          .from('subscription_plans')
          .select('*')
          .eq('status', 'active')
          .order('price', { ascending: true });
        if (plansData) setAllPlans(plansData);

        let orgId: string | undefined = (user as any)?.organization_id || (user as any)?.organisation_id;
        
        if (!orgId && user?.id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();
          orgId = profile?.organization_id;
        }
        
        if (orgId) {
          const { data: subData } = await supabase
            .from('subscriptions')
            .select('*, plan:subscription_plans(*)')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (subData) setSubscription(subData);
        }
      } catch (error) {
        console.error('Error loading subscription:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user, supabase]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success" className="gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Actif</Badge>;
      case 'trial':
        return <Badge variant="warning" className="gap-1"><Clock className="w-3.5 h-3.5" /> Essai</Badge>;
      case 'past_due':
        return <Badge variant="danger" className="gap-1"><AlertCircle className="w-3.5 h-3.5" /> Impayé</Badge>;
      case 'cancelled':
        return <Badge variant="neutral">Annulé</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getBillingPeriodLabel = (period: string) => {
    switch (period) {
      case 'monthly': return 'Mensuel';
      case 'quarterly': return 'Trimestriel';
      case 'semiannual': return 'Semestriel';
      case 'annual': return 'Annuel';
      default: return period;
    }
  };

  const getDurationMonths = (period: string): number => {
    switch (period) {
      case 'monthly': return 1;
      case 'quarterly': return 3;
      case 'semiannual': return 6;
      case 'annual': return 12;
      default: return 1;
    }
  };

  const daysRemaining = subscription?.end_date 
    ? Math.max(0, Math.ceil((new Date(subscription.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  const isExpired = subscription ? (subscription.status === 'expired' || (subscription.end_date && new Date(subscription.end_date).getTime() < new Date().getTime())) : false;
  const isExpiringSoon = subscription && !isExpired && daysRemaining !== null && daysRemaining <= 7;

  const handleRenew = async () => {
    if (!subscription) return;
    setRenewing(true);
    try {
      const res = await fetch('/api/subscriptions/renew', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Échec du renouvellement');
        return;
      }
      toast.success('Abonnement renouvelé avec succès !');
      // Recharger les données
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('*, plan:subscription_plans(*)')
        .eq('organization_id', subscription.organization_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (subData) setSubscription(subData);
    } catch (error) {
      console.error('Renew error:', error);
      toast.error('Erreur lors du renouvellement');
    } finally {
      setRenewing(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center items-center text-slate-500">
        Chargement...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-brand-600 dark:text-brand-400" />
          <span>Mon Abonnement</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Gérez votre abonnement et découvrez nos forfaits
        </p>
      </div>

      {subscription ? (
        <Card className={`p-6 space-y-4 ${isExpired ? 'border-red-200 dark:border-red-900/40' : ''}`}>
          {isExpired && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                  Votre abonnement a expiré
                </p>
                <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                  Vous n&apos;avez plus accès à votre espace tant que vous n&apos;aurez pas renouvelé votre abonnement.
                </p>
              </div>
            </div>
          )}
          {!isExpired && isExpiringSoon && (
            <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                  Votre abonnement expire bientôt
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                  il vous reste {daysRemaining} jour{daysRemaining && daysRemaining > 1 ? 's' : ''} avant expiration.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Mon forfait actuel</h2>
              <p className="text-sm text-slate-500 mt-1">
                {subscription.plan?.name || 'Forfait'}
              </p>
            </div>
            {getStatusBadge(subscription.status)}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-brand-500/10 flex items-center justify-center">
                <Package className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Prix</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {subscription.plan ? formatCurrencyFCFA(subscription.plan.price) : '-'}
                  {subscription.plan && <span className="text-xs text-slate-500 ml-1">/ {getBillingPeriodLabel(subscription.plan.billing_period)}</span>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Date de début</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {formatDateFR(subscription.start_date)}
                </p>
              </div>
            </div>
            {subscription.end_date && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Date d'expiration</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {formatDateFR(subscription.end_date)}
                  </p>
                </div>
              </div>
            )}
            {daysRemaining !== null && daysRemaining > 0 && !isExpired && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Jours restants</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {daysRemaining} jour{daysRemaining > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Package className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Durée du forfait</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {subscription.plan ? `${getDurationMonths(subscription.plan.billing_period)} mois` : '-'}
                </p>
              </div>
            </div>
          </div>

          {(isExpired || isExpiringSoon || daysRemaining === null) && subscription.plan && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <Button
                variant={isExpired ? 'danger' : 'primary'}
                size="sm"
                onClick={handleRenew}
                disabled={renewing}
              >
                {renewing ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" />
                    <span className="ml-2">Renouvellement...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span className="ml-2">{isExpired ? "Renouveler mon abonnement" : "Renouveler maintenant"}</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-6 text-center">
          <p className="text-slate-500">Aucun abonnement actif trouvé</p>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Tous les forfaits disponibles</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allPlans.map((plan) => (
            <Card 
              key={plan.id} 
              className={`p-6 space-y-4 relative ${
                subscription?.plan_id === plan.id 
                  ? 'ring-2 ring-brand-500 border-brand-500' 
                  : ''
              }`}
            >
              {subscription?.plan_id === plan.id && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="success">Votre forfait</Badge>
                </div>
              )}
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                    {formatCurrencyFCFA(plan.price)}
                  </span>
                  <span className="text-sm text-slate-500">/ {getBillingPeriodLabel(plan.billing_period)}</span>
                </div>
              </div>
              <div className="space-y-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                {plan.max_users && (
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Jusqu&apos;à {plan.max_users} utilisateurs</span>
                  </div>
                )}
                {plan.max_points_of_sale && (
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Jusqu&apos;à {plan.max_points_of_sale} points de vente</span>
                  </div>
                )}
                {plan.max_tickets_per_month && (
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Jusqu&apos;à {plan.max_tickets_per_month.toLocaleString()} tickets/mois</span>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
