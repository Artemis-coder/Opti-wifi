import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/neon/admin';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { normalizePlanFeatures } from '@/lib/plan-features';

export async function GET(request: Request) {
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

  const { data: platformUser } = await supabase
    .from('platform_users')
    .select('id, role, is_active')
    .eq('auth_user_id', user.id)
    .single();

  if (!platformUser || !platformUser.is_active || platformUser.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const adminClient = createAdminClient();

  const { data: plans, error } = await adminClient
    .from('subscription_plans')
    .select('*')
    // Ordre commercial : du moins cher au plus cher (Découverte → Standard → Décideur Pro)
    .order('price', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: plans });
}

export async function POST(request: Request) {
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

  const { data: platformUser } = await supabase
    .from('platform_users')
    .select('id, role, is_active')
    .eq('auth_user_id', user.id)
    .single();

  if (!platformUser || !platformUser.is_active || platformUser.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé — droits super_admin requis' }, { status: 403 });
  }

  const body = await request.json();
  const { name, description, price, currency, billing_period, trial_days, max_users, max_points_of_sale, max_collectors, max_tickets_per_month, features, status } = body;

  if (!name || price === undefined) {
    return NextResponse.json({ error: 'Nom et prix requis' }, { status: 400 });
  }

  const adminClient = createAdminClient();

  const { data: plan, error } = await adminClient
    .from('subscription_plans')
    .insert({
      name,
      description,
      price,
      currency: currency || 'XOF',
      billing_period: billing_period || 'monthly',
      trial_days: trial_days || 14,
      max_users: max_users || null,
      max_points_of_sale: max_points_of_sale || null,
      // 0 = aucun collecteur (ne pas le confondre avec « non renseigné »)
      max_collectors: max_collectors ?? null,
      max_tickets_per_month: max_tickets_per_month || null,
      features: normalizePlanFeatures(features),
      status: status || 'active',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await adminClient.from('platform_audit_logs').insert({
    platform_user_id: platformUser.id,
    action: 'plan.create',
    entity_type: 'subscription_plan',
    entity_id: plan.id,
    new_data: plan,
    ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
  });

  return NextResponse.json({ success: true, data: plan });
}
