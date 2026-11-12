// ============================================================
// Adresse interne d'un compte « point de vente » créé sans e-mail : il se connecte avec son
// numéro de téléphone ; cette adresse ne reçoit jamais de message et n'est jamais affichée.
// Module sans dépendance serveur : utilisable côté navigateur.
// ============================================================

const INTERNAL_DOMAIN = 'acces.optiwifi.site';

export function internalPosAccountEmail(posId: string): string {
  return `pos-${posId.slice(0, 8)}-${Date.now().toString(36)}@${INTERNAL_DOMAIN}`;
}

export function isInternalPosAccountEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${INTERNAL_DOMAIN}`);
}
