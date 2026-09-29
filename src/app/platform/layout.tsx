'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { usePlatformAuthStore } from '@/lib/stores/platformAuthStore';
import { createClient } from '@/lib/supabase/client';
import { PlatformSidebar } from '@/components/platform/PlatformSidebar';
import { PlatformHeader } from '@/components/platform/PlatformHeader';
import { PlatformBottomNav } from '@/components/platform/PlatformBottomNav';
import { Loader2 } from 'lucide-react';

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/platform/login';

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const router = useRouter();
  const { platformUser, isLoading, checkSession } = usePlatformAuthStore();
  const supabase = createClient();

  useEffect(() => {
    if (!platformUser && !isLoginPage) {
      checkSession(supabase as never);
    }
  }, [platformUser, isLoginPage, checkSession, supabase]);

  useEffect(() => {
    if (!platformUser && !isLoading && !isLoginPage) {
      router.push('/platform/login');
    }
  }, [platformUser, isLoading, router, isLoginPage]);

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
    <div className="app-viewport flex bg-slate-50 dark:bg-slate-950">
      <PlatformSidebar isMobileOpen={isMobileOpen} onCloseMobile={() => setIsMobileOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <PlatformHeader onOpenMobileMenu={() => setIsMobileOpen(true)} />

        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain p-3 sm:p-6 md:p-8 pb-8 lg:pb-8">
          {children}
        </main>

        <PlatformBottomNav />
      </div>
    </div>
  );
}
