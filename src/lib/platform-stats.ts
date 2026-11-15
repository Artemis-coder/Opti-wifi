import { query } from '@/lib/neon/db';

/**
 * Statistiques du back-office (super admin).
 *
 * Une seule source par indicateur, la même que les autres pages du back-office :
 * - Revenus encaissés = paiements réussis (table payments : paiement en ligne SasPay ET paiement
 *   manuel validé), comme « Total encaissé » de Transactions ;
 * - Licences vendues = factures payées (une facture par licence payée), comme la page Factures ;
 *   les licences activées sans paiement (essais, licences antérieures à la facturation) n'en sont pas ;
 * - Inscriptions = comptes clients (organisations) créés.
 * Chaque indicateur donne le total depuis le début (`alltime`) et le chiffre de la période.
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
  /** Depuis le début, toutes périodes confondues */
  alltime: { registrations: number; paid_licenses: number; trials: number; revenue: number };
  previous: { registrations: number; paid_licenses: number; trials: number; revenue: number };
  mrr: number;
  active_licenses: number;
  plan_breakdown: { plan_id: string; name: string; count: number; mrr: number; is_trial: boolean }[];
}

// Licences avec leur type (essai / nouvelle / renouvellement / changement).
// Types déduits de la licence payante précédente de la même organisation.
// Les revenus, eux, viennent des factures payées (INVOICES_CTE) : montants réellement encaissés.
const LICENSES_CTE = `
  lic AS (
    SELECT s.id, s.organization_id, s.plan_id, s.created_at, s.start_date, s.end_date, s.status,
           p.price, p.trial_days,
           CASE p.billing_period WHEN 'quarterly' THEN 3 WHEN 'semiannual' THEN 6 WHEN 'annual' THEN 12 ELSE 1 END AS period_months,
           GREATEST(1, ROUND(EXTRACT(EPOCH FROM (s.end_date - s.start_date)) / (30.4375 * 86400)))::int AS months,
           -- Essai gratuit (première souscription) : abonnement avec date de fin d'essai
           (p.price <= 0 OR s.trial_end IS NOT NULL) AS is_trial
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

// Revenus : paiements réussis (en ligne et manuels), datés au paiement.
// Licences vendues : factures payées (une par licence payée), datées au paiement.
const INVOICES_CTE = `
  paid_invoices AS (
    SELECT COALESCE(p.paid_at, p.created_at) AS paid_at, p.amount
      FROM payments p
     WHERE p.status = 'successful'
  ),
  sold AS (
    SELECT COALESCE(i.paid_at, i.issued_at) AS sold_at
      FROM invoices i
     WHERE i.status = 'paid'
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
    ${INVOICES_CTE},
    inv AS (
      SELECT date_trunc($1, paid_at) AS bucket, COALESCE(SUM(amount), 0)::float AS revenue
        FROM paid_invoices, bounds
       WHERE paid_at >= bounds.start_at AND paid_at < bounds.end_at
       GROUP BY 1
    ),
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
             COUNT(*) FILTER (WHERE kind = 'upgrade')::int AS upgrade
        FROM typed, bounds
       WHERE created_at >= bounds.start_at AND created_at < bounds.end_at
       GROUP BY 1
    )
    SELECT b.bucket,
           COALESCE(reg.n, 0) AS registrations,
           COALESCE(sub.trial, 0) AS trial, COALESCE(sub.new, 0) AS new,
           COALESCE(sub.renewal, 0) AS renewal, COALESCE(sub.upgrade, 0) AS upgrade,
           COALESCE(inv.revenue, 0) AS revenue
      FROM buckets b
      LEFT JOIN reg ON reg.bucket = b.bucket
      LEFT JOIN sub ON sub.bucket = b.bucket
      LEFT JOIN inv ON inv.bucket = b.bucket
     ORDER BY b.bucket`;

  // Période précédente de même longueur, pour la comparaison
  const previousSql = `
    WITH bounds AS (
      SELECT date_trunc($1, NOW()) - (2 * $2::int - 1) * $3::interval AS start_at,
             date_trunc($1, NOW()) - ($2::int - 1) * $3::interval AS end_at
    ),
    ${LICENSES_CTE},
    ${INVOICES_CTE}
    SELECT
      (SELECT COUNT(*) FROM organizations, bounds WHERE created_at >= start_at AND created_at < end_at)::int AS registrations,
      (SELECT COUNT(*) FROM sold, bounds WHERE sold_at >= start_at AND sold_at < end_at)::int AS paid_licenses,
      (SELECT COUNT(*) FROM typed, bounds WHERE kind = 'trial' AND created_at >= start_at AND created_at < end_at)::int AS trials,
      (SELECT COALESCE(SUM(amount), 0) FROM paid_invoices, bounds WHERE paid_at >= start_at AND paid_at < end_at)::float AS revenue`;

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
           BOOL_AND(c.is_trial) AS is_trial
      FROM current c
      JOIN subscription_plans p ON p.id = c.plan_id
     GROUP BY p.id, p.name, p.price
     ORDER BY count DESC, p.price DESC`;

  // Licences vendues sur la période en cours + totaux depuis le début
  const totalsSql = `
    WITH bounds AS (
      SELECT date_trunc($1, NOW()) - ($2::int - 1) * $3::interval AS start_at
    ),
    ${LICENSES_CTE},
    ${INVOICES_CTE}
    SELECT
      (SELECT COUNT(*) FROM sold, bounds WHERE sold_at >= start_at)::int AS period_sold,
      (SELECT COUNT(*) FROM organizations)::int AS registrations,
      (SELECT COUNT(*) FROM sold)::int AS paid_licenses,
      (SELECT COUNT(*) FROM lic WHERE is_trial)::int AS trials,
      (SELECT COALESCE(SUM(amount), 0) FROM paid_invoices)::float AS revenue`;

  const params = [unit, count, step];
  const [seriesRes, prevRes, activeRes, currencyRes, totalsRes] = await Promise.all([
    query(seriesSql, params),
    query(previousSql, params),
    query(activeSql),
    query(`SELECT value FROM platform_settings WHERE key = 'platform_currency'`),
    query(totalsSql, params),
  ]);
  const all = totalsRes.rows[0] || {};

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
      paid_licenses: Number(all.period_sold || 0),
      trials: sum('trial'),
      revenue: sum('revenue'),
    },
    alltime: {
      registrations: Number(all.registrations || 0),
      paid_licenses: Number(all.paid_licenses || 0),
      trials: Number(all.trials || 0),
      revenue: Number(all.revenue || 0),
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
