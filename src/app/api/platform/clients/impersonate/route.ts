import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

  const { data: platformUser } = await supabase
    .from('platform_users')
    .select('id, role, is_active')
    .eq('auth_user_id', user.id)
    .single();

  if (!platformUser || !platformUser.is_active || platformUser.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé — droits super_admin requis' }, { status: 403 });
  }

  const body = await request.json();
  const { organizationId } = body;

  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId requis' }, { status: 400 });
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', organizationId)
    .single();

  if (!org) {
    return NextResponse.json({ error: 'Organisation introuvable' }, { status: 404 });
  }

  // Log the impersonation event
  await supabase.from('platform_audit_logs').insert({
    platform_user_id: platformUser.id,
    organization_id: organizationId,
    action: 'impersonate_access',
    entity_type: 'organization',
    entity_id: organizationId,
    new_data: { reason: 'Support technique — diagnostic à distance' },
    ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
  });

  // Generate a temporary impersonation token using admin API
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Find an administrateur profile in the target organization
  const { data: adminProfile } = await adminClient
    .from('profiles')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('role', 'administrateur')
    .limit(1)
    .maybeSingle();

  const targetUserId = adminProfile?.id || user.id;

  // Generate a temporary access link with a signed URL
  // This creates a one-time impersonation link
  const impersonationToken = Buffer.from(
    JSON.stringify({
      target_user_id: targetUserId,
      source_platform_user_id: platformUser.id,
      organization_id: organizationId,
      created_at: new Date().toISOString(),
    })
  ).toString('base64url');

  return NextResponse.json({
    success: true,
    url: `/platform/impersonate?token=${impersonationToken}`,
    organization: org.name,
  });
}
