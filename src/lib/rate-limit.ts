// ============================================================
// OPTIWIFI - Limitation du nombre de requêtes (anti force brute, anti spam d'e-mails).
// Compteur en mémoire par instance : il freine un attaquant même sans service externe. Il ne
// remplace pas une règle de pare-feu (Vercel Firewall), qui compte sur toutes les instances.
// Le verrouillage du compte après trop d'échecs (lib/neon/auth.ts) est, lui, en base.
// ============================================================

const buckets = new Map<string, number[]>();
let lastSweep = Date.now();

/** Adresse IP du client (première adresse transmise par le proxy). */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return (forwarded?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown').trim();
}

/**
 * Enregistre une tentative pour `key` et dit si elle dépasse `limit` sur la fenêtre `windowMs`.
 * Renvoie le nombre de secondes à attendre (0 = autorisé).
 */
export function rateLimit(key: string, limit: number, windowMs: number): number {
  const now = Date.now();
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, hits] of buckets) if (!hits.some((t) => now - t < windowMs)) buckets.delete(k);
  }
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return Math.ceil((hits[0] + windowMs - now) / 1000);
  }
  hits.push(now);
  buckets.set(key, hits);
  return 0;
}

/** Réponse 429 standard. */
export function tooManyRequests(retryAfterSeconds: number): Response {
  return new Response(
    JSON.stringify({ error: 'Trop de tentatives. Réessayez dans quelques minutes.' }),
    { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfterSeconds) } },
  );
}
