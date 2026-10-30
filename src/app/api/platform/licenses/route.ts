import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/supabase/platform';
import { activateLicense, UUID_RE } from '@/lib/platform-actions';
import { hasUsedTrialPlan } from '@/lib/trial-plan';

// Droit à l'essai gratuit d'une organisation (première souscription seulement)
export async function GET(request: Request) {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const organizationId = new URL(request.url).searchParams.get('organizationId') || '';
  if (!UUID_RE.test(organizationId)) return NextResponse.json({ error: 'Organisation invalide' }, { status: 400 });
  try {
    return NextResponse.json({ data: { trial_available: !(await hasUsedTrialPlan(organizationId)) } });
  } catch (err) {
    console.error('Trial availability error:', err);
    return NextResponse.json({ error: 'Erreur de vérification' }, { status: 500 });
  }
}

// Activation d'une licence : attribue un forfait pour une durée donnée à une organisation
// (règles et écritures dans activateLicense, partagé avec le bot Telegram).
export async function POST(request: Request) {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const { organizationId, planId, durationMonths, durationDays, trial, requestId, note } = body as {
    organizationId?: string;
    planId?: string;
    durationMonths?: number;
    durationDays?: number | null;
    trial?: boolean;
    requestId?: string | null;
    note?: string | null;
  };

  try {
    const result = await activateLicense({
      organizationId: organizationId || '',
      planId: planId || '',
      durationMonths: Number(durationMonths),
      durationDays: durationDays == null ? null : Number(durationDays),
      trial: typeof trial === 'boolean' ? trial : undefined,
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
