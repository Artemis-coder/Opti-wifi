import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getServiceClient(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {},
    },
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { data: pu } = await supabase
    .from('platform_users')
    .select('id, role, is_active')
    .eq('auth_user_id', user.id)
    .single();

  if (!pu || !pu.is_active || pu.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const adminClient = getServiceClient(cookieStore);
  const { data: plan, error } = await adminClient
    .from('subscription_plans')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  return NextResponse.json({ data: plan });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { data: pu } = await supabase
    .from('platform_users')
    .select('id, role, is_active')
    .eq('auth_user_id', user.id)
    .single();

  if (!pu || !pu.is_active || pu.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const body = await request.json();
  const { name, description, price, currency, billing_period, trial_days, max_users, max_points_of_sale, max_tickets_per_month, features, status } = body;

  const adminClient = getServiceClient(cookieStore);

  const { data: oldPlan } = await adminClient
    .from('subscription_plans')
    .select('*')
    .eq('id', id)
    .single();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (price !== undefined) updates.price = price;
  if (currency !== undefined) updates.currency = currency;
  if (billing_period !== undefined) updates.billing_period = billing_period;
  if (trial_days !== undefined) updates.trial_days = trial_days;
  if (max_users !== undefined) updates.max_users = max_users;
  if (max_points_of_sale !== undefined) updates.max_points_of_sale = max_points_of_sale;
  if (max_tickets_per_month !== undefined) updates.max_tickets_per_month = max_tickets_per_month;
  if (features !== undefined) updates.features = features;
  if (status !== undefined) updates.status = status;

  const { data: plan, error } = await adminClient
    .from('subscription_plans')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await adminClient.from('platform_audit_logs').insert({
    platform_user_id: pu.id,
    action: 'plan.update',
    entity_type: 'subscription_plan',
    entity_id: id,
    old_data: oldPlan,
    new_data: plan,
    ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
  });

  return NextResponse.json({ success: true, data: plan });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { data: pu } = await supabase
    .from('platform_users')
    .select('id, role, is_active')
    .eq('auth_user_id', user.id)
    .single();

  if (!pu || !pu.is_active || pu.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const adminClient = getServiceClient(cookieStore);

  const { data: oldPlan } = await adminClient
    .from('subscription_plans')
    .select('*')
    .eq('id', id)
    .single();

  const { error } = await adminClient
    .from('subscription_plans')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await adminClient.from('platform_audit_logs').insert({
    platform_user_id: pu.id,
    action: 'plan.delete',
    entity_type: 'subscription_plan',
    entity_id: id,
    old_data: oldPlan,
    new_data: null,
    ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
  });

  return NextResponse.json({ success: true });
}
