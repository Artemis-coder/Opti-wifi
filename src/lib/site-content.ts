import { query } from '@/lib/neon/db';
import { planFeatureList } from '@/lib/plan-features';
import { SITE_DEFAULTS, isSiteContentKey, parseSiteContent, type SiteContent, type SiteContentKey } from '@/lib/site-content-schema';

export * from '@/lib/site-content-schema';

// ---------------------------------------------------------------- lecture

/** Contenu complet : base de données, complétée par les valeurs par défaut. */
export async function loadSiteContent(): Promise<{ content: SiteContent; updatedAt: string | null }> {
  const { rows } = await query(`SELECT key, value, updated_at FROM site_content`);
  const content: SiteContent = structuredClone(SITE_DEFAULTS);
  let updatedAt: string | null = null;
  for (const row of rows as { key: string; value: unknown; updated_at: string }[]) {
    if (!isSiteContentKey(row.key)) continue;
    // Une ligne devenue invalide (schéma modifié) n'empêche pas le site de s'afficher
    const parsed = parseSiteContent(row.key, { ...(SITE_DEFAULTS[row.key] as object), ...(row.value as object) });
    if (parsed.ok) (content as Record<SiteContentKey, unknown>)[row.key] = parsed.value;
    if (!updatedAt || row.updated_at > updatedAt) updatedAt = row.updated_at;
  }
  return { content, updatedAt };
}

export type PublicPlan = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  billing_period: string;
  trial_days: number | null;
  max_users: number | null;
  max_points_of_sale: number | null;
  max_collectors: number | null;
  max_tickets_per_month: number | null;
  /** Fonctionnalités saisies dans Forfaits (une par ligne) */
  features: string[];
};

/** Forfaits actifs, tels que gérés dans Forfaits (aucune donnée client). */
export async function loadPublicPlans(): Promise<PublicPlan[]> {
  const { rows } = await query(
    `SELECT id, name, description, price, currency, billing_period, trial_days,
            max_users, max_points_of_sale, max_collectors, max_tickets_per_month, features
       FROM subscription_plans
      WHERE status = 'active'
      ORDER BY price ASC, name ASC`
  );
  return (rows as (Omit<PublicPlan, 'price' | 'features'> & { price: string | number; features: unknown })[]).map((p) => ({
    ...p,
    price: Number(p.price),
    features: planFeatureList(p.features),
  }));
}
