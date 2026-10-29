import { query } from '@/lib/neon/db';

/**
 * Statistiques du back-office (super admin).
 *
 * Revenus : il n'y a pas de table de paiements alimentée (le client paie hors application,
 * le super admin active la licence). Le revenu d'une licence = prix du forfait × nombre de
 * périodes couvertes (durée de la licence / durée de la période du forfait), essai exclu.
 * Le prix utilisé est le prix ACTUEL du forfait (l'historique des prix n'est pas conservé).
 */

export type StatsRange = '7d' | '30d' | '90d' | '6m' | '1y';

const RANGES: Record<StatsRange, { unit: 'day' | 'week' | 'month'; count: number }> = {
  '7d': { unit: 'day', count: 7 },
  '30d': { unit: 'day', count: 30 },
  '90d': { unit: 'week', count: 13 },
  '6m': { unit: 'month', count: 6 },
  '1y': { unit: 'month', count: 12 },
};

export function parseStatsRange(value: string | null): StatsRange {
  return value && value in RANGES ? (value as StatsRange) : '30d';
}

export interface StatsBucket {
  bucket: string; // début de la tranche (ISO)
  registrations: number;
  trial: number;
  new: number;
  renewal: number;
  upgrade: number;
  revenue: number;
}

export interface PlatformStats {
  range: StatsRange;
  unit: 'day' | 'week' | 'month';
  currency: string;
  series: StatsBucket[];
  totals: { registrations: number; paid_licenses: number; trials: number; revenue: number };
  previous: { registrations: number; paid_licenses: number; trials: number; revenue: number };
  mrr: number;
  active_licenses: number;
  plan_breakdown: { plan_id: string; name: string; count: number; mrr: number; is_trial: boolean }[];
}

// Licences avec leur type (essai / nouvelle / renouvellement / changement) et leur revenu.
// Types déduits de la licence payante précédente de la même organisation.
const LICENSES_CTE = `
  lic AS (
    SELECT s.id, s.organization_id, s.plan_id, s.created_at, s.start_date, s.end_date, s.status,
           p.price, p.trial_days,
           CASE p.billing_period WHEN 'quarterly' THEN 3 WHEN 'semiannual' THEN 6 WHEN 'annual' THEN 12 ELSE 1 END AS period_months,
           GREATEST(1, ROUND(EXTRACT(EPOCH FROM (s.end_date - s.start_date)) / (30.4375 * 86400)))::int AS months,
           (p.price <= 0 OR COALESCE(p.trial_days, 0) > 0) AS is_trial
      FROM subscriptions s
      JOIN subscription_plans p ON p.id = s.plan_id
     WHERE s.start_date IS NOT NULL AND s.end_date IS NOT NULL
  ),
  paid AS (
    SELECT lic.*,
           LAG(plan_id) OVER (PARTITION BY organization_id ORDER BY created_at, id) AS prev_plan
      FROM lic WHERE NOT is_trial
  ),
  typed AS (
    SELECT id, created_at, 'trial' AS kind, 0::numeric AS revenue FROM lic WHERE is_trial
    UNION ALL
    SELECT id, created_at,
           CASE WHEN prev_plan IS NULL THEN 'new' WHEN prev_plan = plan_id THEN 'renewal' ELSE 'upgrade' END,
           ROUND(price * months / period_months)
      FROM paid
  )`;

