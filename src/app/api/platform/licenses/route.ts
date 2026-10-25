import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/supabase/platform';
import { activateLicense } from '@/lib/platform-actions';

// Activation d'une licence : attribue un forfait pour une durée donnée à une organisation
// (règles et écritures dans activateLicense, partagé avec le bot Telegram).
export async function POST(request: Request) {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const { organizationId, planId, durationMonths, requestId, note } = body as {
    organizationId?: string;
    planId?: string;
    durationMonths?: number;
    requestId?: string | null;
    note?: string | null;
  };

  try {
    const result = await activateLicense({
      organizationId: organizationId || '',
      planId: planId || '',
      durationMonths: Number(durationMonths),
      requestId,
      note,
      platformUserId: auth.platformUser.id,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error, ...(result.code ? { code: result.code } : {}) }, { status: result.status });
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (err) {
    console.error('License activation error:', err);
    return NextResponse.json({ error: "Erreur lors de l'activation de la licence" }, { status: 500 });
  }
}
