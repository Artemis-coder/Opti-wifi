import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/supabase/platform';
import { query } from '@/lib/neon/db';
import { getSaspayConfig } from '@/lib/saspay/client';
import { getPaymentMode, setPaymentMode, type PaymentMode } from '@/lib/saspay/mode';

// Interrupteur du super admin : paiement en ligne SasPay ou paiement manuel.
async function state() {
  const mode = await getPaymentMode();
  const config = getSaspayConfig();
  return {
    mode,
    saspay: { configured: config.enabled, environment: config.environment, problem: config.problem },
    // Ce que voient réellement les clients
    effective: mode === 'saspay' && config.enabled ? 'saspay' : 'manual',
  };
}

export async function GET() {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json({ data: await state() });
}

export async function PUT(request: Request) {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json().catch(() => ({}))) as { mode?: unknown };
  if (body.mode !== 'saspay' && body.mode !== 'manual') {
    return NextResponse.json({ error: 'Mode invalide' }, { status: 400 });
  }
  const previous = await getPaymentMode();
  await setPaymentMode(body.mode as PaymentMode);
  await query(
    `INSERT INTO platform_audit_logs (platform_user_id, action, entity_type, old_data, new_data)
     VALUES ($1, 'payment_mode_changed', 'platform_settings', $2, $3)`,
    [auth.platformUser.id, JSON.stringify({ mode: previous }), JSON.stringify({ mode: body.mode })]
  ).catch((err) => console.error('payment_mode audit error:', err));
  return NextResponse.json({ success: true, data: await state() });
}
