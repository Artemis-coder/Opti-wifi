import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/neon/admin';
import { requirePlatformAdmin } from '@/lib/supabase/platform';
import { query } from '@/lib/neon/db';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Abonnements des clients : par défaut l'abonnement actuel de chaque client (le plus récent),
// avec son état calculé (essai, actif, expire bientôt, expiré…) et les chiffres clés.
// ?scope=all : historique complet (une ligne par période de licence).
export async function GET(request: Request) {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const scopeAll = new URL(request.url).searchParams.get('scope') === 'all';

  try {
    const [rowsRes, kpiRes] = await Promise.all([
      query(
        `WITH subs AS (
           SELECT ${scopeAll ? '' : 'DISTINCT ON (s.organization_id)'} s.*
             FROM subscriptions s
            ORDER BY ${scopeAll ? '' : 's.organization_id,'} s.created_at DESC
         )
         SELECT s.id, s.organization_id, s.plan_id, s.status, s.start_date, s.end_date, s.cancel_at_period_end, s.created_at,
                o.name AS organization_name, o.status AS organization_status,
                p.name AS plan_name, p.price::float AS plan_price, p.currency AS plan_currency, p.billing_period AS plan_period,
                COALESCE(p.trial_days, 0) > 0 AS is_trial,
                CASE WHEN s.end_date IS NULL THEN NULL
                     ELSE CEIL(EXTRACT(EPOCH FROM (s.end_date - NOW())) / 86400)::int END AS days_left,
                CASE WHEN s.end_date IS NULL OR s.start_date IS NULL THEN NULL
                     ELSE GREATEST(1, CEIL(EXTRACT(EPOCH FROM (s.end_date - s.start_date)) / 86400))::int END AS total_days
           FROM subs s
           JOIN organizations o ON o.id = s.organization_id
           LEFT JOIN subscription_plans p ON p.id = s.plan_id
          WHERE o.status <> 'archived'
          ORDER BY s.created_at DESC`
      ),
      query(
        `WITH live AS (
           SELECT s.organization_id, s.end_date, p.price, p.billing_period, COALESCE(p.trial_days, 0) > 0 AS is_trial
             FROM subscriptions s
             JOIN organizations o ON o.id = s.organization_id
             LEFT JOIN subscription_plans p ON p.id = s.plan_id
            WHERE s.status IN ('active', 'trialing') AND (s.end_date IS NULL OR s.end_date > NOW())
              AND o.status NOT IN ('archived', 'cancelled')
         )
         SELECT
           (SELECT COUNT(DISTINCT organization_id) FROM live WHERE NOT is_trial)::int AS paid_active,
           (SELECT COUNT(DISTINCT organization_id) FROM live WHERE is_trial)::int AS trials,
           (SELECT COUNT(DISTINCT organization_id) FROM live
             WHERE NOT is_trial AND end_date <= NOW() + interval '10 days'
               AND NOT EXISTS (SELECT 1 FROM live l2 WHERE l2.organization_id = live.organization_id AND l2.end_date > live.end_date))::int AS expiring,
           COALESCE((SELECT SUM(price / CASE billing_period WHEN 'quarterly' THEN 3 WHEN 'semiannual' THEN 6
                                                           WHEN 'annual' THEN 12 ELSE 1 END)
                       FROM live WHERE NOT is_trial), 0)::float AS mrr,
           (SELECT COUNT(*) FROM organizations o
             WHERE o.status NOT IN ('archived', 'cancelled', 'pending_approval')
               AND NOT EXISTS (SELECT 1 FROM live WHERE live.organization_id = o.id))::int AS without_licence`
      ),
    ]);

    return NextResponse.json({ data: rowsRes.rows, kpis: kpiRes.rows[0] });
  } catch (err) {
    console.error('Subscriptions list error:', err);
    return NextResponse.json({ error: 'Erreur de chargement des abonnements' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(undefined, undefined, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { data: pu } = await supabase
    .from('platform_users')
    .select('id, role, is_active')
    .eq('auth_user_id', user.id)
    .single();

  if (!pu || !pu.is_active || pu.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const body = await request.json();
  const { subscriptionId, action, reason } = body;

  if (!subscriptionId || !action) {
    return NextResponse.json({ error: 'subscriptionId et action requis' }, { status: 400 });
  }

  const adminClient = createAdminClient();

  const { data: oldSub } = await adminClient
    .from('subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .single();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  switch (action) {
    case 'cancel':
      updates.status = 'cancelled';
      updates.cancelled_at = new Date().toISOString();
      updates.cancel_at_period_end = false;
      break;
    case 'cancel_at_period_end':
      updates.cancel_at_period_end = true;
      break;
    case 'reactivate': {
      // Un essai réactivé reste un essai
      const { rows } = await query(
        `SELECT COALESCE(p.trial_days, 0) > 0 AS is_trial FROM subscriptions s
           LEFT JOIN subscription_plans p ON p.id = s.plan_id WHERE s.id = $1`,
        [subscriptionId]
      );
      updates.status = rows[0]?.is_trial ? 'trialing' : 'active';
      updates.cancelled_at = null;
      updates.cancel_at_period_end = false;
      break;
    }
    case 'suspend':
      updates.status = 'suspended';
      break;
    default:
      return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
  }

  const { data: sub, error } = await adminClient
    .from('subscriptions')
    .update(updates)
    .eq('id', subscriptionId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await adminClient.from('platform_audit_logs').insert({
    platform_user_id: pu.id,
    organization_id: oldSub?.organization_id,
    action: `subscription.${action}`,
    entity_type: 'subscription',
    entity_id: subscriptionId,
    old_data: oldSub,
    new_data: sub,
    ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
  });

  const MESSAGES: Record<string, string> = {
    cancel: 'Abonnement annulé : accès coupé',
    cancel_at_period_end: "L'abonnement prendra fin à sa date d'expiration",
    reactivate: 'Abonnement réactivé',
    suspend: 'Abonnement suspendu : accès coupé',
  };
  return NextResponse.json({ success: true, data: sub, message: MESSAGES[action] || 'Abonnement mis à jour' });
}
