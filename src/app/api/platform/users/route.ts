import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/neon/admin';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

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
    .select('role, is_active')
    .eq('auth_user_id', user.id)
    .single();

  if (!platformUser || !platformUser.is_active) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const adminClient = createAdminClient();

  const { searchParams } = new URL(request.url);
  const orgFilter = searchParams.get('org');

  let query = adminClient
    .from('profiles')
    .select('*, organization:organizations(name, status)')
    .order('created_at', { ascending: false });

  if (orgFilter) {
    query = query.eq('organization_id', orgFilter);
  }

  const { data: users, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch auth user status (banned or not)
  const { data: authUsersData } = await adminClient.auth.admin.listUsers();
  const authUserMap = new Map();
  authUsersData?.users?.forEach((au: { id: string; banned_until?: string | null }) => {
    const isBanned = au.banned_until ? new Date(au.banned_until) > new Date() : false;
    authUserMap.set(au.id, isBanned);
  });

  const enrichedUsers = (users || []).map((u: Record<string, unknown>) => ({
    ...u,
    is_banned: authUserMap.get((u as { id: string }).id) || false,
  }));

  return NextResponse.json({ data: enrichedUsers });
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
    return NextResponse.json({ error: 'Accès refusé — droits super_admin requis' }, { status: 403 });
  }

  const body = await request.json();
  const { userId, action } = body;

  if (!userId || !action) {
    return NextResponse.json({ error: 'userId et action requis' }, { status: 400 });
  }

  const adminClient = createAdminClient();

  switch (action) {
    case 'deactivate': {
      const { data: authData, error: authError } = await adminClient.auth.admin.updateUserById(
        userId,
        { ban_duration: '876000h' }
      );
      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 500 });
      }
      await adminClient.from('platform_audit_logs').insert({
        platform_user_id: pu.id,
        action: 'user.deactivate',
        entity_type: 'profile',
        entity_id: userId,
        new_data: { banned: true },
        ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      });
      return NextResponse.json({ success: true, message: 'Utilisateur désactivé.', data: authData });
    }

    case 'activate': {
      const { data: authData, error: authError } = await adminClient.auth.admin.updateUserById(
        userId,
        { ban_duration: 'none' }
      );
      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 500 });
      }
      await adminClient.from('platform_audit_logs').insert({
        platform_user_id: pu.id,
        action: 'user.activate',
        entity_type: 'profile',
        entity_id: userId,
        new_data: { banned: false },
        ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      });
      return NextResponse.json({ success: true, message: 'Utilisateur activé.', data: authData });
    }

    case 'reset_password': {
      const { data: profile } = await adminClient
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .single();

      if (!profile) {
        return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });
      }

      const { error: resetError } = await adminClient.auth.admin.generateLink({
        type: 'recovery',
        email: profile.email,
      });

      if (resetError) {
        return NextResponse.json({ error: resetError.message }, { status: 500 });
      }

      await adminClient.from('platform_audit_logs').insert({
        platform_user_id: pu.id,
        action: 'user.reset_password',
        entity_type: 'profile',
        entity_id: userId,
        new_data: { reset_link_sent: true, email: profile.email },
        ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      });

      return NextResponse.json({ success: true, message: 'Lien de réinitialisation envoyé par email.' });
    }

    default:
      return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
  }
}
