'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/types/database';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const router = useRouter();
  const { user, isLoading, setUser } = useAuthStore();
  const supabase = createClient();

  const [orgStatus, setOrgStatus] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [checkingOrg, setCheckingOrg] = useState(true);

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
          }
        }
      } catch (err) {
        console.warn('Could not refresh profile:', err);
      } finally {
        if (isMounted) {
          setCheckingOrg(false);
        }
      }
    }

    initUserAndProfile();

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
    };
  }, [user?.id, isLoading, router, setUser]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    useAuthStore.getState().logout();
    router.push('/login');
  };

  if ((isLoading && !user) || (checkingOrg && !user)) {
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
  if (orgStatus === 'suspended') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 text-center">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-red-200 dark:border-red-900/40 p-8 space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-red-600 dark:text-red-400">Compte Suspendu</h1>
            <p className="text-xs text-slate-500 mt-2">
              L&apos;accès pour l&apos;organisation <strong className="text-slate-800 dark:text-slate-200">{orgName}</strong> a été temporairement suspendu.
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

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      <Sidebar isMobileOpen={isMobileOpen} onCloseMobile={() => setIsMobileOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onOpenMobileMenu={() => setIsMobileOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 md:p-8 pb-24 lg:pb-8 overflow-y-auto">
          {children}
        </main>

        <BottomNav onOpenMobileMenu={() => setIsMobileOpen(true)} />
      </div>
    </div>
  );
}
