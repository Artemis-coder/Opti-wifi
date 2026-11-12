import { query } from '@/lib/neon/db';

/**
 * Accueil d'un compte « point de vente » (consultation seule) : résumé du mois en cours
 * (tickets reçus, encaissé, commission), dernière collecte et derniers mouvements.
 * Toujours limité au point de vente rattaché au compte, dans son organisation.
 * Collectes annulées exclues des totaux. Notes internes jamais renvoyées.
 */
export interface PosAccountDashboard {
  pos: { id: string; name: string; city: string | null; address: string | null; space: string | null; collector: string | null } | null;
  month: { tickets_received: number; collected: number; expected: number; gap: number; commission: number; collections: number };
  last_collection: { id: string; date: string; collected: number; gap: number } | null;
  recent: {
    kind: 'allocation' | 'exchange_return' | 'exchange_receive' | 'collection';
    id: string;
    date: string;
    /** Quantité de tickets (mouvement de tickets) ou montant encaissé (collecte). */
    value: number;
    label: string | null;
  }[];
}

const EMPTY_MONTH = { tickets_received: 0, collected: 0, expected: 0, gap: 0, commission: 0, collections: 0 };

export async function getPosAccountDashboard(posId: string | null, organizationId: string): Promise<PosAccountDashboard> {
  if (!posId) return { pos: null, month: EMPTY_MONTH, last_collection: null, recent: [] };

  const params = [posId, organizationId];
  const monthStart = "date_trunc('month', NOW())";
  const collected = `c.pos_id = $1 AND COALESCE(c.organization_id, c.organisation_id) = $2 AND c.statut <> 'annulee'`;
  const when = 'COALESCE(c.date_collecte::timestamptz, c.created_at)';

  const [pos, tickets, totals, last, recent] = await Promise.all([
    query(
      `SELECT p.id, p.nom, p.ville, p.adresse, s.nom AS space, col.nom AS collector
         FROM points_of_sale p
         LEFT JOIN wifi_spaces s ON s.id = p.space_id
         LEFT JOIN profiles col ON col.id = p.collecteur_id
        WHERE p.id = $1 AND p.organization_id = $2`,
      params,
    ),
    query(
      `SELECT COALESCE(SUM(CASE WHEN a.type = 'exchange_return' THEN -a.quantite ELSE a.quantite END), 0)::int AS n
         FROM ticket_allocations a
        WHERE a.pos_id = $1 AND a.organization_id = $2
          AND COALESCE(a.date_allocation::timestamptz, a.created_at) >= ${monthStart}`,
      params,
    ),
    query(
      `SELECT COUNT(*)::int AS n,
              COALESCE(SUM(c.montant_collecte), 0)::float AS collected,
              COALESCE(SUM(c.montant_attendu), 0)::float AS expected,
              COALESCE(SUM(c.difference), 0)::float AS gap,
              COALESCE(SUM(c.commission), 0)::float AS commission
         FROM collections c WHERE ${collected} AND ${when} >= ${monthStart}`,
      params,
    ),
    query(
      `SELECT c.id, ${when} AS date, c.montant_collecte::float AS collected, c.difference::float AS gap
         FROM collections c WHERE ${collected}
        ORDER BY ${when} DESC LIMIT 1`,
      params,
    ),
    query(
      `(SELECT a.type AS kind, a.id, COALESCE(a.date_allocation::timestamptz, a.created_at) AS date,
               a.quantite::float AS value, t.nom AS label
          FROM ticket_allocations a LEFT JOIN ticket_types t ON t.id = a.ticket_type_id
         WHERE a.pos_id = $1 AND a.organization_id = $2)
       UNION ALL
       (SELECT 'collection' AS kind, c.id, ${when} AS date, c.montant_collecte::float AS value, NULL AS label
          FROM collections c WHERE ${collected})
       ORDER BY date DESC LIMIT 5`,
      params,
    ),
  ]);

  const p = pos.rows[0];
  const t = totals.rows[0] || {};
  const l = last.rows[0];
  return {
    pos: p
      ? { id: p.id, name: p.nom, city: p.ville ?? null, address: p.adresse ?? null, space: p.space ?? null, collector: p.collector ?? null }
      : null,
    month: {
      tickets_received: Number(tickets.rows[0]?.n || 0),
      collected: Number(t.collected || 0),
      expected: Number(t.expected || 0),
      gap: Number(t.gap || 0),
      commission: Number(t.commission || 0),
      collections: Number(t.n || 0),
    },
    last_collection: l ? { id: l.id, date: new Date(l.date).toISOString(), collected: Number(l.collected || 0), gap: Number(l.gap || 0) } : null,
    recent: recent.rows.map((r) => ({
      kind: r.kind,
      id: r.id,
      date: new Date(r.date).toISOString(),
      value: Number(r.value || 0),
      label: r.label ?? null,
    })),
  };
}
