import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: Request) {
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

  const { data: platformUser } = await supabase
    .from('platform_users')
    .select('id, role, is_active')
    .eq('auth_user_id', user.id)
    .single();

  if (!platformUser || !platformUser.is_active || platformUser.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const adminClient = createServerClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {},
    },
  });

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status') || 'all';
  const search = searchParams.get('search') || '';

  let query = adminClient
    .from('subscriptions')
    .select(`
      *,
      organization:organizations!inner(name, status),
      plan:subscription_plans!inner(name, price, currency, billing_period)
    `)
    .order('created_at', { ascending: false });

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  if (search) {
    query = query.ilike('organization.name', `%${search}%`);
  }

  const { data: subs, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: subs });
}

export async function PATCH(request: Request) {
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
  const { subscriptionId, action, reason } = body;

  if (!subscriptionId || !action) {
    return NextResponse.json({ error: 'subscriptionId et action requis' }, { status: 400 });
  }

  const adminClient = createServerClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {},
    },
  });

  const { data: oldSub } = await adminClient
    .from('subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .single();

  let updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  switch (action) {
    case 'cancel':
      updates.status = 'cancelled';
      updates.cancelled_at = new Date().toISOString();
      updates.cancel_at_period_end = false;
      break;
    case 'cancel_at_period_end':
      updates.cancel_at_period_end = true;
      break;
    case 'reactivate':
      updates.status = 'active';
      updates.cancelled_at = null;
      updates.cancel_at_period_end = false;
      break;
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

  return NextResponse.json({ success: true, data: sub, message: `Abonnement ${action}` });
}
