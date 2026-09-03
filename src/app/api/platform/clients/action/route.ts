import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

  const { data: platformUser, error: puError } = await supabase
    .from('platform_users')
    .select('id, role, is_active')
    .eq('auth_user_id', user.id)
    .single();

  if (puError || !platformUser || !platformUser.is_active || platformUser.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé — droits super_admin requis' }, { status: 403 });
  }

  const body = await request.json();
  const { organizationId, action, reason } = body;

  if (!organizationId || !action) {
    return NextResponse.json({ error: 'organizationId et action requis' }, { status: 400 });
  }

  const { data: org, error: fetchError } = await supabase
    .from('organizations')
    .select('id, name, status')
    .eq('id', organizationId)
    .single();

  if (fetchError || !org) {
    return NextResponse.json({ error: 'Organisation introuvable' }, { status: 404 });
  }

  let newStatus: string;
  const validActions = ['activate', 'suspend', 'reactivate', 'cancel'];

  if (!validActions.includes(action)) {
    return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
  }

  switch (action) {
    case 'activate':
      newStatus = 'active';
      break;
    case 'suspend':
      newStatus = 'suspended';
      break;
    case 'reactivate':
      newStatus = 'active';
      break;
    case 'cancel':
      newStatus = 'cancelled';
      break;
    default:
      return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from('organizations')
    .update({ status: newStatus as never, updated_at: new Date().toISOString() })
    .eq('id', organizationId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Log to platform_audit_logs
  await supabase.from('platform_audit_logs').insert({
    platform_user_id: platformUser.id,
    organization_id: organizationId,
    action: `organization.${action}`,
    entity_type: 'organization',
    entity_id: organizationId,
    old_data: { status: org.status },
    new_data: { status: newStatus, reason: reason || null },
    ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
  });

  return NextResponse.json({
    success: true,
    message: `Organisation "${org.name}" ${action} — nouveau statut: ${newStatus}`,
    new_status: newStatus,
  });
}
