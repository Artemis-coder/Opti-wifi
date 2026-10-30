import posthog from 'posthog-js';
import { analyticsEnvironment } from '@/lib/analytics/events';

// PostHog côté navigateur : pages vues, clics, identification (src/components/AnalyticsIdentity.tsx).
// Désactivé sans NEXT_PUBLIC_POSTHOG_KEY. Les envois passent par /ingest (next.config.ts)
// pour ne pas être bloqués par les bloqueurs de publicité.
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (key) {
  try {
    posthog.init(key, {
      api_host: '/ingest',
      ui_host: process.env.NEXT_PUBLIC_POSTHOG_UI_HOST || 'https://us.posthog.com',
      defaults: '2026-08-30',
      person_profiles: 'identified_only',
      // Les écrans contiennent des montants et des données clients : rien n'est enregistré en clair
      session_recording: { maskAllInputs: true, maskTextSelector: '*' },
    });
    posthog.register({ app: 'outil', environment: analyticsEnvironment() });
  } catch (err) {
    console.error('PostHog init error:', err);
  }
}
