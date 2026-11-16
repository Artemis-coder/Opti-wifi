'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PlatformUser } from '@/types/platform';
import { usePlatformAuthStore } from '@/lib/stores/platformAuthStore';
import { createClient } from '@/lib/supabase/client';
import { PlatformSidebar } from '@/components/platform/PlatformSidebar';
import { PlatformHeader } from '@/components/platform/PlatformHeader';
import { PlatformBottomNav } from '@/components/platform/PlatformBottomNav';
import { PLATFORM_BOTTOM_NAV } from '@/components/platform/PlatformSidebar';
import { Spinner } from '@heroui/react';
import { PushPrompt } from '@/components/notifications/PushPrompt';
import { AmountsPrivacyBoundary } from '@/components/privacy/AmountsPrivacy';

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const router = useRouter();
  const { platformUser, isLoading, setPlatformUser, logout } = usePlatformAuthStore();
  const supabase = createClient();

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
        } else {
          logout();
          router.push('/dashboard');
        }
      } else {
        logout();
        router.push('/login');
      }
    }

    if (!platformUser && !isLoading) {
      checkSession();
    }
  }, [platformUser, isLoading, supabase, setPlatformUser, logout, router]);

  if (isLoading || !platformUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-sm text-muted">
          <Spinner size="sm" />
          <span>Vérification de l&apos;accès super admin…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <PlatformSidebar isMobileOpen={isMobileOpen} onCloseMobile={() => setIsMobileOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <PlatformHeader />

        <main className="flex-1 overflow-y-auto p-4 pb-24 sm:p-6 sm:pb-24 lg:pb-6">
          <AmountsPrivacyBoundary>{children}</AmountsPrivacyBoundary>
        </main>
      </div>

      <PlatformBottomNav items={PLATFORM_BOTTOM_NAV} onOpenMobileMenu={() => setIsMobileOpen(true)} />
      <PushPrompt userId={platformUser.auth_user_id} audience="platform" />
    </div>
  );
}
