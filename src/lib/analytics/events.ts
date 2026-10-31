/**
 * Plan de suivi PostHog d'OptiSpace (outil + site vitrine).
 * Noms d'événements partagés par le serveur et le navigateur : ne pas les renommer,
 * les tableaux de bord PostHog (scripts/posthog-dashboards.mjs) s'appuient dessus.
 *
 * Aucune donnée personnelle n'est envoyée : identifiant interne, rôle et
 * organisation uniquement (jamais de nom, d'e-mail ni de téléphone).
 */
export const EVENTS = {
  // Acquisition (outil)
  organizationRegistered: 'organization_registered',
  organizationStatusChanged: 'organization_status_changed',
  // Activation / usage
  userLoggedIn: 'user_logged_in',
  collectionRecorded: 'collection_recorded',
  ticketsAllocated: 'tickets_allocated',
  ticketsExchanged: 'tickets_exchanged',
  posCreated: 'pos_created',
  reportExported: 'report_exported',
  // Licences et revenus
  licenseRequested: 'license_requested',
  licenseRequestRejected: 'license_request_rejected',
  licenseActivated: 'license_activated',
} as const;

export type AnalyticsEvent = (typeof EVENTS)[keyof typeof EVENTS];

/** Environnement d'exécution, ajouté à chaque événement (les tableaux de bord filtrent sur « production »). */
export function analyticsEnvironment(): 'production' | 'preview' | 'development' {
  const env = process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV;
  if (env === 'production') return 'production';
  if (env === 'preview') return 'preview';
  return 'development';
}
