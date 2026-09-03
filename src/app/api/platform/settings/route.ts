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

  const { data: settings, error } = await adminClient
    .from('platform_settings')
    .select('*');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: settings });
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
  const { key, value } = body;

  if (!key || value === undefined) {
    return NextResponse.json({ error: 'key et value requis' }, { status: 400 });
  }

  const adminClient = createServerClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {},
    },
  });

  const { data: { old_data: _old } } = await adminClient
    .from('platform_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  const { data: setting, error } = await adminClient
    .from('platform_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await adminClient.from('platform_audit_logs').insert({
    platform_user_id: pu.id,
    action: 'platform_settings.update',
    entity_type: 'platform_settings',
    entity_id: key,
    new_data: { key, value },
    ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
  });

  return NextResponse.json({ success: true, data: setting });
}
