'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { createClient } from '@/lib/supabase/client';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const router = useRouter();
  const { user, isLoading, setUser, setIsLoading } = useAuthStore();
  const supabase = createClient();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) {
      const refreshProfile = async () => {
        try {
          const { data: refreshedProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (refreshedProfile && refreshedProfile.id === user.id) {
            if (refreshedProfile.role !== user.role) {
              setUser(refreshedProfile);
            }
          }
        } catch (err) {
          console.warn('Could not refresh profile:', err);
        }
      };
      refreshProfile();
    }
  }, [user, supabase, setUser]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-sm text-slate-500 font-medium">Chargement...</div>
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
