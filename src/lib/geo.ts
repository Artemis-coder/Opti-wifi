// ============================================================
// OPTIWIFI - Pays des organisations (KPI « Top 3 des pays »)
// Source principale : pays de la connexion fourni par Vercel (x-vercel-ip-country),
// enregistré à l'inscription puis complété à la connexion d'un membre.
// Secours : indicatif du numéro de téléphone de l'organisation.
// ============================================================
import { query } from '@/lib/neon/db';
import { countryFlag, countryFromPhone, countryName } from '@/lib/countries';

export { countryFlag, countryFromPhone, countryName };

/** Code pays ISO alpha-2 de la requête (Vercel), ou null (local, inconnu, Tor…). */
export function countryFromRequest(request: Request): string | null {
  const code = request.headers.get('x-vercel-ip-country')?.trim().toUpperCase();
  return code && /^[A-Z]{2}$/.test(code) && code !== 'XX' && code !== 'T1' ? code : null;
}

/** Enregistre le pays d'une organisation s'il n'est pas encore connu. N'échoue jamais. */
export async function rememberOrganizationCountry(organizationId: string | null | undefined, country: string | null) {
  if (!organizationId || !country) return;
  try {
    await query(`UPDATE organizations SET country = $2 WHERE id = $1 AND country IS NULL`, [organizationId, country]);
  } catch (err) {
    console.error('Organization country error:', err);
  }
}

export interface CountryStat {
  code: string;
  name: string;
  flag: string;
  clients: number;
  share: number;
}

/**
 * Pays des clients en service (hors inscriptions en attente, refusées ou supprimées),
 * du plus représenté au moins représenté, et nombre de clients dont le pays est inconnu.
 */
export async function getClientCountries(): Promise<{ top: CountryStat[]; known: number; unknown: number }> {
  const { rows } = await query(
    `SELECT country, phone FROM organizations WHERE status NOT IN ('pending_approval', 'cancelled', 'archived')`
  );
  const counts = new Map<string, number>();
  let unknown = 0;
  for (const r of rows) {
    const code = (r.country as string | null)?.trim() || countryFromPhone(r.phone);
    if (code) counts.set(code, (counts.get(code) || 0) + 1);
    else unknown++;
  }
  const known = rows.length - unknown;
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([code, clients]) => ({
      code,
      name: countryName(code),
      flag: countryFlag(code),
      clients,
      share: known ? Math.round((clients / known) * 100) : 0,
    }));
  return { top, known, unknown };
}
