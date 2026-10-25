import { NextResponse } from 'next/server';
import { getPlatformUserFromSession } from '@/lib/supabase/platform';
import { query } from '@/lib/neon/db';

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
  const limit = Math.min(500, Math.max(1, Number.parseInt(searchParams.get('limit') || '100', 10) || 100));
  const offset = Math.max(0, Number.parseInt(searchParams.get('offset') || '0', 10) || 0);
  // Échapper les jokers LIKE saisis par l'utilisateur.
  const pattern = search ? `%${search.replace(/[\\%_]/g, (m) => `\\${m}`)}%` : null;

  try {
    // Licence affichée : la plus récente (date de fin la plus lointaine).
    const { rows } = await query(
      `SELECT o.id, o.name, o.contact_name, o.email, o.phone, o.status, o.currency, o.created_at,
              COALESCE(p.name, 'Aucun') AS plan_name,
              COALESCE(s.status::text, 'none') AS subscription_status,
              s.end_date AS subscription_end_date,
              s.trial_end AS subscription_trial_end,
              COUNT(*) OVER() AS total_count
         FROM organizations o
         LEFT JOIN LATERAL (
           SELECT status, end_date, trial_end, plan_id FROM subscriptions
            WHERE organization_id = o.id
            ORDER BY end_date DESC NULLS LAST, created_at DESC
            LIMIT 1
         ) s ON true
         LEFT JOIN subscription_plans p ON p.id = s.plan_id
        WHERE ($1::text IS NULL OR o.status::text = $1)
          AND ($2::text IS NULL OR o.name ILIKE $2 OR o.contact_name ILIKE $2 OR o.email ILIKE $2 OR o.phone ILIKE $2)
        ORDER BY o.created_at DESC
        LIMIT $3 OFFSET $4`,
      [status, pattern, limit, offset]
    );

    const count = Number(rows[0]?.total_count || 0);
    const data = rows.map((row) => {
      const rest = { ...row };
      delete rest.total_count;
      return rest;
    });

    return NextResponse.json({ data, count });
  } catch (err) {
    console.error('Platform clients list error:', err);
    return NextResponse.json({ error: 'Erreur lors du chargement des clients' }, { status: 500 });
  }
}
