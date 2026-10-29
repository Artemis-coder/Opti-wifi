'use client';

import React, { useState, useEffect } from 'react';
import { CreditCard, Calendar, CheckCircle2, Clock, Package, AlertCircle, RotateCcw, AlertTriangle, Hourglass, XCircle, Layers, Store, Users, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/lib/stores/authStore';
import { createClient } from '@/lib/supabase/client';
import { formatCurrencyFCFA, formatDateFR } from '@/lib/utils/format';
import { LicenseRequestDialog, type RequestedPlan } from '@/components/payments/LicenseRequestDialog';

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
  trial_days?: number;
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

interface LicenseRequestInfo {
  id: string;
  type: 'renewal' | 'new' | 'upgrade';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  duration_months: number;
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
  plan_name: string | null;
}

export default function SubscriptionPage() {
  const [loading, setLoading] = useState(true);
  const [requestPlan, setRequestPlan] = useState<{ plan: RequestedPlan; renewal: boolean } | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [allPlans, setAllPlans] = useState<SubscriptionPlan[]>([]);
  const [pendingRequest, setPendingRequest] = useState<LicenseRequestInfo | null>(null);
  const [lastRequest, setLastRequest] = useState<LicenseRequestInfo | null>(null);
  const [trialUsed, setTrialUsed] = useState(false);
  const [usage, setUsage] = useState({ posCount: 0, usersCount: 0, spacesCount: 0 });
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

        const userOrg = user as { organization_id?: string | null; organisation_id?: string | null } | null;
        let orgId: string | undefined = userOrg?.organization_id || userOrg?.organisation_id || undefined;
        
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
        await loadRequestState();

        // Utilisation actuelle (les requêtes sont limitées à l'organisation côté serveur)
        const [posRes, usersRes, spacesRes] = await Promise.all([
          supabase.from('points_of_sale').select('id', { count: 'exact', head: true }),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('wifi_spaces').select('id', { count: 'exact', head: true }),
        ]);
        setUsage({
          posCount: posRes.count ?? 0,
          usersCount: usersRes.count ?? 0,
          spacesCount: spacesRes.count ?? 0,
        });
      } catch (error) {
        console.error('Error loading subscription:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user, supabase]);

  async function loadRequestState() {
    const res = await fetch('/api/subscriptions/renew');
    if (!res.ok) return;
    const { data } = await res.json();
    setPendingRequest(data?.pendingRequest || null);
    setLastRequest(data?.lastRequest || null);
    setTrialUsed(data?.trialUsed === true);
  }

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

  // Ouvre la demande de licence : montant, moyens de paiement, référence du paiement
  const handleRequest = (plan?: SubscriptionPlan) => {
    const target = plan || subscription?.plan;
    if (!target) return;
    setRequestPlan({
      plan: {
        id: target.id,
        name: target.name,
        price: Number(target.price),
        billing_period: target.billing_period,
        max_users: target.max_users,
        max_points_of_sale: target.max_points_of_sale,
        max_tickets_per_month: target.max_tickets_per_month,
      },
      renewal: !plan,
    });
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

      {pendingRequest && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/40 rounded-xl flex items-start gap-3">
          <Hourglass className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">Demande en attente de validation</p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
              {pendingRequest.plan_name || 'Forfait'} · {pendingRequest.duration_months} mois — envoyée le {formatDateFR(pendingRequest.created_at)}.
              Votre licence sera activée dès validation par l&apos;équipe OptiWifi.
            </p>
          </div>
        </div>
      )}
      {!pendingRequest && lastRequest?.status === 'rejected' && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-xl flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800 dark:text-red-200">Votre dernière demande a été refusée</p>
            {lastRequest.admin_note && (
              <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">Motif : {lastRequest.admin_note}</p>
            )}
          </div>
        </div>
      )}

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
                  <p className="text-xs text-slate-500">Date d&apos;expiration</p>
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

          {subscription.plan && !pendingRequest && Number(subscription.plan.trial_days ?? 0) > 0 && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-400">
              Le forfait <strong>{subscription.plan.name}</strong> est un forfait d&apos;essai : il n&apos;est pas renouvelable.
              Choisissez un autre forfait ci-dessous pour continuer.
            </div>
          )}
          {subscription.plan && !pendingRequest && Number(subscription.plan.trial_days ?? 0) === 0 && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <Button
                variant={isExpired ? 'danger' : 'primary'}
                size="sm"
                onClick={() => handleRequest()}
              >
                <RotateCcw className="w-4 h-4" />
                <span className="ml-2">Me réabonner</span>
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-6 text-center">
          <p className="text-slate-500">Aucune licence active. Choisissez un forfait ci-dessous pour en faire la demande.</p>
        </Card>
      )}

      {subscription?.plan && (
        <Card className="p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-brand-500" />
            Utilisation de votre forfait
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Points de vente', icon: Store, count: usage.posCount, limit: subscription.plan.max_points_of_sale ?? null },
              { label: "Membres d'équipe", icon: Users, count: usage.usersCount, limit: subscription.plan.max_users ?? null },
              { label: 'Espaces Wi-Fi', icon: MapPin, count: usage.spacesCount, limit: null },
            ].map((q) => {
              const Icon = q.icon;
              const percent = q.limit ? Math.min(100, Math.round((q.count / q.limit) * 100)) : 0;
              return (
                <div key={q.label} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 text-brand-500" /> {q.label}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {q.count} / {q.limit ?? 'Illimité'}
                    </span>
                  </div>
                  {q.limit ? (
                    <>
                      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            percent >= 90 ? 'bg-red-500' : percent >= 70 ? 'bg-amber-500' : 'bg-brand-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-400">{percent}% du quota utilisé</p>
                    </>
                  ) : (
                    <p className="text-[10px] text-slate-400">Sans limite sur ce forfait</p>
                  )}
                </div>
              );
            })}
          </div>
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
              {Number(plan.trial_days ?? 0) > 0 && (
                <p className="text-xs text-slate-500">
                  {trialUsed ? 'Forfait d’essai déjà utilisé : non disponible.' : `Forfait d’essai : ${plan.trial_days} jours, une seule fois.`}
                </p>
              )}
              {!pendingRequest && subscription?.plan_id !== plan.id && !(trialUsed && Number(plan.trial_days ?? 0) > 0) && (
                <Button variant="outline" size="sm" className="w-full" onClick={() => handleRequest(plan)}>
                  Choisir ce forfait
                </Button>
              )}
              {trialUsed && Number(plan.trial_days ?? 0) > 0 && subscription?.plan_id !== plan.id && (
                <Badge variant="neutral" className="w-full justify-center">Déjà utilisé</Badge>
              )}
            </Card>
          ))}
        </div>
      </div>
      <LicenseRequestDialog
        plan={requestPlan?.plan ?? null}
        renewal={requestPlan?.renewal}
        onClose={() => setRequestPlan(null)}
        onSent={() => {
          setRequestPlan(null);
          loadRequestState();
        }}
      />
    </div>
  );
}
