/**
 * Fonctionnalités incluses dans un forfait (colonne JSONB `subscription_plans.features`),
 * saisies dans Forfaits et affichées sur le site vitrine. Stockées sous la forme
 * { items: string[] } (un objet plutôt qu'un tableau, pour rester un JSON objet).
 */
export const MAX_PLAN_FEATURES = 12;
export const MAX_PLAN_FEATURE_LENGTH = 100;

/** Liste lisible, quelle que soit la forme stockée (objet { items }, tableau ou rien). */
export function planFeatureList(features: unknown): string[] {
  const raw = Array.isArray(features)
    ? features
    : features && typeof features === 'object' && Array.isArray((features as { items?: unknown }).items)
      ? (features as { items: unknown[] }).items
      : [];
  return raw
    .filter((f): f is string => typeof f === 'string')
    .map((f) => f.trim().slice(0, MAX_PLAN_FEATURE_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_PLAN_FEATURES);
}

/** Valeur à enregistrer : { items } ou null si la liste est vide. */
export function normalizePlanFeatures(features: unknown): { items: string[] } | null {
  const items = planFeatureList(features);
  return items.length ? { items } : null;
}
