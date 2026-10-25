// ============================================================
// OPTIWIFI - Platform: agrégats opérationnels multi-organisations
// Requêtes SQL paramétrées (lecture seule) pour le super admin.
// ============================================================
import { query } from '@/lib/neon/db';
import type {
  OperationsKpis,
  OperationsChartDataPoint,
  TopClient,
  InactiveClient,
} from '@/types/platform';

// Les encaissements historiques peuvent porter l'organisation dans l'une ou l'autre colonne.
const COLLECTION_ORG = 'COALESCE(c.organization_id, c.organisation_id)';
const COLLECTION_DATE = 'COALESCE(c.date_collecte, c.created_at::date)';
const INACTIVITY_DAYS = 14;

export async function getOperationsKpis(rangeStart: string): Promise<OperationsKpis> {
  const { rows } = await query(
    `SELECT
       (SELECT COUNT(*) FROM wifi_spaces) AS spaces,
       (SELECT COUNT(*) FROM points_of_sale) AS pos_total,
       (SELECT COUNT(*) FROM points_of_sale WHERE statut = 'actif') AS pos_active,
       (SELECT COUNT(*) FROM profiles) AS users_total,
       (SELECT COALESCE(SUM(quantite), 0) FROM ticket_allocations
          WHERE type = 'allocation' AND COALESCE(date_allocation, created_at::date) >= $1::date) AS tickets_allocated,
       (SELECT COALESCE(SUM(ci.quantite_vendue), 0) FROM collection_items ci
          JOIN collections c ON c.id = ci.collection_id
          WHERE c.statut = 'validee' AND ${COLLECTION_DATE} >= $1::date) AS tickets_sold,
       (SELECT COUNT(*) FROM collections c
          WHERE c.statut = 'validee' AND ${COLLECTION_DATE} >= $1::date) AS collections_count,
       (SELECT COALESCE(SUM(c.montant_collecte), 0) FROM collections c
          WHERE c.statut = 'validee' AND ${COLLECTION_DATE} >= $1::date) AS amount_collected,
       (SELECT COALESCE(SUM(c.montant_attendu), 0) FROM collections c
          WHERE c.statut = 'validee' AND ${COLLECTION_DATE} >= $1::date) AS amount_expected,
       (SELECT COALESCE(SUM(c.commission), 0) FROM collections c
          WHERE c.statut = 'validee' AND ${COLLECTION_DATE} >= $1::date) AS commissions,
       (SELECT COALESCE(SUM(c.difference), 0) FROM collections c
          WHERE c.statut = 'validee' AND c.difference < 0 AND ${COLLECTION_DATE} >= $1::date) AS shortfall`,
    [rangeStart]
  );

  const r = rows[0] || {};
  return {
    spaces: Number(r.spaces || 0),
    pos_total: Number(r.pos_total || 0),
    pos_active: Number(r.pos_active || 0),
    users_total: Number(r.users_total || 0),
    tickets_allocated: Number(r.tickets_allocated || 0),
    tickets_sold: Number(r.tickets_sold || 0),
    collections_count: Number(r.collections_count || 0),
    amount_collected: Number(r.amount_collected || 0),
    amount_expected: Number(r.amount_expected || 0),
    commissions: Number(r.commissions || 0),
    shortfall: Number(r.shortfall || 0),
  };
}

export async function getOperationsChart(rangeStart: string): Promise<OperationsChartDataPoint[]> {
  const { rows } = await query(
    `SELECT d::date AS day,
            COALESCE(agg.amount, 0) AS amount,
            COALESCE(agg.tickets, 0) AS tickets
       FROM generate_series($1::date, CURRENT_DATE, interval '1 day') AS d
       LEFT JOIN (
         SELECT ${COLLECTION_DATE} AS day,
                SUM(c.montant_collecte) AS amount,
                SUM(COALESCE(items.qty, 0)) AS tickets
           FROM collections c
           LEFT JOIN (
             SELECT collection_id, SUM(quantite_vendue) AS qty
               FROM collection_items GROUP BY collection_id
           ) items ON items.collection_id = c.id
          WHERE c.statut = 'validee' AND ${COLLECTION_DATE} >= $1::date
          GROUP BY 1
       ) agg ON agg.day = d::date
      ORDER BY d`,
    [rangeStart]
  );

  return rows.map((r) => ({
    date: new Date(r.day).toISOString().split('T')[0],
    amount: Number(r.amount || 0),
    tickets: Number(r.tickets || 0),
  }));
}

export async function getTopClients(rangeStart: string, limit = 5): Promise<TopClient[]> {
  const { rows } = await query(
    `SELECT o.id, o.name, o.status,
            COALESCE(SUM(c.montant_collecte), 0) AS amount,
            COUNT(c.id) AS collections_count
       FROM organizations o
       JOIN collections c ON ${COLLECTION_ORG} = o.id
      WHERE c.statut = 'validee' AND ${COLLECTION_DATE} >= $1::date
      GROUP BY o.id, o.name, o.status
      ORDER BY amount DESC
      LIMIT $2`,
    [rangeStart, limit]
  );

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    amount: Number(r.amount || 0),
    collections_count: Number(r.collections_count || 0),
  }));
}

export async function getInactiveClients(limit = 10): Promise<InactiveClient[]> {
  const { rows } = await query(
    `SELECT o.id, o.name, o.status, MAX(c.created_at) AS last_collection
       FROM organizations o
       LEFT JOIN collections c ON ${COLLECTION_ORG} = o.id
      WHERE o.status IN ('active', 'trial', 'expiring')
      GROUP BY o.id, o.name, o.status
     HAVING MAX(c.created_at) IS NULL OR MAX(c.created_at) < NOW() - make_interval(days => $1)
      ORDER BY MAX(c.created_at) ASC NULLS FIRST
      LIMIT $2`,
    [INACTIVITY_DAYS, limit]
  );

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    last_collection: r.last_collection ? new Date(r.last_collection).toISOString() : null,
  }));
}

export { INACTIVITY_DAYS };
