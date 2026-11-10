// ============================================================
// OPTIWIFI - Historique des connexions (Paramètres > Sécurité)
// À chaque connexion réussie : appareil (type, navigateur, système), adresse IP et lieu
// approximatif. Le lieu vient des en-têtes de géolocalisation IP de Vercel (ville, région,
// pays, coordonnées) : aucune autorisation demandée, précision à la ville près.
// Conservé 180 jours. Table supabase/migrations/20261110_login_history.sql.
// ============================================================
import { query } from '@/lib/neon/db';
import { parseUserAgent } from '@/lib/user-agent';

export { parseUserAgent };

const RETENTION_DAYS = 180;

export interface RequestLocation {
  ip: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
}

const header = (request: Request, name: string) => {
  const v = request.headers.get(name)?.trim();
  if (!v) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
};

const coordinate = (v: string | null, max: number) => {
  const n = v === null ? NaN : Number(v);
  return Number.isFinite(n) && Math.abs(n) <= max ? n : null;
};

/** Adresse IP et lieu approximatif de la requête (en-têtes Vercel). */
export function requestLocation(request: Request): RequestLocation {
  const ip = (request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || '').trim() || null;
  const country = header(request, 'x-vercel-ip-country')?.toUpperCase() ?? null;
  return {
    ip: ip ? ip.slice(0, 64) : null,
    city: header(request, 'x-vercel-ip-city')?.slice(0, 120) ?? null,
    region: header(request, 'x-vercel-ip-country-region')?.slice(0, 120) ?? null,
    country: country && /^[A-Z]{2}$/.test(country) && !['XX', 'T1'].includes(country) ? country : null,
    latitude: coordinate(header(request, 'x-vercel-ip-latitude'), 90),
    longitude: coordinate(header(request, 'x-vercel-ip-longitude'), 180),
  };
}

/** Enregistre une connexion réussie. N'échoue jamais (la connexion ne doit pas en dépendre). */
export async function recordLogin(request: Request, userId: string, organizationId: string | null | undefined) {
  try {
    const ua = request.headers.get('user-agent');
    const device = parseUserAgent(ua);
    const loc = requestLocation(request);
    await query(
      `INSERT INTO login_history (user_id, organization_id, ip, user_agent, device_type, browser, os, city, region, country, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [userId, organizationId || null, loc.ip, ua?.slice(0, 500) ?? null, device.deviceType, device.browser, device.os,
        loc.city, loc.region, loc.country, loc.latitude, loc.longitude]
    );
    // Durée de conservation
    await query(`DELETE FROM login_history WHERE user_id = $1 AND created_at < NOW() - make_interval(days => $2)`, [userId, RETENTION_DAYS]);
  } catch (err) {
    console.error('Login history error:', err);
  }
}

export interface LoginEntry {
  id: string;
  at: string;
  ip: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
}

/** Dernières connexions d'un utilisateur, de la plus récente à la plus ancienne. */
export async function getLoginHistory(userId: string, limit = 30): Promise<LoginEntry[]> {
  const { rows } = await query(
    `SELECT id, created_at, ip, device_type, browser, os, city, region, country, latitude, longitude
       FROM login_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return rows.map((r) => ({
    id: r.id as string,
    at: new Date(r.created_at as string).toISOString(),
    ip: r.ip as string | null,
    deviceType: r.device_type as string | null,
    browser: r.browser as string | null,
    os: r.os as string | null,
    city: r.city as string | null,
    region: r.region as string | null,
    country: r.country as string | null,
    latitude: r.latitude === null ? null : Number(r.latitude),
    longitude: r.longitude === null ? null : Number(r.longitude),
  }));
}
