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
  const searchFilter = searchParams.get('search');

  let query = adminClient
    .from('profiles')
    .select('*, organization:organizations(name, status)')
    .order('created_at', { ascending: false });

  if (orgFilter) {
    query = query.eq('organization_id', orgFilter);
  }

  if (searchFilter) {
    query.or(`nom.ilike.%${searchFilter}%,email.ilike.%${searchFilter}%`);
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

  const { data: pu } = await supabase
    .from('platform_users')
    .select('id, role, is_active')
    .eq('auth_user_id', user.id)
    .single();

  if (!pu || !pu.is_active || pu.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé — droits super_admin requis' }, { status: 403 });
  }

  const body = await request.json();
  const { email, nom, password, organization_id, role = 'administrateur', telephone, devise } = body;

  if (!email || !nom) {
    return NextResponse.json({ error: 'Email et nom requis.' }, { status: 400 });
  }

  if (!organization_id) {
    return NextResponse.json({ error: 'Organization requise.' }, { status: 400 });
  }

  if (!['administrateur', 'collecteur'].includes(role)) {
    return NextResponse.json({ error: 'Role invalide.' }, { status: 400 });
  }

  const adminClient = createAdminClient();

  const plainPassword = password || `OptiWifi_${crypto.randomUUID().slice(0, 12)}!`;

  const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
    email: email.toLowerCase(),
    password: plainPassword,
    email_confirm: true,
    user_metadata: {
      role,
      nom,
      telephone: telephone || null,
      devise: devise || 'XOF',
      organization_id,
    },
  });

  if (createError || !createdUser?.user) {
    return NextResponse.json({ error: createError?.message || 'Erreur création utilisateur.' }, { status: 500 });
  }

  const newUserId = createdUser.user.id;

  const { error: profileError } = await adminClient
    .from('profiles')
    .insert({
      id: newUserId,
      nom,
      email: email.toLowerCase(),
      role,
      telephone: telephone || null,
      devise: devise || 'XOF',
      organization_id,
      is_active: true,
    });

  if (profileError) {
    await adminClient.auth.admin.deleteUser(newUserId);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  await adminClient.from('platform_audit_logs').insert({
    platform_user_id: pu.id,
    action: 'user.create',
    entity_type: 'profile',
    entity_id: newUserId,
    new_data: { email: email.toLowerCase(), nom, role, organization_id, is_active: true },
    ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
  });

  return NextResponse.json({
    success: true,
    message: `Administrateur "${nom}" créé avec succès.`,
    data: { id: newUserId, email: email.toLowerCase(), role },
    temporary_password: !password ? plainPassword : undefined,
  });
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

    case 'change_role': {
      const { role: newRole, organization_id } = body;
      if (!newRole || !['administrateur', 'collecteur'].includes(newRole)) {
        return NextResponse.json({ error: 'Rôle invalide.' }, { status: 400 });
      }

      const { data: existingProfile, error: profileErr } = await adminClient
        .from('profiles')
        .select('role, organization_id, email, nom, telephone, devise')
        .eq('id', userId)
        .single();

      if (profileErr || !existingProfile) {
        return NextResponse.json({ error: 'Profil introuvable.' }, { status: 404 });
      }

      const oldRole = existingProfile.role;
      const oldOrgId = existingProfile.organization_id;
      const oldData = { role: oldRole, organization_id: oldOrgId, email: existingProfile.email };

      const { data: authUsers } = await adminClient.auth.admin.listUsers();
      const existingUser = authUsers?.users?.find((u: any) => u.id === userId);
      const existingMetadata = existingUser?.user_metadata || {};

      const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
        user_metadata: { ...existingMetadata, role: newRole, ...(organization_id ? { organization_id } : {}) },
        app_metadata: { role: newRole },
      });
      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 500 });
      }

      const { error: updateError } = await adminClient
        .from('profiles')
        .update({ role: newRole, ...(organization_id ? { organization_id } : {}) })
        .eq('id', userId);
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      await adminClient.from('platform_audit_logs').insert({
        platform_user_id: pu.id,
        action: 'user.change_role',
        entity_type: 'profile',
        entity_id: userId,
        old_data: oldData,
        new_data: { role: newRole, organization_id: organization_id ?? oldOrgId, email: existingProfile.email },
        ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      });

      return NextResponse.json({
        success: true,
        message: `Rôle mis à jour : ${newRole}.`,
        data: { id: userId, role: newRole, organization_id: organization_id ?? oldOrgId },
      });
    }

    default:
      return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
  }
}
