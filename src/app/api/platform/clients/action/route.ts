import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/supabase/platform';
import { setOrganizationStatus } from '@/lib/platform-actions';

export async function PATCH(request: Request) {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.status === 403 ? 'Accès refusé — droits super_admin requis' : auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const { organizationId, action, reason } = body as { organizationId?: string; action?: string; reason?: string };

  try {
    const result = await setOrganizationStatus({
      organizationId: organizationId || '',
      action: action || '',
      reason,
      platformUserId: auth.platformUser.id,
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, message: result.message, new_status: result.data.new_status, trial: result.data.trial });
  } catch (err) {
    console.error('Organization action error:', err);
    return NextResponse.json({ error: "Erreur lors de la mise à jour de l'organisation" }, { status: 500 });
  }
}
