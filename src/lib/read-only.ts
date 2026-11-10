// ============================================================
// OPTIWIFI - Consultation seule (abonnement expiré).
// L'espace reste ouvert à l'administrateur et aux collecteurs pour consulter leurs données,
// mais rien ne peut plus être ajouté, modifié ni supprimé tant que l'abonnement n'est pas
// renouvelé. Le serveur refuse toute écriture (lib/tenant.ts) ; l'interface désactive les
// boutons d'action et l'explique.
// ============================================================

/** Message renvoyé à toute écriture refusée pour cause d'abonnement expiré. */
export const READ_ONLY_MESSAGE =
  'Abonnement expiré : votre espace est en consultation seule. Renouvelez votre abonnement pour ajouter ou modifier des données.';

/** Info-bulle des boutons désactivés. */
export const READ_ONLY_HINT = 'Abonnement expiré : consultation seule';

/** Pages de saisie inaccessibles en consultation seule. */
export const READ_ONLY_BLOCKED_PATHS = [/^\/collections\/new/, /^\/allocations\/new/, /^\/allocations\/exchange/];
