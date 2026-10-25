// ============================================================
// OPTIWIFI - Forfait d'essai (Découverte) : une seule fois par organisation.
// Un forfait d'essai est un forfait avec des jours d'essai (trial_days > 0).
// Une organisation qui en a déjà bénéficié (actif, expiré ou remplacé) ne peut
// ni le redemander ni le renouveler : elle doit choisir un forfait payant.
// ============================================================
import { query } from '@/lib/neon/db';

export const TRIAL_ALREADY_USED_MESSAGE =
  'Le forfait Découverte ne peut être utilisé qu’une seule fois. Choisissez un autre forfait pour continuer.';

export function isTrialPlan(plan: { trial_days?: number | string | null } | null | undefined): boolean {
  return Number(plan?.trial_days ?? 0) > 0;
}

/** Vrai si l'organisation a déjà eu un abonnement sur un forfait d'essai. */
export async function hasUsedTrialPlan(organizationId: string): Promise<boolean> {
  const { rows } = await query(
    `SELECT EXISTS (
       SELECT 1 FROM subscriptions s JOIN subscription_plans p ON p.id = s.plan_id
        WHERE s.organization_id = $1 AND COALESCE(p.trial_days, 0) > 0
     ) AS used`,
    [organizationId]
  );
  return rows[0]?.used === true;
}
