// ============================================================
// OPTIWIFI - Aucun compte de test en production.
// Les domaines réservés aux tests par les RFC 2606 / 6761 ne peuvent pas
// correspondre à une vraie adresse : ils sont refusés en production
// (inscription, création par le super admin, ajout d'un membre).
// Les tests se font sur dev.optiwifi.site / en local, avec la base dev.
// ============================================================

const RESERVED_DOMAINS = ['example.com', 'example.org', 'example.net'];
const RESERVED_TLDS = ['.test', '.example', '.invalid', '.localhost'];

export function isTestEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@')[1] || '';
  return RESERVED_DOMAINS.includes(domain) || RESERVED_TLDS.some((tld) => domain.endsWith(tld));
}

/** Message d'erreur si l'adresse est une adresse de test et que l'on est en production, sinon null. */
export function rejectTestEmailInProduction(email: string): string | null {
  if (process.env.VERCEL_ENV !== 'production') return null;
  return isTestEmail(email)
    ? 'Les adresses email de test ne sont pas autorisées en production.'
    : null;
}
