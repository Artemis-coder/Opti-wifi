// ============================================================
// OPTIWIFI - Essai gratuit : seulement à la première souscription d'un client.
// Un forfait peut prévoir des jours d'essai (trial_days > 0) : ils ne sont offerts qu'à une
// organisation qui n'a encore jamais eu d'abonnement. Ensuite, tout forfait (Découverte
// compris) est une licence payée, en mois, facturée.
// Un abonnement d'essai se reconnaît à son statut « trialing ».
// ============================================================
import { query } from '@/lib/neon/db';

/** Vrai si le forfait prévoit des jours d'essai pour une première souscription. */
export function isTrialPlan(plan: { trial_days?: number | string | null } | null | undefined): boolean {
  return Number(plan?.trial_days ?? 0) > 0;
}

/**
 * Vrai si l'organisation n'a plus droit à l'essai : elle a déjà eu un abonnement
 * (essai ou licence payée, en cours ou terminé).
 */
export async function hasUsedTrialPlan(organizationId: string): Promise<boolean> {
  const { rows } = await query(`SELECT EXISTS (SELECT 1 FROM subscriptions WHERE organization_id = $1) AS used`, [
    organizationId,
  ]);
  return rows[0]?.used === true;
}
