/**
 * Deux statuts distincts pour chaque client du back-office :
 * - statut du client : l'état de son compte (validé, suspendu, refusé…), fixé par le super admin ;
 * - statut de l'offre : l'état de sa licence la plus récente, calculé à partir des dates
 *   (le statut enregistré de l'abonnement n'est pas mis à jour à l'échéance, et le client
 *   garde l'accès à son espace même quand son offre a expiré).
 * Les expressions SQL supposent les alias `o` (organizations) et `s` (dernier abonnement).
 */

export type ClientStatus = 'active' | 'pending' | 'suspended' | 'refused' | 'deleted';
export type OfferStatus = 'active' | 'trial' | 'expiring' | 'expired' | 'unpaid' | 'suspended' | 'cancelled' | 'none';

export const CLIENT_STATUSES: ClientStatus[] = ['active', 'pending', 'suspended', 'refused', 'deleted'];
export const OFFER_STATUSES: OfferStatus[] = ['active', 'trial', 'expiring', 'expired', 'unpaid', 'suspended', 'cancelled', 'none'];

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  active: 'Actif',
  pending: 'En attente',
  suspended: 'Suspendu',
  refused: 'Refusé',
  deleted: 'Supprimé',
};

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  active: 'Active',
  trial: 'Essai',
  expiring: 'Expire bientôt',
  expired: 'Expirée',
  unpaid: 'Impayée',
  suspended: 'Suspendue',
  cancelled: 'Annulée',
  none: 'Aucune offre',
};

/** Nombre de jours avant l'échéance où l'offre passe en « Expire bientôt ». */
export const EXPIRING_DAYS = 7;

export const CLIENT_STATUS_SQL = `(CASE o.status::text
  WHEN 'pending_approval' THEN 'pending'
  WHEN 'suspended' THEN 'suspended'
  WHEN 'cancelled' THEN 'refused'
  WHEN 'archived' THEN 'deleted'
  ELSE 'active' END)`;

/** Fin de l'offre : fin d'essai pour un essai, sinon date de fin de licence. */
export const OFFER_END_SQL = `(CASE WHEN s.status::text = 'trialing' THEN COALESCE(s.trial_end, s.end_date) ELSE s.end_date END)`;

export const OFFER_STATUS_SQL = `(CASE
  WHEN s.status IS NULL THEN 'none'
  WHEN s.status::text = 'suspended' THEN 'suspended'
  WHEN s.status::text = 'cancelled' THEN 'cancelled'
  WHEN s.status::text = 'expired' THEN 'expired'
  WHEN ${OFFER_END_SQL} IS NOT NULL AND ${OFFER_END_SQL} < now() THEN 'expired'
  WHEN s.status::text = 'trialing' THEN 'trial'
  WHEN s.status::text = 'unpaid' THEN 'unpaid'
  WHEN ${OFFER_END_SQL} IS NOT NULL AND ${OFFER_END_SQL} < now() + interval '${EXPIRING_DAYS} days' THEN 'expiring'
  ELSE 'active' END)`;

/** Dernier abonnement du client (date de fin la plus lointaine), alias `s`. */
export const LATEST_SUBSCRIPTION_JOIN = `LEFT JOIN LATERAL (
  SELECT status, end_date, trial_end, plan_id FROM subscriptions
   WHERE organization_id = o.id
   ORDER BY end_date DESC NULLS LAST, created_at DESC
   LIMIT 1
) s ON true`;
