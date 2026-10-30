import { query } from '@/lib/neon/db';

/**
 * Tableau de bord du client : chiffres de la période, ventes par point de vente,
 * derniers encaissements. Toujours limité à l'organisation de la session (et à l'espace
 * Wi-Fi choisi). Encaissements annulés exclus. Date d'un encaissement : date de collecte
 * saisie, sinon date d'enregistrement.
 */
export type DashboardPeriod = 'today' | 'week' | 'month' | 'all';

export function parseDashboardPeriod(v: string | null): DashboardPeriod {
  return v === 'today' || v === 'week' || v === 'month' ? v : 'all';
}

export interface ClientDashboard {
  period: DashboardPeriod;
  totals: { tickets: number; revenue: number; collected: number; gap: number; collections: number };
  previous: { revenue: number; collected: number } | null;
  pos_count: number;
  by_pos: { pos_id: string; name: string; revenue: number; collected: number; gap: number }[];
  recent: {
    id: string;
    pos: string;
    collector: string | null;
    collected: number;
    gap: number;
    status: string;
    date: string;
  }[];
}

// Bornes [début, fin) de la période et de la période précédente (fuseau Abidjan = UTC)
const BOUNDS: Record<DashboardPeriod, { start: string; prevStart: string | null }> = {
  today: { start: "date_trunc('day', NOW())", prevStart: "date_trunc('day', NOW()) - interval '1 day'" },
  week: { start: "date_trunc('day', NOW()) - interval '6 days'", prevStart: "date_trunc('day', NOW()) - interval '13 days'" },
  month: { start: "date_trunc('month', NOW())", prevStart: "date_trunc('month', NOW()) - interval '1 month'" },
  all: { start: "'-infinity'::timestamptz", prevStart: null },
};

export async function getClientDashboard(
  organizationId: string,
  spaceId: string | null,
  period: DashboardPeriod,
): Promise<ClientDashboard> {
  const { start, prevStart } = BOUNDS[period];
  // Colonnes de date et d'organisation communes aux requêtes (les deux colonnes d'organisation coexistent)
  const scope = `COALESCE(c.organization_id, c.organisation_id) = $1 AND ($2::uuid IS NULL OR c.space_id = $2::uuid) AND c.statut <> 'annulee'`;
  const when = `COALESCE(c.date_collecte::timestamptz, c.created_at)`;
  const params = [organizationId, spaceId];

  const [totals, tickets, prev, byPos, recent, posCount] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS collections,
              COALESCE(SUM(c.montant_attendu), 0)::float AS revenue,
              COALESCE(SUM(c.montant_collecte), 0)::float AS collected,
              COALESCE(SUM(c.difference), 0)::float AS gap
         FROM collections c
        WHERE ${scope} AND ${when} >= ${start}`,
      params,
    ),
    query(
      `SELECT COALESCE(SUM(ci.quantite_vendue), 0)::int AS n
         FROM collection_items ci
         JOIN collections c ON c.id = ci.collection_id
        WHERE ${scope} AND ${when} >= ${start}`,
      params,
    ),
    prevStart
      ? query(
          `SELECT COALESCE(SUM(c.montant_attendu), 0)::float AS revenue, COALESCE(SUM(c.montant_collecte), 0)::float AS collected
             FROM collections c
            WHERE ${scope} AND ${when} >= ${prevStart} AND ${when} < ${start}`,
          params,
        )
      : Promise.resolve(null),
    query(
      `SELECT p.id AS pos_id, p.nom AS name,
              COALESCE(SUM(c.montant_attendu), 0)::float AS revenue,
              COALESCE(SUM(c.montant_collecte), 0)::float AS collected,
              COALESCE(SUM(c.difference), 0)::float AS gap
         FROM collections c
         JOIN points_of_sale p ON p.id = c.pos_id
        WHERE ${scope} AND ${when} >= ${start}
        GROUP BY p.id, p.nom
        ORDER BY revenue DESC
        LIMIT 12`,
      params,
    ),
    query(
      `SELECT c.id, p.nom AS pos, pr.nom AS collector, c.montant_collecte::float AS collected,
              c.difference::float AS gap, c.statut AS status, ${when} AS date
         FROM collections c
         JOIN points_of_sale p ON p.id = c.pos_id
         LEFT JOIN profiles pr ON pr.id = c.collecteur_id
        WHERE ${scope}
        ORDER BY c.created_at DESC
        LIMIT 5`,
      params,
    ),
    query(
      `SELECT COUNT(*)::int AS n FROM points_of_sale p
        WHERE p.organization_id = $1 AND ($2::uuid IS NULL OR p.space_id = $2::uuid)`,
      params,
    ),
  ]);

  const t = totals.rows[0] || {};
  const pv = prev?.rows[0];
  return {
    period,
    totals: {
      tickets: Number(tickets.rows[0]?.n || 0),
      revenue: Number(t.revenue || 0),
      collected: Number(t.collected || 0),
      gap: Number(t.gap || 0),
      collections: Number(t.collections || 0),
    },
    previous: pv ? { revenue: Number(pv.revenue || 0), collected: Number(pv.collected || 0) } : null,
    pos_count: Number(posCount.rows[0]?.n || 0),
    by_pos: byPos.rows.map((r) => ({
      pos_id: r.pos_id,
      name: r.name,
      revenue: Number(r.revenue),
      collected: Number(r.collected),
      gap: Number(r.gap),
    })),
    recent: recent.rows.map((r) => ({
      id: r.id,
      pos: r.pos,
      collector: r.collector,
      collected: Number(r.collected),
      gap: Number(r.gap),
      status: r.status,
      date: new Date(r.date).toISOString(),
    })),
  };
}
