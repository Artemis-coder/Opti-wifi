'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  ShieldCheck,
  Zap,
  Users,
  Store,
  MapPin,
  Check,
  ChevronRight,
  Loader2,
  Calendar,
  Layers,
  ArrowUpRight,
  HelpCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatCurrencyFCFA, formatDateOnlyFR, formatDateFR } from '@/lib/utils/format';
import { useAuthStore } from '@/lib/stores/authStore';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface Plan {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency?: string;
  billing_period?: string;
  trial_days?: number;
  max_users?: number | null;
  max_points_of_sale?: number | null;
  max_spaces?: number | null;
  max_tickets_per_month?: number | null;
  features?: string[] | null;
  status: string;
}

interface Subscription {
  id: string;
  organization_id: string;
  plan_id: string;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired';
  start_date?: string;
  end_date?: string;
  trial_end?: string;
  cancelled_at?: string;
  created_at: string;
  plan?: Plan;
}

export default function SubscriptionPage() {
  const { user } = useAuthStore();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [currentSub, setCurrentSub] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [usage, setUsage] = useState({
    posCount: 0,
    usersCount: 0,
    spacesCount: 0,
  });
  const [selectedPlanModal, setSelectedPlanModal] = useState<Plan | null>(null);

  useEffect(() => {
    async function loadSubscriptionData() {
      setLoading(true);

      try {
        // 1. Récupérer l'abonnement actuel de l'organisation
        let subQuery = supabase
          .from('subscriptions')
          .select('*, plan:subscription_plans(*)')
          .order('created_at', { ascending: false })
          .limit(1);

        if (user?.organization_id) {
          subQuery = subQuery.eq('organization_id', user.organization_id);
        }

        // 2. Récupérer tous les forfaits actifs
        const plansQuery = supabase
          .from('subscription_plans')
          .select('*')
          .eq('status', 'active')
          .order('price', { ascending: true });

        // 3. Récupérer l'utilisation actuelle des quotas
        let posCountQuery = supabase.from('points_of_sale').select('*', { count: 'exact', head: true });
        let usersCountQuery = supabase.from('profiles').select('*', { count: 'exact', head: true });
        let spacesCountQuery = supabase.from('wifi_spaces').select('*', { count: 'exact', head: true });

        if (user?.organization_id) {
          posCountQuery = posCountQuery.eq('organization_id', user.organization_id);
          usersCountQuery = usersCountQuery.eq('organization_id', user.organization_id);
          spacesCountQuery = spacesCountQuery.eq('organization_id', user.organization_id);
        }

        const [subRes, plansRes, posRes, usersRes, spacesRes] = await Promise.all([
          subQuery.maybeSingle(),
          plansQuery,
          posCountQuery,
          usersCountQuery,
          spacesCountQuery,
        ]);

        if (subRes.data) {
          setCurrentSub(subRes.data as Subscription);
        }

        if (plansRes.data) {
          setPlans(plansRes.data as Plan[]);
        }

        setUsage({
          posCount: posRes.count || 0,
          usersCount: usersRes.count || 0,
          spacesCount: spacesRes.count || 0,
        });
      } catch (err) {
        console.error('[SubscriptionPage] Erreur au chargement:', err);
      } finally {
        setLoading(false);
      }
    }

    loadSubscriptionData();
  }, [user?.organization_id, supabase]);

  const handleContactUpgrade = (plan: Plan) => {
    toast.info(
      `Pour passer au forfait "${plan.name}", contactez votre gestionnaire de compte ou écrivez au support à support@optiwifi.site`,
      { duration: 6000 }
    );
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success" className="gap-1 font-bold"><CheckCircle2 className="w-3 h-3" /> Actif</Badge>;
      case 'trialing':
        return <Badge variant="info" className="gap-1 font-bold"><Clock className="w-3 h-3" /> Période d&apos;essai</Badge>;
      case 'past_due':
        return <Badge variant="warning" className="gap-1 font-bold"><AlertTriangle className="w-3 h-3" /> En attente de paiement</Badge>;
      case 'canceled':
      case 'expired':
        return <Badge variant="danger" className="gap-1 font-bold"><AlertTriangle className="w-3 h-3" /> Expiré / Annulé</Badge>;
      default:
        return <Badge variant="neutral" className="gap-1 font-bold">Sans engagement</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center gap-3 text-slate-500 text-sm">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
        <span>Chargement des détails de votre abonnement...</span>
      </div>
    );
  }

  const activePlan = currentSub?.plan;
  const isTrial = currentSub?.status === 'trialing';

  // Calcul du % d'utilisation des quotas
  const posLimit = activePlan?.max_points_of_sale ?? 10;
  const posPercent = posLimit ? Math.min(100, Math.round((usage.posCount / posLimit) * 100)) : 0;

  const usersLimit = activePlan?.max_users ?? 5;
  const usersPercent = usersLimit ? Math.min(100, Math.round((usage.usersCount / usersLimit) * 100)) : 0;

  const spacesLimit = activePlan?.max_spaces ?? 3;
  const spacesPercent = spacesLimit ? Math.min(100, Math.round((usage.spacesCount / spacesLimit) * 100)) : 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-brand-600 dark:text-brand-400" />
            <span>Abonnement &amp; Forfaits</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gérez votre forfait OptiWifi, suivez vos quotas de consommation et faites évoluer vos services.
          </p>
        </div>
        <Link href="/platform/support" className="w-full sm:w-auto">
          <Button variant="ghost" size="sm" className="w-full sm:w-auto gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <HelpCircle className="w-4 h-4" />
            Besoin d&apos;assistance ?
          </Button>
        </Link>
      </div>

      {/* ── Active Subscription Hero Card ── */}
      <Card className="p-5 sm:p-7 border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0 border border-brand-500/20">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                  Forfait {activePlan?.name || 'Standard'}
                </h2>
                {getStatusBadge(currentSub?.status)}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {activePlan?.description || 'Gestion des points de vente, allocations et encaissements Wi-Fi.'}
              </p>
            </div>
          </div>

          <div className="sm:text-right">
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {formatCurrencyFCFA(activePlan?.price || 0)}
              <span className="text-xs font-medium text-slate-500 ml-1">
                / {activePlan?.billing_period === 'yearly' ? 'an' : 'mois'}
              </span>
            </div>
            {currentSub?.end_date && (
              <p className="text-[11px] text-slate-500 mt-1 flex items-center sm:justify-end gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                Renouvellement le {formatDateOnlyFR(currentSub.end_date)}
              </p>
            )}
            {isTrial && currentSub?.trial_end && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-1 flex items-center sm:justify-end gap-1">
                <Clock className="w-3 h-3" />
                Fin de l&apos;essai le {formatDateOnlyFR(currentSub.trial_end)}
              </p>
            )}
          </div>
        </div>

        {/* ── Quotas & Consommation en direct ── */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-brand-500" />
            Quotas et Utilisation en direct
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Points de vente */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-brand-500" /> Points de Vente
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {usage.posCount} / {posLimit ? posLimit : 'Illimité'}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    posPercent >= 90 ? 'bg-red-500' : posPercent >= 70 ? 'bg-amber-500' : 'bg-brand-500'
                  }`}
                  style={{ width: `${posPercent}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400">
                {posPercent}% du quota utilisé
              </p>
            </div>

            {/* Utilisateurs */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-500" /> Membres d&apos;Équipe
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {usage.usersCount} / {usersLimit ? usersLimit : 'Illimité'}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    usersPercent >= 90 ? 'bg-red-500' : usersPercent >= 70 ? 'bg-amber-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${usersPercent}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400">
                {usersPercent}% du quota utilisé
              </p>
            </div>

            {/* Espaces Wi-Fi */}
            <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-500" /> Espaces Wi-Fi
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {usage.spacesCount} / {spacesLimit ? spacesLimit : 'Illimité'}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    spacesPercent >= 90 ? 'bg-red-500' : spacesPercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${spacesPercent}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400">
                {spacesPercent}% du quota utilisé
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Grille des Forfaits Disponibles ── */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            Comparer et Choisir un Forfait
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Passez à un forfait supérieur pour augmenter vos limites de points de vente et débloquer plus de fonctionnalités.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((p) => {
            const isCurrent = activePlan?.id === p.id;
            const features = Array.isArray(p.features) ? p.features : [
              `${p.max_points_of_sale || 'Illimité'} Points de Vente`,
              `${p.max_users || 'Illimité'} Membres d'équipe`,
              'Collectes & encaissements illimités',
              'Export comptable & rapports PDF/CSV',
              'Assistance dédiée 7j/7',
            ];

            return (
              <Card
                key={p.id}
                className={`p-5 rounded-3xl flex flex-col justify-between transition-all duration-200 border-2 ${
                  isCurrent
                    ? 'border-brand-500 bg-brand-50/20 dark:bg-brand-950/20 shadow-md ring-2 ring-brand-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="space-y-4">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">{p.name}</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5 min-h-[28px]">{p.description || 'Pour réseaux Wi-Fi et points de vente en croissance.'}</p>
                    </div>
                    {isCurrent && (
                      <Badge variant="success" className="text-[10px] px-2 py-0.5 shrink-0 font-bold">
                        Actuel
                      </Badge>
                    )}
                  </div>

                  {/* Price */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="text-2xl font-black text-slate-900 dark:text-white">
                      {formatCurrencyFCFA(p.price)}
                      <span className="text-xs font-semibold text-slate-400 ml-1">
                        / {p.billing_period === 'yearly' ? 'an' : 'mois'}
                      </span>
                    </div>
                  </div>

                  {/* Feature list */}
                  <div className="space-y-2 pt-2 text-xs text-slate-600 dark:text-slate-300">
                    {features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span className="leading-tight">{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTA Button */}
                <div className="pt-6">
                  {isCurrent ? (
                    <Button variant="secondary" disabled className="w-full font-bold text-xs opacity-70">
                      Votre forfait actuel
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={() => handleContactUpgrade(p)}
                      className="w-full font-bold text-xs gap-1.5 shadow-sm"
                    >
                      <span>Passer à {p.name}</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── Security & Guarantee Banner ── */}
      <Card className="p-4 sm:p-5 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                Paiement Sécurisé &amp; Flexibilité Garantie
              </p>
              <p className="text-[11px] text-slate-500">
                Paiements supportés via Mobile Money (Wave, Orange, MTN, Moov) et virement bancaire.
              </p>
            </div>
          </div>
          <Link href="/platform/support" className="text-xs font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400 shrink-0">
            Contacter le support commercial →
          </Link>
        </div>
      </Card>
    </div>
  );
}
