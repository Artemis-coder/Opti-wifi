'use client';

import { Alert } from '@heroui/react';
import React, { useState, useEffect } from 'react';
import { CreditCard, Calendar, CheckCircle2, Clock, Package, AlertCircle, RotateCcw, AlertTriangle, Hourglass, XCircle, Layers, Store, Users, MapPin, Gift, ArrowRight, UserCheck } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/lib/stores/authStore';
import { createClient } from '@/lib/supabase/client';
import { formatCurrencyFCFA, formatDateFR } from '@/lib/utils/format';
import { InvoiceList } from '@/components/invoices/InvoiceList';
import { PaymentHistory } from '@/components/payments/PaymentHistory';
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
  max_collectors?: number | null;
  /** Accès point de vente : 0 = non inclus, null ou négatif = illimité */
  max_pos_accounts?: number | null;
  max_tickets_per_month?: number;
  trial_days?: number;
}

interface Subscription {
  id: string;
  status: string;
  start_date: string;
  end_date: string | null;
  /** Renseignée seulement pour un essai gratuit */
  trial_end?: string | null;
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

/** Limite d'un forfait : null ou négative (-1) = illimitée ; 0 = aucun */
const planLimit = (v: number | null | undefined) => (v === null || v === undefined || v < 0 ? null : v);

export default function SubscriptionPage() {
  const [loading, setLoading] = useState(true);
  const [requestPlan, setRequestPlan] = useState<{ plan: RequestedPlan; renewal: boolean } | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [allPlans, setAllPlans] = useState<SubscriptionPlan[]>([]);
  const [pendingRequest, setPendingRequest] = useState<LicenseRequestInfo | null>(null);
  const [lastRequest, setLastRequest] = useState<LicenseRequestInfo | null>(null);
  const [trialUsed, setTrialUsed] = useState(false);
  const [openPlanOnLoad, setOpenPlanOnLoad] = useState<SubscriptionPlan | null>(null);
  const [usage, setUsage] = useState({ posCount: 0, usersCount: 0, collectorsCount: 0, spacesCount: 0 });
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
        const [posRes, usersRes, collectorsRes, spacesRes] = await Promise.all([
          supabase.from('points_of_sale').select('id', { count: 'exact', head: true }),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('role', 'collecteur'),
          supabase.from('wifi_spaces').select('id', { count: 'exact', head: true }),
        ]);
        setUsage({
          posCount: posRes.count ?? 0,
          usersCount: usersRes.count ?? 0,
          collectorsCount: collectorsRes.count ?? 0,
          spacesCount: spacesRes.count ?? 0,
        });
        // Lien des rappels de fin d'essai (/subscription?plan=…) : ouvre la demande du forfait proposé
        const wanted = new URLSearchParams(window.location.search).get('plan');
        const target = wanted ? plansData?.find((p: SubscriptionPlan) => p.id === wanted) : null;
        if (target) {
          setOpenPlanOnLoad(target);
          window.history.replaceState(null, '', '/subscription');
        }
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
      case 'trialing':
        return <Badge variant="warning" className="gap-1"><Gift className="w-3.5 h-3.5" /> Essai gratuit</Badge>;
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
  // Essai gratuit (première souscription) : abonnement avec date de fin d'essai
  const onTrial = subscription?.status === 'trialing' || !!subscription?.trial_end;
  // Forfait de base proposé à la fin de l'essai : le moins cher des forfaits payants
  const basePlan = allPlans.find((p) => Number(p.price) > 0) ?? null;
  const trialLengthDays =
    onTrial && subscription?.end_date
      ? Math.max(1, Math.ceil((new Date(subscription.end_date).getTime() - new Date(subscription.start_date).getTime()) / 86_400_000))
      : null;

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
        max_collectors: target.max_collectors,
        max_pos_accounts: target.max_pos_accounts,
        max_tickets_per_month: target.max_tickets_per_month,
      },
      renewal: !plan,
    });
  };

  // Ouverture différée (après chargement) de la demande demandée par le lien du rappel
  if (!loading && openPlanOnLoad && !pendingRequest && !requestPlan) {
    handleRequest(openPlanOnLoad);
    setOpenPlanOnLoad(null);
  }

  if (loading) {
    return (
      <div className="py-10 flex justify-center items-center text-muted">
        Chargement...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
          <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-muted" />
          <span>Mon Abonnement</span>
        </h1>
        <p className="text-xs text-muted mt-0.5">
          Gérez votre abonnement et découvrez nos forfaits
        </p>
      </div>

      {pendingRequest && (
        <Alert status="accent">
          <Alert.Indicator>
            <Hourglass className="size-5" />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>Demande en attente de validation</Alert.Title>
            <Alert.Description>
              {pendingRequest.plan_name || 'Forfait'} · {pendingRequest.duration_months} mois — envoyée le {formatDateFR(pendingRequest.created_at)}.
              Votre licence sera activée dès validation par l&apos;équipe OptiWifi.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      {!pendingRequest && lastRequest?.status === 'rejected' && (
        <Alert status="danger">
          <Alert.Indicator>
            <XCircle className="size-5" />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>Votre dernière demande a été refusée</Alert.Title>
            {lastRequest.admin_note && (
              <Alert.Description>Motif : {lastRequest.admin_note}</Alert.Description>
            )}
          </Alert.Content>
        </Alert>
      )}

      {subscription ? (
        <Card className={`space-y-4 ${isExpired ? 'border-danger/30 ' : ''}`}>
          {isExpired && (
            <Alert status="danger" className="mb-4">
              <Alert.Indicator>
                <AlertTriangle className="size-5" />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>
                  {onTrial ? 'Votre essai gratuit est terminé' : 'Votre abonnement a expiré'}
                </Alert.Title>
                <Alert.Description>
                  {onTrial
                    ? 'Choisissez un forfait pour retrouver l’accès à votre espace et à vos données.'
                    : 'Votre espace est en consultation seule : vos données restent visibles, mais vous ne pouvez plus rien ajouter ni modifier. Choisissez votre forfait ci-dessous pour renouveler.'}
                </Alert.Description>
              </Alert.Content>
            </Alert>
          )}
          {!isExpired && isExpiringSoon && (
            <Alert status="warning" className="mb-4">
              <Alert.Indicator>
                <AlertCircle className="size-5" />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>
                  {onTrial ? 'Votre essai gratuit se termine bientôt' : 'Votre abonnement expire bientôt'}
                </Alert.Title>
                <Alert.Description>
                  Il vous reste {daysRemaining} jour{daysRemaining && daysRemaining > 1 ? 's' : ''} avant expiration.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          )}

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Mon forfait actuel</h2>
              <p className="text-sm text-muted mt-1">
                {subscription.plan?.name || 'Forfait'}
              </p>
            </div>
            {isExpired ? (
              <Badge variant="danger" className="gap-1"><AlertCircle className="w-3.5 h-3.5" /> Expiré</Badge>
            ) : (
              getStatusBadge(subscription.status)
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 pt-4 border-t border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent-soft flex items-center justify-center">
                <Package className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-xs text-muted">Prix</p>
                <p className="text-sm font-semibold text-foreground">
                  {subscription.plan ? formatCurrencyFCFA(subscription.plan.price) : '-'}
                  {subscription.plan && <span className="text-xs text-muted ml-1">/ {getBillingPeriodLabel(subscription.plan.billing_period)}</span>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success-soft flex items-center justify-center">
                <Calendar className="w-5 h-5 text-success-soft-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted">Date de début</p>
                <p className="text-sm font-semibold text-foreground">
                  {formatDateFR(subscription.start_date)}
                </p>
              </div>
            </div>
            {subscription.end_date && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-warning-soft flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-warning-soft-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted">Date d&apos;expiration</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatDateFR(subscription.end_date)}
                  </p>
                </div>
              </div>
            )}
            {daysRemaining !== null && daysRemaining > 0 && !isExpired && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent-soft flex items-center justify-center">
                  <Clock className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-xs text-muted">Jours restants</p>
                  <p className="text-sm font-semibold text-foreground">
                    {daysRemaining} jour{daysRemaining > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent-soft flex items-center justify-center">
                <Package className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-xs text-muted">{onTrial ? "Durée de l'essai" : 'Durée du forfait'}</p>
                <p className="text-sm font-semibold text-foreground">
                  {trialLengthDays
                    ? `${trialLengthDays} jour${trialLengthDays > 1 ? 's' : ''}`
                    : subscription.plan
                      ? `${getDurationMonths(subscription.plan.billing_period)} mois`
                      : '-'}
                </p>
              </div>
            </div>
          </div>

          {subscription.plan && !pendingRequest && onTrial && (
            <div className="pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
              <p className="text-sm text-muted">
                {isExpired ? 'Votre essai gratuit est terminé' : `Votre essai gratuit se termine le ${subscription.end_date ? formatDateFR(subscription.end_date) : '—'}`}
                {basePlan ? (
                  <>
                    {' '}: passez au forfait <strong>{basePlan.name}</strong> ({formatCurrencyFCFA(Number(basePlan.price))} /{' '}
                    {getBillingPeriodLabel(basePlan.billing_period).toLowerCase()}) pour continuer.
                  </>
                ) : (
                  <> : choisissez un forfait ci-dessous pour continuer.</>
                )}
              </p>
              {basePlan && (
                <Button variant={isExpired ? 'danger' : 'primary'} size="sm" className="shrink-0" onClick={() => handleRequest(basePlan)}>
                  <span className="mr-2">Choisir {basePlan.name}</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}
          {subscription.plan && !pendingRequest && !onTrial && (
            <div className="pt-4 border-t border-border flex justify-end">
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
        <Card className="text-center">
          <p className="text-muted">Aucune licence active. Choisissez un forfait ci-dessous pour en faire la demande.</p>
        </Card>
      )}

      {subscription?.plan && (
        <Card>
          <h2 className="text-sm font-semibold text-muted mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-accent" />
            Utilisation de votre forfait
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[
              { label: 'Points de vente', icon: Store, count: usage.posCount, limit: planLimit(subscription.plan.max_points_of_sale) },
              { label: "Membres d'équipe", icon: Users, count: usage.usersCount, limit: planLimit(subscription.plan.max_users) },
              { label: 'Collecteurs', icon: UserCheck, count: usage.collectorsCount, limit: planLimit(subscription.plan.max_collectors) },
              { label: 'Espaces Wi-Fi', icon: MapPin, count: usage.spacesCount, limit: null },
            ].map((q) => {
              const Icon = q.icon;
              const percent =
                q.limit === null ? 0 : q.limit === 0 ? (q.count > 0 ? 100 : 0) : Math.min(100, Math.round((q.count / q.limit) * 100));
              return (
                <div key={q.label} className="p-4 rounded-xl border border-border space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 text-accent" /> {q.label}
                    </span>
                    <span className="font-semibold text-foreground">
                      {q.count} / {q.limit ?? 'Illimité'}
                    </span>
                  </div>
                  {q.limit !== null ? (
                    <>
                      <div className="w-full h-2 rounded-full bg-default overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            percent >= 90 ? 'bg-danger' : percent >= 70 ? 'bg-warning' : 'bg-accent'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted">{percent}% du quota utilisé</p>
                    </>
                  ) : (
                    <p className="text-xs text-muted">Sans limite sur ce forfait</p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <InvoiceList />

      <PaymentHistory />

      <div>
        <h2 id="forfaits" className="text-lg font-semibold text-foreground mb-4 scroll-mt-24">Tous les forfaits disponibles</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {allPlans.map((plan) => (
            <Card key={plan.id} className={`flex flex-col gap-4 ${subscription?.plan_id === plan.id ? 'ring-1 ring-accent/40' : ''}`}>
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                  {subscription?.plan_id === plan.id && <Badge variant="success">Votre forfait</Badge>}
                </div>
                <div className="mt-2 flex flex-wrap items-baseline gap-x-1">
                  <span className="text-2xl font-semibold tabular-nums text-foreground">
                    {formatCurrencyFCFA(plan.price)}
                  </span>
                  <span className="text-sm text-muted">/ {getBillingPeriodLabel(plan.billing_period)}</span>
                </div>
              </div>
              <div className="space-y-2 pt-4 border-t border-border">
                {plan.max_users && (
                  <div className="flex items-center gap-2 text-sm text-muted">
                    <CheckCircle2 className="w-4 h-4 text-success-soft-foreground" />
                    <span>Jusqu&apos;à {plan.max_users} utilisateurs</span>
                  </div>
                )}
                {plan.max_points_of_sale && (
                  <div className="flex items-center gap-2 text-sm text-muted">
                    <CheckCircle2 className="w-4 h-4 text-success-soft-foreground" />
                    <span>Jusqu&apos;à {plan.max_points_of_sale} points de vente</span>
                  </div>
                )}
                {plan.max_collectors !== null && plan.max_collectors !== undefined && (
                  <div className="flex items-center gap-2 text-sm text-muted">
                    <CheckCircle2 className="w-4 h-4 text-success-soft-foreground" />
                    <span>
                      {plan.max_collectors < 0
                        ? 'Collecteurs illimités'
                        : plan.max_collectors === 0
                          ? 'Sans collecteur'
                        : `Jusqu'à ${plan.max_collectors} collecteur${plan.max_collectors > 1 ? 's' : ''}`}
                    </span>
                  </div>
                )}
                {/* Accès point de vente (consultation seule) : inclus ou non selon le forfait */}
                <div className="flex items-center gap-2 text-sm text-muted">
                  {plan.max_pos_accounts === 0 ? (
                    <XCircle className="w-4 h-4 text-muted" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-success-soft-foreground" />
                  )}
                  <span className={plan.max_pos_accounts === 0 ? 'text-muted line-through' : undefined}>
                    {plan.max_pos_accounts === 0
                      ? 'Accès points de vente'
                      : plan.max_pos_accounts && plan.max_pos_accounts > 0
                        ? `Jusqu'à ${plan.max_pos_accounts} accès points de vente`
                        : 'Accès points de vente (consultation)'}
                  </span>
                </div>
                {plan.max_tickets_per_month && (
                  <div className="flex items-center gap-2 text-sm text-muted">
                    <CheckCircle2 className="w-4 h-4 text-success-soft-foreground" />
                    <span>Jusqu&apos;à {plan.max_tickets_per_month.toLocaleString()} tickets/mois</span>
                  </div>
                )}
              </div>
              {/* Pied de carte aligné en bas : le bouton est au même endroit sur tous les forfaits */}
              <div className="mt-auto space-y-2 pt-2">
                {/* Essai gratuit : seulement pour une première souscription */}
                {!trialUsed && Number(plan.trial_days ?? 0) > 0 && (
                  <p className="text-xs text-muted">Essai gratuit de {plan.trial_days} jours pour démarrer.</p>
                )}
                {subscription?.plan_id === plan.id && !onTrial && !isExpired ? (
                  <Button variant="secondary" className="w-full" disabled>
                    <CheckCircle2 className="size-4" /> Forfait actuel
                  </Button>
                ) : pendingRequest ? (
                  <Button variant="secondary" className="w-full" disabled>
                    <Hourglass className="size-4 shrink-0" /> Demande en cours de validation
                  </Button>
                ) : (
                  <Button
                    className="w-full whitespace-nowrap"
                    // Abonnement expiré : le forfait actuel se renouvelle
                    onClick={() => (subscription?.plan_id === plan.id && !onTrial ? handleRequest() : handleRequest(plan))}
                  >
                    {subscription?.plan_id === plan.id && !onTrial
                      ? 'Renouveler ce forfait'
                      : subscription?.plan && Number(plan.price) > Number(subscription.plan.price)
                      ? 'Passer à ce forfait'
                      : 'Choisir ce forfait'}
                    <ArrowRight className="size-4" />
                  </Button>
                )}
              </div>
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
