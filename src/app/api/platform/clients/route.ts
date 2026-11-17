import { NextResponse } from 'next/server';
import { getPlatformUserFromSession } from '@/lib/supabase/platform';
import { query } from '@/lib/neon/db';
import {
  CLIENT_STATUSES,
  CLIENT_STATUS_SQL,
  LATEST_SUBSCRIPTION_JOIN,
  OFFER_END_SQL,
  OFFER_STATUSES,
  OFFER_STATUS_SQL,
} from '@/lib/platform-client-status';

const ORG_STATUSES = [
  'pending_approval',
  'trial',
  'active',
  'expiring',
  'expired',
  'suspended',
  'cancelled',
  'archived',
];

export async function GET(request: Request) {
  const auth = await getPlatformUserFromSession();
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = (searchParams.get('search') || '').trim().slice(0, 100);
  const statusParam = searchParams.get('status') || 'all';
  const status = ORG_STATUSES.includes(statusParam) ? statusParam : null;
  // Filtres séparés : statut du client (compte) et statut de l'offre (licence, calculé)
  const clientParam = searchParams.get('client') || '';
  const clientStatus = (CLIENT_STATUSES as string[]).includes(clientParam) ? clientParam : null;
  const offerParam = searchParams.get('offer') || '';
  const offerStatus = (OFFER_STATUSES as string[]).includes(offerParam) ? offerParam : null;
  const withCounts = searchParams.get('counts') === '1';
  const limit = Math.min(500, Math.max(1, Number.parseInt(searchParams.get('limit') || '100', 10) || 100));
  const offset = Math.max(0, Number.parseInt(searchParams.get('offset') || '0', 10) || 0);
  // Échapper les jokers LIKE saisis par l'utilisateur.
  const pattern = search ? `%${search.replace(/[\\%_]/g, (m) => `\\${m}`)}%` : null;

  try {
    // Licence affichée : la plus récente (date de fin la plus lointaine).
    // Licence affichée : la plus récente (date de fin la plus lointaine).
    const { rows } = await query(
      `SELECT * FROM (
         SELECT o.id, o.name, o.contact_name, o.email, o.phone, o.status, o.currency, o.created_at,
                COALESCE(p.name, 'Aucun') AS plan_name,
                COALESCE(s.status::text, 'none') AS subscription_status,
                s.end_date AS subscription_end_date,
                s.trial_end AS subscription_trial_end,
                ${CLIENT_STATUS_SQL} AS client_status,
                ${OFFER_STATUS_SQL} AS offer_status,
                ${OFFER_END_SQL} AS offer_end_date
           FROM organizations o
           ${LATEST_SUBSCRIPTION_JOIN}
           LEFT JOIN subscription_plans p ON p.id = s.plan_id
          WHERE (($1::text IS NULL AND ($5::text = 'deleted' OR o.status <> 'archived')) OR o.status::text = $1)
            AND ($2::text IS NULL OR o.name ILIKE $2 OR o.contact_name ILIKE $2 OR o.email ILIKE $2 OR o.phone ILIKE $2)
       ) c
       WHERE ($5::text IS NULL OR c.client_status = $5)
         AND ($6::text IS NULL OR c.offer_status = $6)
       ORDER BY c.created_at DESC
       LIMIT $3 OFFSET $4`,
      [status, pattern, limit, offset, clientStatus, offerStatus]
    );
    const { rows: totalRows } = await query(
      `SELECT COUNT(*)::int AS n FROM (
         SELECT ${CLIENT_STATUS_SQL} AS client_status, ${OFFER_STATUS_SQL} AS offer_status
           FROM organizations o
           ${LATEST_SUBSCRIPTION_JOIN}
          WHERE (($1::text IS NULL AND ($3::text = 'deleted' OR o.status <> 'archived')) OR o.status::text = $1)
            AND ($2::text IS NULL OR o.name ILIKE $2 OR o.contact_name ILIKE $2 OR o.email ILIKE $2 OR o.phone ILIKE $2)
       ) c
       WHERE ($3::text IS NULL OR c.client_status = $3) AND ($4::text IS NULL OR c.offer_status = $4)`,
      [status, pattern, clientStatus, offerStatus]
    );

    // Chiffres clés : tous les clients (hors supprimés), indépendamment des filtres
    let counts: Record<string, number> | undefined;
    if (withCounts) {
      const { rows: c } = await query(
        `SELECT COUNT(*) FILTER (WHERE client_status <> 'deleted')::int AS total,
                COUNT(*) FILTER (WHERE client_status = 'active')::int AS client_active,
                COUNT(*) FILTER (WHERE client_status = 'pending')::int AS client_pending,
                COUNT(*) FILTER (WHERE client_status = 'suspended')::int AS client_suspended,
                COUNT(*) FILTER (WHERE client_status <> 'deleted' AND offer_status = 'active')::int AS offer_active,
                COUNT(*) FILTER (WHERE client_status <> 'deleted' AND offer_status = 'trial')::int AS offer_trial,
                COUNT(*) FILTER (WHERE client_status <> 'deleted' AND offer_status = 'expiring')::int AS offer_expiring,
                COUNT(*) FILTER (WHERE client_status <> 'deleted' AND offer_status = 'expired')::int AS offer_expired,
                COUNT(*) FILTER (WHERE client_status <> 'deleted' AND created_at >= now() - interval '7 days')::int AS new_7d
           FROM (
             SELECT o.created_at, ${CLIENT_STATUS_SQL} AS client_status, ${OFFER_STATUS_SQL} AS offer_status
               FROM organizations o
               ${LATEST_SUBSCRIPTION_JOIN}
           ) x`
      );
      counts = c[0];
    }

    const count = Number(totalRows[0]?.n || 0);
    return NextResponse.json({ data: rows, count, ...(counts ? { counts } : {}) });
  } catch (err) {
    console.error('Platform clients list error:', err);
    return NextResponse.json({ error: 'Erreur lors du chargement des clients' }, { status: 500 });
  }
}
