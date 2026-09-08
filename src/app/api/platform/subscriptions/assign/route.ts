import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
  const { organization_id, plan_id, start_date, end_date, status, auto_renew, trial_start, trial_end } = body;

  if (!organization_id || !plan_id) {
    return NextResponse.json({ error: 'organization_id et plan_id sont requis' }, { status: 400 });
  }

  const adminClient = createServerClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {},
    },
  });

  // Vérifier que l'organisation existe
  const { data: org } = await adminClient
    .from('organizations')
    .select('id, name, status')
    .eq('id', organization_id)
    .single();

  if (!org) {
    return NextResponse.json({ error: 'Organisation non trouvée' }, { status: 404 });
  }

  // Vérifier que le plan existe et est actif
  const { data: plan } = await adminClient
    .from('subscription_plans')
    .select('id, name, price, billing_period, trial_days')
    .eq('id', plan_id)
    .eq('status', 'active')
    .single();

  if (!plan) {
    return NextResponse.json({ error: 'Plan non trouvé ou inactif' }, { status: 404 });
  }

  // Annuler les abonnements actifs existants
  const { data: activeSubs } = await adminClient
    .from('subscriptions')
    .select('id')
    .eq('organization_id', organization_id)
    .in('status', ['trialing', 'active', 'past_due']);

  if (activeSubs && activeSubs.length > 0) {
    await adminClient
      .from('subscriptions')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .in('id', activeSubs.map(s => s.id));
  }

  // Calculer les dates si non fournies
  const now = new Date();
  const calculatedStartDate = start_date || now.toISOString();

  let calculatedEndDate = end_date;
  if (!calculatedEndDate) {
    const endDate = new Date(calculatedStartDate);
    switch (plan.billing_period) {
      case 'monthly':
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case 'quarterly':
        endDate.setMonth(endDate.getMonth() + 3);
        break;
      case 'semiannual':
        endDate.setMonth(endDate.getMonth() + 6);
        break;
      case 'annual':
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
      default:
        endDate.setMonth(endDate.getMonth() + 1);
    }
    calculatedEndDate = endDate.toISOString();
  }

  let calculatedTrialEnd = trial_end;
  if (status === 'trialing' && plan.trial_days && !trial_end) {
    const trialEndDate = new Date(calculatedStartDate);
    trialEndDate.setDate(trialEndDate.getDate() + plan.trial_days);
    calculatedTrialEnd = trialEndDate.toISOString();
  }

  // Créer le nouvel abonnement
  const { data: subscription, error } = await adminClient
    .from('subscriptions')
    .insert({
      organization_id,
      plan_id,
      status: status || 'active',
      start_date: calculatedStartDate,
      end_date: calculatedEndDate,
      trial_start: status === 'trialing' ? (trial_start || calculatedStartDate) : null,
      trial_end: calculatedTrialEnd,
      auto_renew: auto_renew !== undefined ? auto_renew : true,
      cancel_at_period_end: false,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .select(`
      *,
      plan:subscription_plans(id, name, price, currency, billing_period),
      organization:organizations(id, name)
    `)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mettre à jour le statut de l'organisation
  const orgStatusUpdate = status === 'trialing' ? 'trial' : 'active';
  await adminClient
    .from('organizations')
    .update({ status: orgStatusUpdate, updated_at: now.toISOString() })
    .eq('id', organization_id);

  // Journaliser l'action
  await adminClient.from('platform_audit_logs').insert({
    platform_user_id: pu.id,
    organization_id,
    action: 'subscription.assigned',
    entity_type: 'subscription',
    entity_id: subscription.id,
    new_data: subscription,
    ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
  });

  return NextResponse.json({
    success: true,
    data: subscription,
    message: `Abonnement "${plan.name}" attribué à ${org.name}`,
  });
}
