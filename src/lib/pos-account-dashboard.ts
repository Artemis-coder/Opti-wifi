import { query } from '@/lib/neon/db';
import { PERIOD_START, type CommissionPeriod } from '@/lib/pos-account-commissions';

/**
 * Accueil d'un compte « point de vente » (consultation seule). Tout est calculé sur la MÊME
 * période choisie (ce mois-ci par défaut), pour que les chiffres clés et les listes concordent :
 * tickets reçus, total collecté, écart (et nombre de collectes avec écart), commission,
 * ses 5 dernières collectes et ses 5 derniers tickets reçus de la période.
 * Toujours limité au point de vente rattaché au compte, dans son organisation.
 * Collectes annulées exclues. Notes internes jamais renvoyées.
 */
export type DashboardPeriod = CommissionPeriod;

export interface PosAccountDashboard {
  period: DashboardPeriod;
  pos: { id: string; name: string; city: string | null; address: string | null; space: string | null; collector: string | null } | null;
  totals: {
    tickets_received: number;
    collected: number;
    expected: number;
    gap: number;
    /** Nombre de collectes dont le montant collecté diffère du montant attendu. */
    gap_count: number;
    commission: number;
    collections: number;
  };
  /** 5 dernières collectes de la période (hors annulées), la plus récente d'abord. */
  last_collections: { id: string; date: string; collected: number; expected: number; gap: number; commission: number; collector: string | null }[];
  /** 5 derniers mouvements de tickets de la période (allocations et échanges). */
  recent: {
    kind: 'allocation' | 'exchange_return' | 'exchange_receive';
    id: string;
    date: string;
    /** Quantité de tickets. */
    value: number;
    label: string | null;
  }[];
}

const EMPTY_TOTALS = { tickets_received: 0, collected: 0, expected: 0, gap: 0, gap_count: 0, commission: 0, collections: 0 };

export async function getPosAccountDashboard(
  posId: string | null,
  organizationId: string,
  period: DashboardPeriod = 'month',
): Promise<PosAccountDashboard> {
  if (!posId) return { period, pos: null, totals: EMPTY_TOTALS, last_collections: [], recent: [] };

  const params = [posId, organizationId];
  const start = PERIOD_START[period];
  const when = 'COALESCE(c.date_collecte::timestamptz, c.created_at)';
  const collected = `c.pos_id = $1 AND COALESCE(c.organization_id, c.organisation_id) = $2
                     AND c.statut <> 'annulee' AND ${when} >= ${start}`;
  const allocWhen = 'COALESCE(a.date_allocation::timestamptz, a.created_at)';
  const allocated = `a.pos_id = $1 AND a.organization_id = $2 AND ${allocWhen} >= ${start}`;

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
         FROM ticket_allocations a WHERE ${allocated}`,
      params,
    ),
    query(
      `SELECT COUNT(*)::int AS n,
              COUNT(*) FILTER (WHERE c.difference <> 0)::int AS gap_count,
              COALESCE(SUM(c.montant_collecte), 0)::float AS collected,
              COALESCE(SUM(c.montant_attendu), 0)::float AS expected,
              COALESCE(SUM(c.difference), 0)::float AS gap,
              COALESCE(SUM(c.commission), 0)::float AS commission
         FROM collections c WHERE ${collected}`,
      params,
    ),
    query(
      `SELECT c.id, ${when} AS date, c.montant_collecte::float AS collected, c.montant_attendu::float AS expected,
              c.difference::float AS gap, c.commission::float AS commission, col.nom AS collector
         FROM collections c LEFT JOIN profiles col ON col.id = c.collecteur_id
        WHERE ${collected}
        ORDER BY ${when} DESC, c.created_at DESC LIMIT 5`,
      params,
    ),
    query(
      `SELECT a.type AS kind, a.id, ${allocWhen} AS date, a.quantite::float AS value, t.nom AS label
         FROM ticket_allocations a LEFT JOIN ticket_types t ON t.id = a.ticket_type_id
        WHERE ${allocated}
        ORDER BY date DESC, a.created_at DESC LIMIT 5`,
      params,
    ),
  ]);

  const p = pos.rows[0];
  const t = totals.rows[0] || {};
  return {
    period,
    pos: p
      ? { id: p.id, name: p.nom, city: p.ville ?? null, address: p.adresse ?? null, space: p.space ?? null, collector: p.collector ?? null }
      : null,
    totals: {
      tickets_received: Number(tickets.rows[0]?.n || 0),
      collected: Number(t.collected || 0),
      expected: Number(t.expected || 0),
      gap: Number(t.gap || 0),
      gap_count: Number(t.gap_count || 0),
      commission: Number(t.commission || 0),
      collections: Number(t.n || 0),
    },
    last_collections: last.rows.map((l) => ({
      id: l.id,
      date: new Date(l.date).toISOString(),
      collected: Number(l.collected || 0),
      expected: Number(l.expected || 0),
      gap: Number(l.gap || 0),
      commission: Number(l.commission || 0),
      collector: l.collector ?? null,
    })),
    recent: recent.rows.map((r) => ({
      kind: r.kind,
      id: r.id,
      date: new Date(r.date).toISOString(),
      value: Number(r.value || 0),
      label: r.label ?? null,
    })),
  };
}
