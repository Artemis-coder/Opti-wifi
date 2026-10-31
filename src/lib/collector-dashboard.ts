import { query } from '@/lib/neon/db';
import type { DashboardPeriod } from '@/lib/client-dashboard';

/**
 * Accueil du collecteur (« Ma tournée ») : ses encaissements sur la période choisie, ses points
 * de vente classés par priorité de passage, ses dernières collectes. Toujours limité aux collectes
 * faites par le collecteur de la session (comme « Mes collectes »), dans son organisation.
 * Encaissements annulés exclus des totaux.
 */
export interface CollectorDashboard {
  period: DashboardPeriod;
  totals: { collected: number; expected: number; gap: number; collections: number; tickets: number };
  pos: {
    id: string;
    name: string;
    city: string | null;
    address: string | null;
    status: string;
    space: string | null;
    /** Tickets confiés au point de vente et pas encore déclarés vendus (même calcul que la saisie de collecte). */
    stock_tickets: number;
    /** Valeur de ce stock au prix de vente : ce que le point de vente peut encore encaisser. */
    stock_value: number;
    last_collection_at: string | null;
    last_collected: number | null;
    /** Jours depuis la dernière collecte (null : jamais collecté). */
    days_since: number | null;
  }[];
  recent: { id: string; pos: string; collected: number; gap: number; status: string; date: string }[];
}

// Début de la période (fuseau Abidjan = UTC), comme le tableau de bord de l'administrateur
const PERIOD_START: Record<DashboardPeriod, string> = {
  today: "date_trunc('day', NOW())",
  week: "date_trunc('day', NOW()) - interval '6 days'",
  month: "date_trunc('month', NOW())",
  all: "'-infinity'::timestamptz",
};

export async function getCollectorDashboard(
  userId: string,
  organizationId: string,
  spaceId: string | null,
  period: DashboardPeriod,
): Promise<CollectorDashboard> {
  const start = PERIOD_START[period];
  const when = `COALESCE(c.date_collecte::timestamptz, c.created_at)`;
  const mine = `c.collecteur_id = $1 AND COALESCE(c.organization_id, c.organisation_id) = $2
                AND ($3::uuid IS NULL OR c.space_id = $3::uuid) AND c.statut <> 'annulee'`;
  const params = [userId, organizationId, spaceId];

  const [totals, tickets, pos, recent] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS n,
              COALESCE(SUM(c.montant_collecte), 0)::float AS collected,
              COALESCE(SUM(c.montant_attendu), 0)::float AS expected,
              COALESCE(SUM(c.difference), 0)::float AS gap
         FROM collections c WHERE ${mine} AND ${when} >= ${start}`,
      params,
    ),
    query(
      `SELECT COALESCE(SUM(ci.quantite_vendue), 0)::int AS n
         FROM collection_items ci JOIN collections c ON c.id = ci.collection_id
        WHERE ${mine} AND ${when} >= ${start}`,
      params,
    ),
    query(
      `WITH my_pos AS (
         SELECT p.id, p.nom, p.ville, p.adresse, p.statut, s.nom AS space
           FROM points_of_sale p
           LEFT JOIN wifi_spaces s ON s.id = p.space_id
          WHERE p.collecteur_id = $1 AND p.organization_id = $2
            AND ($3::uuid IS NULL OR p.space_id = $3::uuid)
       ),
       allocated AS (
         SELECT a.pos_id, a.ticket_type_id,
                SUM(CASE WHEN a.type = 'exchange_return' THEN -a.quantite ELSE a.quantite END) AS qty
           FROM ticket_allocations a WHERE a.pos_id IN (SELECT id FROM my_pos)
          GROUP BY a.pos_id, a.ticket_type_id
       ),
       sold AS (
         SELECT c.pos_id, ci.ticket_type_id, SUM(ci.quantite_vendue) AS qty
           FROM collection_items ci JOIN collections c ON c.id = ci.collection_id
          WHERE c.pos_id IN (SELECT id FROM my_pos)
          GROUP BY c.pos_id, ci.ticket_type_id
       ),
       stock AS (
         SELECT al.pos_id,
                SUM(GREATEST(al.qty - COALESCE(so.qty, 0), 0))::int AS tickets,
                SUM(GREATEST(al.qty - COALESCE(so.qty, 0), 0) * t.prix)::float AS value
           FROM allocated al
           JOIN ticket_types t ON t.id = al.ticket_type_id
           LEFT JOIN sold so ON so.pos_id = al.pos_id AND so.ticket_type_id = al.ticket_type_id
          GROUP BY al.pos_id
       ),
       last_c AS (
         SELECT DISTINCT ON (c.pos_id) c.pos_id, ${when} AS at, c.montant_collecte::float AS collected
           FROM collections c
          WHERE c.pos_id IN (SELECT id FROM my_pos) AND c.statut <> 'annulee'
          ORDER BY c.pos_id, ${when} DESC, c.created_at DESC
       )
       SELECT mp.id, mp.nom AS name, mp.ville AS city, mp.adresse AS address, mp.statut AS status, mp.space,
              COALESCE(st.tickets, 0) AS stock_tickets, COALESCE(st.value, 0) AS stock_value,
              lc.at AS last_at, lc.collected AS last_collected,
              (CURRENT_DATE - lc.at::date) AS days_since
         FROM my_pos mp
         LEFT JOIN stock st ON st.pos_id = mp.id
         LEFT JOIN last_c lc ON lc.pos_id = mp.id
        ORDER BY (mp.statut = 'actif') DESC, lc.at ASC NULLS FIRST, mp.nom`,
      params,
    ),
    query(
      `SELECT c.id, p.nom AS pos, c.montant_collecte::float AS collected, c.difference::float AS gap,
              c.statut AS status, ${when} AS date
         FROM collections c JOIN points_of_sale p ON p.id = c.pos_id
        WHERE c.collecteur_id = $1 AND COALESCE(c.organization_id, c.organisation_id) = $2
          AND ($3::uuid IS NULL OR c.space_id = $3::uuid)
        ORDER BY c.created_at DESC
        LIMIT 6`,
      params,
    ),
  ]);

  const m = totals.rows[0] || {};
  return {
    period,
    totals: {
      collected: Number(m.collected || 0),
      expected: Number(m.expected || 0),
      gap: Number(m.gap || 0),
      collections: Number(m.n || 0),
      tickets: Number(tickets.rows[0]?.n || 0),
    },
    pos: pos.rows.map((r) => ({
      id: r.id,
      name: r.name,
      city: r.city ?? null,
      address: r.address ?? null,
      status: r.status,
      space: r.space ?? null,
      stock_tickets: Number(r.stock_tickets || 0),
      stock_value: Number(r.stock_value || 0),
      last_collection_at: r.last_at ? new Date(r.last_at).toISOString() : null,
      last_collected: r.last_collected === null || r.last_collected === undefined ? null : Number(r.last_collected),
      days_since: r.days_since === null || r.days_since === undefined ? null : Number(r.days_since),
    })),
    recent: recent.rows.map((r) => ({
      id: r.id,
      pos: r.pos,
      collected: Number(r.collected),
      gap: Number(r.gap),
      status: r.status,
      date: new Date(r.date).toISOString(),
    })),
  };
}
