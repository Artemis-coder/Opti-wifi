import { query } from '@/lib/neon/db';

/**
 * « Mes commissions » d'un compte point de vente (consultation seule) : toutes les commissions
 * reçues lors des collectes faites chez lui (collectes annulées exclues), sur la période choisie,
 * avec les chiffres clés : total, moyenne, commission la plus élevée et « mois de bonheur »
 * (le mois où il a touché le plus de commissions).
 * Toujours limité au point de vente rattaché au compte, dans son organisation.
 */

export type CommissionPeriod = 'all' | 'month' | '3months' | 'year';

export const COMMISSION_PERIODS: CommissionPeriod[] = ['all', 'month', '3months', 'year'];

export function parseCommissionPeriod(value: string | null): CommissionPeriod {
  return COMMISSION_PERIODS.includes(value as CommissionPeriod) ? (value as CommissionPeriod) : 'all';
}

// Début de la période (fuseau Abidjan = UTC) ; aussi utilisé par le tableau de bord du point de vente
export const PERIOD_START: Record<CommissionPeriod, string> = {
  all: "'-infinity'::timestamptz",
  month: "date_trunc('month', NOW())",
  '3months': "date_trunc('month', NOW()) - interval '2 months'",
  year: "date_trunc('year', NOW())",
};

export interface PosAccountCommissions {
  period: CommissionPeriod;
  kpis: {
    total: number;
    count: number;
    average: number;
    highest: { amount: number; date: string; collection_id: string } | null;
    /** Mois où le total des commissions est le plus élevé (« mois de bonheur »). */
    best_month: { month: string; total: number; count: number } | null;
  };
  /** Total par mois, du plus récent au plus ancien. */
  months: { month: string; total: number; count: number }[];
  items: {
    collection_id: string;
    date: string;
    commission: number;
    collected: number;
    expected: number;
    collector: string | null;
  }[];
}

const EMPTY_KPIS = { total: 0, count: 0, average: 0, highest: null, best_month: null };

export async function getPosAccountCommissions(
  posId: string | null,
  organizationId: string,
  period: CommissionPeriod,
): Promise<PosAccountCommissions> {
  if (!posId) return { period, kpis: EMPTY_KPIS, months: [], items: [] };

  const when = 'COALESCE(c.date_collecte::timestamptz, c.created_at)';
  const scope = `c.pos_id = $1 AND COALESCE(c.organization_id, c.organisation_id) = $2
                 AND c.statut <> 'annulee' AND c.commission > 0 AND ${when} >= ${PERIOD_START[period]}`;

  const [items, months] = await Promise.all([
    query(
      `SELECT c.id, ${when} AS date, c.commission::float AS commission, c.montant_collecte::float AS collected,
              c.montant_attendu::float AS expected, col.nom AS collector
         FROM collections c LEFT JOIN profiles col ON col.id = c.collecteur_id
        WHERE ${scope}
        ORDER BY ${when} DESC, c.created_at DESC`,
      [posId, organizationId],
    ),
    query(
      `SELECT to_char(date_trunc('month', ${when}), 'YYYY-MM') AS month,
              SUM(c.commission)::float AS total, COUNT(*)::int AS count
         FROM collections c
        WHERE ${scope}
        GROUP BY 1
        ORDER BY 1 DESC`,
      [posId, organizationId],
    ),
  ]);

  const list = items.rows.map((r) => ({
    collection_id: r.id as string,
    date: new Date(r.date).toISOString(),
    commission: Number(r.commission || 0),
    collected: Number(r.collected || 0),
    expected: Number(r.expected || 0),
    collector: (r.collector as string | null) ?? null,
  }));
  const monthList = months.rows.map((m) => ({ month: m.month as string, total: Number(m.total || 0), count: Number(m.count || 0) }));

  const total = list.reduce((sum, i) => sum + i.commission, 0);
  const top = list.reduce<(typeof list)[number] | null>((best, i) => (!best || i.commission > best.commission ? i : best), null);
  const bestMonth = monthList.reduce<(typeof monthList)[number] | null>((best, m) => (!best || m.total > best.total ? m : best), null);

  return {
    period,
    kpis: {
      total,
      count: list.length,
      average: list.length ? total / list.length : 0,
      highest: top ? { amount: top.commission, date: top.date, collection_id: top.collection_id } : null,
      best_month: bestMonth,
    },
    months: monthList,
    items: list,
  };
}
