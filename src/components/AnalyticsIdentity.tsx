'use client';

import { useEffect, useRef } from 'react';
import posthog from 'posthog-js';
import { useAuthStore } from '@/lib/stores/authStore';

/**
 * Relie les événements PostHog à l'utilisateur connecté (identifiant interne,
 * rôle et organisation uniquement : ni nom, ni e-mail) et oublie l'identité
 * à la déconnexion. Les comptes de test (.test, example.com…) sont marqués.
 */
export function AnalyticsIdentity() {
  const user = useAuthStore((s) => s.user);
  const identified = useRef<string | null>(null);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    if (user?.id) {
      if (identified.current === user.id) return;
      const domain = (user.email || '').split('@')[1] || '';
      posthog.identify(user.id, {
        role: user.role,
        organization_id: user.organization_id ?? null,
        is_test_account: /(\.test|\.example|\.invalid|\.localhost)$/i.test(domain) || /^example\.(com|org|net)$/i.test(domain),
      });
      identified.current = user.id;
    } else if (identified.current) {
      posthog.reset();
      identified.current = null;
    }
  }, [user]);

  return null;
}
