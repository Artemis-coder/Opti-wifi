import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/supabase/platform';
import { query } from '@/lib/neon/db';

export const dynamic = 'force-dynamic';

// Demandes de suppression de compte (super admin) : en attente d'abord, puis l'historique.
export async function GET(request: Request) {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const status = new URL(request.url).searchParams.get('status');
  try {
    const { rows } = await query(
      `SELECT r.id, r.organization_id, r.organization_name, r.requester_name, r.requester_email, r.reason,
              r.export_acknowledged, r.status, r.requested_at, r.processed_at, r.decision_note, r.deleted_summary,
              pu.full_name AS processed_by_name,
              o.status AS organization_status, o.phone AS organization_phone, o.created_at AS organization_created_at,
              (SELECT count(*)::int FROM profiles p WHERE p.organization_id = r.organization_id) AS members,
              (SELECT count(*)::int FROM points_of_sale x WHERE x.organization_id = r.organization_id) AS points_of_sale,
              (SELECT count(*)::int FROM collections x WHERE x.organization_id = r.organization_id) AS collections
         FROM account_deletion_requests r
         LEFT JOIN organizations o ON o.id = r.organization_id
         LEFT JOIN platform_users pu ON pu.id = r.processed_by
        WHERE ($1::text IS NULL OR r.status = $1)
        ORDER BY (r.status = 'pending') DESC, r.requested_at DESC
        LIMIT 200`,
      [status && status !== 'all' ? status : null]
    );
    return NextResponse.json({ data: rows, pending: rows.filter((r) => r.status === 'pending').length });
  } catch (err) {
    console.error('Deletion requests list error:', err);
    return NextResponse.json({ error: 'Erreur lors du chargement des demandes' }, { status: 500 });
  }
}
