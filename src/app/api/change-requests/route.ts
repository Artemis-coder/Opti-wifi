import { NextResponse } from 'next/server';
import { query } from '@/lib/neon/db';
import { getSessionContext } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

// Demandes de correction : l'administrateur voit celles de son espace, le collecteur les siennes.
// ?status=pending (défaut) ou all
export async function GET(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx || !ctx.organizationId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const status = new URL(request.url).searchParams.get('status') === 'all' ? null : 'pending';
  const own = ctx.role !== 'administrateur';
  const { rows } = await query(
    `SELECT r.id, r.entity_type, r.entity_id, r.action, r.changes, r.previous, r.label, r.reason, r.status,
            r.requested_at, r.reviewed_at, r.review_note,
            req.nom AS requested_by_name, rev.nom AS reviewed_by_name
       FROM change_requests r
       LEFT JOIN profiles req ON req.id = r.requested_by
       LEFT JOIN profiles rev ON rev.id = r.reviewed_by
      WHERE r.organization_id = $1
        AND ($2::text IS NULL OR r.status = $2)
        AND (NOT $3::boolean OR r.requested_by = $4)
      ORDER BY (r.status = 'pending') DESC, r.requested_at DESC
      LIMIT 200`,
    [ctx.organizationId, status, own, ctx.userId]
  );
  return NextResponse.json({ data: rows, canReview: ctx.role === 'administrateur' });
}
