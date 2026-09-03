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
    .select('role, is_active')
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
  const actionFilter = searchParams.get('action') || '';
  const entityType = searchParams.get('entity_type') || '';
  const startDate = searchParams.get('start_date') || '';
  const endDate = searchParams.get('end_date') || '';
  const limit = parseInt(searchParams.get('limit') || '200');

  let query = adminClient
    .from('platform_audit_logs')
    .select(`
      *,
      platform_user:platform_users!inner(full_name, email, role),
      organization:organizations(name)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (actionFilter) {
    query = query.ilike('action', `%${actionFilter}%`);
  }

  if (entityType) {
    query = query.eq('entity_type', entityType);
  }

  if (startDate) {
    query = query.gte('created_at', startDate);
  }

  if (endDate) {
    query = query.lte('created_at', endDate);
  }

  const { data: logs, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: logs });
}