export async function getPlatformStats(range: StatsRange): Promise<PlatformStats> {
  const { unit, count } = RANGES[range];
  const step = `1 ${unit}`;

  // $1 = unité de troncature, $2 = nombre de tranches, $3 = pas
  const seriesSql = `
    WITH bounds AS (
      SELECT date_trunc($1, NOW()) - ($2::int - 1) * $3::interval AS start_at,
             date_trunc($1, NOW()) + $3::interval AS end_at
    ),
    buckets AS (
      SELECT generate_series((SELECT start_at FROM bounds), date_trunc($1, NOW()), $3::interval) AS bucket
    ),
    ${LICENSES_CTE},
    reg AS (
      SELECT date_trunc($1, created_at) AS bucket, COUNT(*)::int AS n
        FROM organizations, bounds
       WHERE created_at >= bounds.start_at AND created_at < bounds.end_at
       GROUP BY 1
    ),
    sub AS (
      SELECT date_trunc($1, created_at) AS bucket,
             COUNT(*) FILTER (WHERE kind = 'trial')::int AS trial,
             COUNT(*) FILTER (WHERE kind = 'new')::int AS new,
             COUNT(*) FILTER (WHERE kind = 'renewal')::int AS renewal,
             COUNT(*) FILTER (WHERE kind = 'upgrade')::int AS upgrade,
             COALESCE(SUM(revenue), 0)::float AS revenue
        FROM typed, bounds
       WHERE created_at >= bounds.start_at AND created_at < bounds.end_at
       GROUP BY 1
    )
    SELECT b.bucket,
           COALESCE(reg.n, 0) AS registrations,
           COALESCE(sub.trial, 0) AS trial, COALESCE(sub.new, 0) AS new,
           COALESCE(sub.renewal, 0) AS renewal, COALESCE(sub.upgrade, 0) AS upgrade,
           COALESCE(sub.revenue, 0) AS revenue
      FROM buckets b
      LEFT JOIN reg ON reg.bucket = b.bucket
      LEFT JOIN sub ON sub.bucket = b.bucket
     ORDER BY b.bucket`;

  // Période précédente de même longueur, pour la comparaison
  const previousSql = `
    WITH bounds AS (
      SELECT date_trunc($1, NOW()) - (2 * $2::int - 1) * $3::interval AS start_at,
             date_trunc($1, NOW()) - ($2::int - 1) * $3::interval AS end_at
    ),
    ${LICENSES_CTE}
    SELECT
      (SELECT COUNT(*) FROM organizations, bounds WHERE created_at >= start_at AND created_at < end_at)::int AS registrations,
      (SELECT COUNT(*) FROM typed, bounds WHERE kind <> 'trial' AND created_at >= start_at AND created_at < end_at)::int AS paid_licenses,
      (SELECT COUNT(*) FROM typed, bounds WHERE kind = 'trial' AND created_at >= start_at AND created_at < end_at)::int AS trials,
      (SELECT COALESCE(SUM(revenue), 0) FROM typed, bounds WHERE created_at >= start_at AND created_at < end_at)::float AS revenue`;

  // Licences en cours (une par organisation : celle qui va le plus loin), hors clients fermés.
  // Une prolongation démarre à la fin de la licence précédente (start_date futur) : seule end_date compte.
  const activeSql = `
    WITH ${LICENSES_CTE},
    current AS (
      SELECT DISTINCT ON (lic.organization_id) lic.*
        FROM lic
        JOIN organizations o ON o.id = lic.organization_id
       WHERE lic.status IN ('active', 'trialing') AND lic.end_date > NOW()
         AND o.status NOT IN ('cancelled', 'archived', 'pending_approval')
       ORDER BY lic.organization_id, lic.end_date DESC
    )
    SELECT p.id AS plan_id, p.name, COUNT(c.id)::int AS count,
           COALESCE(SUM(CASE WHEN c.is_trial THEN 0 ELSE c.price / c.period_months END), 0)::float AS mrr,
           (p.price <= 0 OR COALESCE(p.trial_days, 0) > 0) AS is_trial
      FROM current c
      JOIN subscription_plans p ON p.id = c.plan_id
     GROUP BY p.id, p.name, p.price, p.trial_days
     ORDER BY count DESC, p.price DESC`;

  const params = [unit, count, step];
  const [seriesRes, prevRes, activeRes, currencyRes] = await Promise.all([
    query(seriesSql, params),
    query(previousSql, params),
    query(activeSql),
    query(`SELECT value FROM platform_settings WHERE key = 'platform_currency'`),
  ]);

  const series: StatsBucket[] = seriesRes.rows.map((r) => ({
    bucket: new Date(r.bucket).toISOString(),
    registrations: Number(r.registrations),
    trial: Number(r.trial),
    new: Number(r.new),
    renewal: Number(r.renewal),
    upgrade: Number(r.upgrade),
    revenue: Number(r.revenue),
  }));
  const sum = (k: keyof Omit<StatsBucket, 'bucket'>) => series.reduce((a, b) => a + b[k], 0);
  const breakdown = activeRes.rows.map((r) => ({
    plan_id: r.plan_id as string,
    name: r.name as string,
    count: Number(r.count),
    mrr: Math.round(Number(r.mrr)),
    is_trial: r.is_trial === true,
  }));
  const prev = prevRes.rows[0] || {};
  const rawCurrency = currencyRes.rows[0]?.value;

  return {
    range,
    unit,
    currency: typeof rawCurrency === 'string' ? rawCurrency : 'XOF',
    series,
    totals: {
      registrations: sum('registrations'),
      paid_licenses: sum('new') + sum('renewal') + sum('upgrade'),
      trials: sum('trial'),
      revenue: sum('revenue'),
    },
    previous: {
      registrations: Number(prev.registrations || 0),
      paid_licenses: Number(prev.paid_licenses || 0),
      trials: Number(prev.trials || 0),
      revenue: Number(prev.revenue || 0),
    },
    mrr: breakdown.reduce((a, b) => a + b.mrr, 0),
    active_licenses: breakdown.reduce((a, b) => a + b.count, 0),
    plan_breakdown: breakdown,
  };
}
