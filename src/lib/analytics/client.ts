'use client';

import posthog from 'posthog-js';
import type { AnalyticsEvent } from '@/lib/analytics/events';

/** Événement envoyé depuis le navigateur (sans effet si PostHog n'est pas configuré). */
export function trackClient(event: AnalyticsEvent, properties: Record<string, string | number | boolean | null | undefined> = {}) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  try {
    posthog.capture(event, { ...properties, source: 'client' });
  } catch {
    // le suivi ne doit jamais casser l'interface
  }
}
