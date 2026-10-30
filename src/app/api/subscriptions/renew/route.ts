import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { query } from '@/lib/neon/db';
import { hasUsedTrialPlan, isTrialPlan, TRIAL_ALREADY_USED_MESSAGE } from '@/lib/trial-plan';
import { notifyInBackground, notifySuperAdmins } from '@/lib/notifications';
import { trackServer } from '@/lib/analytics/server';
import { EVENTS } from '@/lib/analytics/events';

// Le client ne prolonge plus son abonnement lui-même : il envoie une demande de licence
// que le super admin valide (POST /api/platform/licenses) ou refuse.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getBillingPeriodMonths(period: string): number {
  switch (period) {
    case 'quarterly':
      return 3;
    case 'semiannual':
      return 6;
    case 'annual':
      return 12;
    default:
      return 1;
  }
}

async function getCurrentUserOrg() {
  const cookieStore = await cookies();
  const supabase = createServerClient(undefined, undefined, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {},
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié', status: 401 } as const;

  const profile = await query('SELECT organization_id FROM profiles WHERE id = $1', [user.id]);
  const organizationId = profile.rows[0]?.organization_id as string | undefined;
  if (!organizationId) return { error: 'Aucune organisation associée', status: 404 } as const;

  return { userId: user.id, organizationId };
}

async function getRequestState(organizationId: string) {
  const [subRes, reqRes] = await Promise.all([
    query(
      `SELECT s.id, s.status, s.start_date, s.end_date, s.plan_id, p.name AS plan_name, p.billing_period
         FROM subscriptions s LEFT JOIN subscription_plans p ON p.id = s.plan_id
        WHERE s.organization_id = $1
        ORDER BY s.end_date DESC NULLS LAST, s.created_at DESC
        LIMIT 1`,
      [organizationId]
    ),
    query(
      `SELECT r.id, r.type, r.status, r.duration_months, r.admin_note, r.created_at, r.processed_at,
              p.name AS plan_name
         FROM license_requests r LEFT JOIN subscription_plans p ON p.id = r.plan_id
        WHERE r.organization_id = $1
        ORDER BY r.created_at DESC
        LIMIT 1`,
      [organizationId]
    ),
  ]);
  const lastRequest = reqRes.rows[0] || null;
  return {
    subscription: subRes.rows[0] || null,
    pendingRequest: lastRequest?.status === 'pending' ? lastRequest : null,
    lastRequest,
  };
}

export async function GET() {
  const ctx = await getCurrentUserOrg();
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  try {
    const [state, trialUsed] = await Promise.all([
      getRequestState(ctx.organizationId),
      hasUsedTrialPlan(ctx.organizationId),
    ]);
    // trialUsed : la page masque le forfait Découverte s'il a déjà été utilisé
    return NextResponse.json({ success: true, data: { ...state, trialUsed, canRequest: !state.pendingRequest } });
  } catch (err) {
    console.error('Renew request GET error:', err);
    return NextResponse.json({ error: 'Erreur lors du chargement' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getCurrentUserOrg();
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const body = await request.json().catch(() => ({}));
  const { planId, message, paymentMethodId, paymentReference } = body as {
    planId?: string;
    message?: string;
    paymentMethodId?: string;
    paymentReference?: string;
  };
  if (planId && !UUID_RE.test(planId)) {
    return NextResponse.json({ error: 'Forfait invalide' }, { status: 400 });
  }
  if (paymentMethodId && !UUID_RE.test(paymentMethodId)) {
    return NextResponse.json({ error: 'Moyen de paiement invalide' }, { status: 400 });
  }
  const reference = typeof paymentReference === 'string' ? paymentReference.trim().slice(0, 100) || null : null;

  try {
    const state = await getRequestState(ctx.organizationId);
    if (state.pendingRequest) {
      return NextResponse.json(
        { error: 'Une demande est déjà en attente de validation', data: state.pendingRequest },
        { status: 409 }
      );
    }

    const targetPlanId = planId || state.subscription?.plan_id || null;
    if (!targetPlanId) {
      return NextResponse.json({ error: 'Choisissez un forfait' }, { status: 400 });
    }
    const planRes = await query(
      `SELECT id, billing_period, trial_days FROM subscription_plans WHERE id = $1 AND status = 'active'`,
      [targetPlanId]
    );
    if (!planRes.rows[0]) {
      return NextResponse.json({ error: 'Forfait introuvable ou inactif' }, { status: 404 });
    }
    // Forfait d'essai (Découverte) : une seule fois par organisation, ni redemandé ni renouvelé
    if (isTrialPlan(planRes.rows[0]) && (await hasUsedTrialPlan(ctx.organizationId))) {
      return NextResponse.json({ error: TRIAL_ALREADY_USED_MESSAGE, code: 'TRIAL_ALREADY_USED' }, { status: 400 });
    }

    let paymentMethodName: string | null = null;
    if (paymentMethodId) {
      const pm = await query('SELECT name FROM payment_methods WHERE id = $1 AND is_active = true', [paymentMethodId]);
      if (!pm.rows[0]) return NextResponse.json({ error: 'Moyen de paiement indisponible' }, { status: 400 });
      paymentMethodName = pm.rows[0].name;
    }

    const type = !state.subscription ? 'new' : targetPlanId === state.subscription.plan_id ? 'renewal' : 'upgrade';
    const months = getBillingPeriodMonths(planRes.rows[0].billing_period);
    const note = typeof message === 'string' ? message.trim().slice(0, 500) || null : null;

    const { rows } = await query(
      `INSERT INTO license_requests (organization_id, plan_id, duration_months, type, message, requested_by,
                                     payment_method_id, payment_reference)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, type, status, duration_months, created_at`,
      [ctx.organizationId, targetPlanId, months, type, note, ctx.userId, paymentMethodId || null, reference]
    );

    const organizationId = ctx.organizationId;
    const TYPE_LABELS: Record<string, string> = { renewal: 'Renouvellement', new: 'Nouvelle licence', upgrade: 'Changement de forfait' };
    notifyInBackground(async () => {
      const info = await query(
        `SELECT o.name AS org, p.name AS plan FROM organizations o, subscription_plans p WHERE o.id = $1 AND p.id = $2`,
        [organizationId, targetPlanId]
      );
      const r = info.rows[0];
      await notifySuperAdmins({
        type: 'license_request.new',
        title: `Demande de licence : ${r?.org || 'client'}`,
        body: `${TYPE_LABELS[type]} — ${r?.plan || 'forfait'}, ${months} mois.${
          paymentMethodName ? ` Payé par ${paymentMethodName}${reference ? ` (réf. ${reference})` : ''}.` : ''
        } À valider.`,
        link: '/platform/license-requests',
      });
    });

    trackServer(ctx.userId, EVENTS.licenseRequested, {
      organization_id: organizationId,
      plan_id: targetPlanId,
      request_type: type,
      duration_months: months,
      payment_method: paymentMethodName ?? null,
    });

    return NextResponse.json({
      success: true,
      message: 'Demande envoyée. Votre licence sera activée après validation.',
      data: rows[0],
    });
  } catch (err) {
    // Index unique : une seule demande en attente par organisation (requêtes concurrentes).
    if (err instanceof Error && /uq_license_requests_one_pending/.test(err.message)) {
      return NextResponse.json({ error: 'Une demande est déjà en attente de validation' }, { status: 409 });
    }
    console.error('Renew request POST error:', err);
    return NextResponse.json({ error: "Erreur lors de l'envoi de la demande" }, { status: 500 });
  }
}
