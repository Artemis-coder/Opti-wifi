'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/types/database';
import { Button } from '@/components/ui/Button';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const router = useRouter();
  const { user, isLoading, setUser } = useAuthStore();
  const supabase = createClient();

  const [orgStatus, setOrgStatus] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [checkingOrg, setCheckingOrg] = useState(true);
  const [checkingSub, setCheckingSub] = useState(true);
  // Licence expirée : calculée côté serveur (même règle que le blocage des données)
  const [licenceExpired, setLicenceExpired] = useState(false);
  const [renewState, setRenewState] = useState<'idle' | 'sending' | 'pending'>('idle');
  const [renewError, setRenewError] = useState('');
  const [renewPlans, setRenewPlans] = useState<{ id: string; name: string; price: number; billing_period: string; current: boolean }[]>([]);

  useEffect(() => {
    let isMounted = true;

    // Safety timeout: never stay in loading state longer than 4 seconds
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setCheckingOrg(false);
      }
    }, 4000);

        async function initUserAndProfile() {
          try {
            let currentUser = user;

            // If user is not yet loaded in Zustand store (e.g. page refresh), check cookie session
            if (!currentUser) {
              const { data } = await supabase.auth.getUser();
              if (data?.user) {
                currentUser = data.user as unknown as Profile;
                setUser(currentUser);
              } else if (!isLoading) {
                if (isMounted) {
                  setCheckingOrg(false);
                  setCheckingSub(false);
                  router.push('/login');
                }
                return;
              }
            }

            if (!currentUser) return;

            const { data: refreshedProfile } = await supabase
              .from('profiles')
              .select('*, organization:organizations(id, name, status)')
              .eq('id', currentUser.id)
              .single();

            if (isMounted && refreshedProfile) {
              if (refreshedProfile.role !== currentUser.role) {
                setUser(refreshedProfile);
              }
              if (refreshedProfile.organization) {
                const org = refreshedProfile.organization as { id: string; name: string; status: string };
                setOrgStatus(org.status);
                setOrgName(org.name);

                // État de la licence, calculé par le serveur
                const session = await fetch('/api/auth/session')
                  .then((res) => (res.ok ? res.json() : null))
                  .catch(() => null);
                if (isMounted) {
                  setLicenceExpired(session?.user?.licence_expired === true);
                  setCheckingSub(false);
                }
              }
            }
          } catch (err) {
            console.warn('Could not refresh profile:', err);
          } finally {
            if (isMounted) {
              setCheckingOrg(false);
              setCheckingSub(false);
            }
          }
        }

    initUserAndProfile();

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
    };
    }, [user?.id, isLoading, router, setUser]);

  const isSubscriptionExpired = licenceExpired;

  // Abonnement expiré : forfaits que l'on peut demander (le forfait d'essai n'est proposé qu'une fois)
  useEffect(() => {
    if (!isSubscriptionExpired) return;
    Promise.all([
      fetch('/api/subscriptions/renew').then((res) => (res.ok ? res.json() : null)),
      supabase.from('subscription_plans').select('id, name, price, billing_period, trial_days').eq('status', 'active').order('price', { ascending: true }),
    ])
      .then(([state, plansRes]) => {
        if (state?.data?.pendingRequest) setRenewState('pending');
        const currentPlanId = state?.data?.subscription?.plan_id;
        const trialUsed = state?.data?.trialUsed === true;
        const plans = ((plansRes?.data || []) as { id: string; name: string; price: number; billing_period: string; trial_days: number | null }[])
          .filter((p) => !(trialUsed && Number(p.trial_days ?? 0) > 0))
          .map((p) => ({ id: p.id, name: p.name, price: Number(p.price), billing_period: p.billing_period, current: p.id === currentPlanId }));
        setRenewPlans(plans);
      })
      .catch(() => {});
  }, [isSubscriptionExpired, supabase]);

  const handleRenewRequest = async (planId: string) => {
    setRenewState('sending');
    setRenewError('');
    try {
      const res = await fetch('/api/subscriptions/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      // 409 = une demande est déjà en attente
      if (res.ok || res.status === 409) {
        setRenewState('pending');
      } else {
        const data = await res.json().catch(() => ({}));
        setRenewError(data.error || 'Impossible d’envoyer la demande.');
        setRenewState('idle');
      }
    } catch {
      setRenewState('idle');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    useAuthStore.getState().logout();
    router.push('/login');
  };

  // Attendre la vérification (organisation + licence) avant d'afficher l'espace :
  // sinon le tableau de bord apparaîtrait brièvement pour un compte expiré ou suspendu.
  if (isLoading || checkingOrg || checkingSub) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-sm text-slate-500 font-medium">Chargement du tableau de bord...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Pending approval screen
  if (orgStatus === 'pending_approval') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 text-center">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Compte en attente de validation</h1>
            <p className="text-xs text-slate-500 mt-2">
              Votre entreprise <strong className="text-slate-800 dark:text-slate-200">{orgName || 'enregistrée'}</strong> est en attente d&apos;approbation par l&apos;administrateur de la plateforme.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Vous aurez accès à vos outils dès que votre compte sera activé.
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition"
            >
              Vérifier le statut
            </button>
            <button
              onClick={handleSignOut}
              className="w-full py-2.5 px-4 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-semibold text-xs transition"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Suspended screen
  if (orgStatus === 'suspended' || orgStatus === 'cancelled' || orgStatus === 'archived') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 text-center">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-red-200 dark:border-red-900/40 p-8 space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-red-600 dark:text-red-400">
              {orgStatus === 'suspended' ? 'Espace désactivé' : 'Inscription refusée'}
            </h1>
            <p className="text-xs text-slate-500 mt-2">
              {orgStatus === 'suspended' ? (
                <>L&apos;accès pour l&apos;organisation <strong className="text-slate-800 dark:text-slate-200">{orgName}</strong> a été désactivé.</>
              ) : (
                <>L&apos;inscription de l&apos;organisation <strong className="text-slate-800 dark:text-slate-200">{orgName}</strong> n&apos;a pas été validée.</>
              )}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Veuillez contacter le support pour réactiver votre compte.
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs transition"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  // Expired subscription screen
  if (isSubscriptionExpired) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 text-center">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-red-200 dark:border-red-900/40 p-8 space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-red-600 dark:text-red-400">Abonnement expiré</h1>
            <p className="text-xs text-slate-500 mt-2">
              Votre abonnement a expiré. Vous n&apos;avez plus accès à votre espace.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {renewState === 'pending'
                ? 'Votre demande de renouvellement est en attente de validation. Votre accès sera rétabli dès son activation.'
                : 'Choisissez un forfait : votre accès sera rétabli dès validation par l\'équipe OptiWifi.'}
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            {renewState !== 'pending' && renewPlans.map((plan) => (
              <Button
                key={plan.id}
                onClick={() => handleRenewRequest(plan.id)}
                isLoading={renewState === 'sending'}
                className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-500 text-slate-950 font-bold rounded-xl text-xs transition"
              >
                {plan.current ? 'Renouveler' : 'Choisir'} « {plan.name} » — {new Intl.NumberFormat('fr-FR').format(plan.price)} FCFA
              </Button>
            ))}
            {renewError && <p className="text-xs text-red-600">{renewError}</p>}
            <button
              onClick={handleSignOut}
              className="w-full py-2.5 px-4 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-semibold text-xs transition"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      <Sidebar isMobileOpen={isMobileOpen} onCloseMobile={() => setIsMobileOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onOpenMobileMenu={() => setIsMobileOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 md:p-8 pb-28 sm:pb-32 lg:pb-8 overflow-y-auto">
          {children}
        </main>

        <BottomNav onOpenMobileMenu={() => setIsMobileOpen(true)} />
      </div>
    </div>
  );
}
