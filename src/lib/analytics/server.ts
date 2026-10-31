import { after } from 'next/server';
import { PostHog } from 'posthog-node';
import { analyticsEnvironment, type AnalyticsEvent } from '@/lib/analytics/events';

/**
 * Événements PostHog envoyés par le serveur (encaissements, licences…) :
 * fiables même si le navigateur bloque les traceurs.
 * Sans NEXT_PUBLIC_POSTHOG_KEY, rien n'est envoyé.
 */

let client: PostHog | null | undefined;

function getClient(): PostHog | null {
  if (client !== undefined) return client;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  client = key
    ? new PostHog(key, {
        host: process.env.POSTHOG_HOST || process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        flushAt: 1,
        flushInterval: 0,
      })
    : null;
  return client;
}

type Props = Record<string, string | number | boolean | null | undefined>;

/**
 * Enregistre un événement après l'envoi de la réponse (n'allonge jamais une requête,
 * n'échoue jamais : une panne de PostHog est seulement journalisée).
 */
export function trackServer(distinctId: string | null | undefined, event: AnalyticsEvent, properties: Props = {}): void {
  const ph = getClient();
  if (!ph || !distinctId) return;
  after(async () => {
    try {
      await ph.captureImmediate({
        distinctId,
        event,
        properties: { ...properties, app: 'outil', environment: analyticsEnvironment(), source: 'server' },
      });
    } catch (err) {
      console.error('PostHog capture error:', err instanceof Error ? err.message : err);
    }
  });
}
