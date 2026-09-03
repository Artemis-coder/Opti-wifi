import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

  const { data: platformUser, error: puError } = await supabase
    .from('platform_users')
    .select('role, is_active')
    .eq('auth_user_id', user.id)
    .single();

  if (puError || !platformUser || !platformUser.is_active) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || 'all';
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');

  let query = supabase
    .from('organizations')
    .select(`
      *,
      subscription:subscriptions!inner(
        plan:subscription_plans!inner(name),
        status,
        start_date,
        end_date,
        trial_end
      ),
      plan:subscription_plans(name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false });

  if (search) {
    query = query.or(`name.ilike.%${search}%,contact_name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data: orgs, error, count } = await query.range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const enrichedOrgs = (orgs || []).map((org) => {
    const sub = org.subscription;
    return {
      id: org.id,
      name: org.name,
      contact_name: org.contact_name,
      email: org.email,
      phone: org.phone,
      status: org.status,
      currency: org.currency,
      created_at: org.created_at,
      plan_name: sub?.plan?.name || org.plan?.name || 'Aucun',
      subscription_status: sub?.status || 'none',
      subscription_end_date: sub?.end_date || null,
      subscription_trial_end: sub?.trial_end || null,
    };
  });

  return NextResponse.json({
    data: enrichedOrgs,
    count,
  });
}
