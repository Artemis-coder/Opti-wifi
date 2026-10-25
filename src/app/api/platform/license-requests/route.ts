import { NextResponse } from 'next/server';
import { getPlatformUserFromSession, requirePlatformAdmin } from '@/lib/supabase/platform';
import { query } from '@/lib/neon/db';
import { notifyInBackground, notifyOrganizationAdmins } from '@/lib/notifications';

const STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const auth = await getPlatformUserFromSession();
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'pending';
  const statusFilter = (STATUSES as readonly string[]).includes(status) ? status : null;

  try {
    const { rows } = await query(
      `SELECT r.id, r.type, r.status, r.duration_months, r.message, r.admin_note,
              r.created_at, r.processed_at,
              o.id AS organization_id, o.name AS organization_name, o.status AS organization_status,
              o.contact_name, o.email AS organization_email, o.phone AS organization_phone,
              p.id AS plan_id, p.name AS plan_name, p.price AS plan_price, p.currency AS plan_currency,
              pr.nom AS requested_by_name,
              cur.end_date AS current_end_date, cp.name AS current_plan_name
         FROM license_requests r
         JOIN organizations o ON o.id = r.organization_id
         LEFT JOIN subscription_plans p ON p.id = r.plan_id
         LEFT JOIN profiles pr ON pr.id = r.requested_by
         LEFT JOIN LATERAL (
           SELECT s.end_date, s.plan_id FROM subscriptions s
            WHERE s.organization_id = r.organization_id
            ORDER BY s.end_date DESC NULLS LAST LIMIT 1
         ) cur ON true
         LEFT JOIN subscription_plans cp ON cp.id = cur.plan_id
        WHERE ($1::text IS NULL OR r.status = $1)
        ORDER BY r.created_at DESC
        LIMIT 200`,
      [statusFilter]
    );
    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error('License requests list error:', err);
    return NextResponse.json({ error: 'Erreur lors du chargement des demandes' }, { status: 500 });
  }
}

// Rejet d'une demande (l'approbation passe par POST /api/platform/licenses avec requestId).
export async function PATCH(request: Request) {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const { requestId, action, note } = body as { requestId?: string; action?: string; note?: string };

  if (!requestId || !UUID_RE.test(requestId) || action !== 'reject') {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }
  const adminNote = typeof note === 'string' ? note.trim().slice(0, 500) || null : null;

  try {
    const { rows } = await query(
      `UPDATE license_requests
          SET status = 'rejected', processed_by = $2, processed_at = NOW(), admin_note = $3
        WHERE id = $1 AND status = 'pending'
        RETURNING id, organization_id`,
      [requestId, auth.platformUser.id, adminNote]
    );
    if (!rows[0]) {
      return NextResponse.json({ error: 'Demande introuvable ou déjà traitée' }, { status: 409 });
    }

    await query(
      `INSERT INTO platform_audit_logs (platform_user_id, organization_id, action, entity_type, entity_id, new_data)
       VALUES ($1, $2, 'license_request_rejected', 'license_request', $3, $4)`,
      [auth.platformUser.id, rows[0].organization_id, requestId, JSON.stringify({ note: adminNote })]
    );

    const rejectedOrgId = rows[0].organization_id as string;
    notifyInBackground(() =>
      notifyOrganizationAdmins(rejectedOrgId, {
        type: 'license_request.rejected',
        title: "Votre demande de licence n'a pas été acceptée",
        body: adminNote ? `Motif : ${adminNote}` : 'Vous pouvez choisir un autre forfait ou contacter le support.',
        link: '/subscription',
      })
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('License request reject error:', err);
    return NextResponse.json({ error: 'Erreur lors du rejet de la demande' }, { status: 500 });
  }
}
