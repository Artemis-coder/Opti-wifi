'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { PlatformUser } from '@/types/platform';
import { usePlatformAuthStore } from '@/lib/stores/platformAuthStore';
import { createClient } from '@/lib/supabase/client';
import { PlatformSidebar } from '@/components/platform/PlatformSidebar';
import { PlatformHeader } from '@/components/platform/PlatformHeader';
import { Loader2 } from 'lucide-react';

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/platform/login';

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const router = useRouter();
  const { platformUser, isLoading, setPlatformUser, logout } = usePlatformAuthStore();
  const supabase = createClient();

  useEffect(() => {
    if (!platformUser && !isLoading && !isLoginPage) {
      router.push('/platform/login');
    }
  }, [platformUser, isLoading, router, isLoginPage]);

  useEffect(() => {
    async function checkSession() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: pu } = await supabase
          .from('platform_users')
          .select('*')
          .eq('auth_user_id', user.id)
          .eq('is_active', true)
          .single();

        if (pu) {
          setPlatformUser(pu as unknown as PlatformUser);
        } else if (!isLoginPage) {
          logout();
          router.push('/platform/login');
        }
      } else if (!isLoginPage) {
        logout();
        router.push('/platform/login');
      }
    }

    if (!platformUser && !isLoading && !isLoginPage) {
      checkSession();
    }
  }, [platformUser, isLoading, supabase, setPlatformUser, logout, router, isLoginPage]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (isLoading || !platformUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
          <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
          <span>Vérification de l&apos;accès Super Admin...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      <PlatformSidebar isMobileOpen={isMobileOpen} onCloseMobile={() => setIsMobileOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <PlatformHeader onOpenMobileMenu={() => setIsMobileOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 md:p-8 pb-24 lg:pb-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
