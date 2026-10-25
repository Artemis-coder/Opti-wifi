import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/supabase/platform';
import { query } from '@/lib/neon/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Activation d'une licence : attribue un forfait pour une durée donnée à une organisation.
// La nouvelle période démarre à la fin de la licence en cours (si elle court encore), sinon maintenant.
// Toutes les écritures se font dans une seule requête (atomique).
export async function POST(request: Request) {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const { organizationId, planId, durationMonths, requestId, note } = body as {
    organizationId?: string;
    planId?: string;
    durationMonths?: number;
    requestId?: string | null;
    note?: string | null;
  };

  const months = Number(durationMonths);
  if (!organizationId || !UUID_RE.test(organizationId) || !planId || !UUID_RE.test(planId)) {
    return NextResponse.json({ error: 'Organisation et forfait requis' }, { status: 400 });
  }
  if (!Number.isInteger(months) || months < 1 || months > 36) {
    return NextResponse.json({ error: 'Durée invalide (1 à 36 mois)' }, { status: 400 });
  }
  if (requestId && !UUID_RE.test(requestId)) {
    return NextResponse.json({ error: 'Demande invalide' }, { status: 400 });
  }
  const adminNote = typeof note === 'string' ? note.trim().slice(0, 500) || null : null;

  try {
    const [orgRes, planRes] = await Promise.all([
      query('SELECT id, name, status FROM organizations WHERE id = $1', [organizationId]),
      query(`SELECT id, name FROM subscription_plans WHERE id = $1 AND status = 'active'`, [planId]),
    ]);
    const org = orgRes.rows[0];
    if (!org) return NextResponse.json({ error: 'Organisation introuvable' }, { status: 404 });
    if (!planRes.rows[0]) return NextResponse.json({ error: 'Forfait introuvable ou inactif' }, { status: 404 });

    if (requestId) {
      const reqRes = await query(
        'SELECT status FROM license_requests WHERE id = $1 AND organization_id = $2',
        [requestId, organizationId]
      );
      if (!reqRes.rows[0]) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 });
      if (reqRes.rows[0].status !== 'pending') {
        return NextResponse.json({ error: 'Cette demande a déjà été traitée' }, { status: 409 });
      }
    }

    const { rows } = await query(
      `WITH cur AS (
         SELECT MAX(end_date) FILTER (WHERE status IN ('active', 'trialing') AND end_date > NOW()) AS cur_end
           FROM subscriptions WHERE organization_id = $1
       ),
       superseded AS (
         UPDATE subscriptions SET status = 'expired', updated_at = NOW()
          WHERE organization_id = $1 AND status IN ('active', 'trialing', 'past_due', 'unpaid')
          RETURNING id
       ),
       ins AS (
         INSERT INTO subscriptions (organization_id, plan_id, status, start_date, end_date, auto_renew, cancel_at_period_end)
         SELECT $1, $2, 'active',
                GREATEST(NOW(), COALESCE(cur.cur_end, NOW())),
                GREATEST(NOW(), COALESCE(cur.cur_end, NOW())) + make_interval(months => $3),
                false, false
           FROM cur
         RETURNING id, start_date, end_date
       ),
       org AS (
         UPDATE organizations
            SET status = CASE WHEN status = 'suspended' THEN status ELSE 'active'::organization_status END,
                updated_at = NOW()
          WHERE id = $1
          RETURNING status
       ),
       req AS (
         UPDATE license_requests
            SET status = 'approved', processed_by = $5, processed_at = NOW(), admin_note = $6,
                subscription_id = (SELECT id FROM ins)
          WHERE id = $4 AND organization_id = $1 AND status = 'pending'
          RETURNING id
       )
       SELECT ins.id, ins.start_date, ins.end_date,
              (SELECT status FROM org) AS org_status,
              (SELECT COUNT(*) FROM superseded) AS superseded_count,
              (SELECT COUNT(*) FROM req) AS request_updated
         FROM ins`,
      [organizationId, planId, months, requestId || null, auth.platformUser.id, adminNote]
    );

    const sub = rows[0];

    await query(
      `INSERT INTO platform_audit_logs (platform_user_id, organization_id, action, entity_type, entity_id, old_data, new_data)
       VALUES ($1, $2, 'license_activated', 'subscription', $3, $4, $5)`,
      [
        auth.platformUser.id,
        organizationId,
        sub.id,
        JSON.stringify({ organization_status: org.status }),
        JSON.stringify({
          plan_id: planId,
          plan_name: planRes.rows[0].name,
          duration_months: months,
          start_date: sub.start_date,
          end_date: sub.end_date,
          request_id: requestId || null,
          note: adminNote,
        }),
      ]
    );

    return NextResponse.json({
      success: true,
      data: {
        subscription_id: sub.id,
        start_date: sub.start_date,
        end_date: sub.end_date,
        organization_status: sub.org_status,
      },
    });
  } catch (err) {
    console.error('License activation error:', err);
    return NextResponse.json({ error: "Erreur lors de l'activation de la licence" }, { status: 500 });
  }
}
