/**
 * Origine du site pour l'URL de retour SasPay. En production : l'adresse officielle (jamais
 * l'en-tête Host, falsifiable). Ailleurs (local, Preview) : l'origine de la requête.
 */
export function siteOrigin(request: Request): string {
  if (process.env.VERCEL_ENV === 'production') {
    return (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.optiwifi.site').replace(/\/$/, '');
  }
  return new URL(request.url).origin;
}
