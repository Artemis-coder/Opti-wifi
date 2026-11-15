import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/supabase/platform';
import { query } from '@/lib/neon/db';
import { UUID_RE } from '@/lib/platform-actions';
import { getSaspayConfig } from '@/lib/saspay/client';
import { syncOnlinePayment } from '@/lib/saspay/payments';
import { getPaymentMode } from '@/lib/saspay/mode';

// Paiements en ligne SasPay (back-office) : état de la configuration, liste, revérification.

export async function GET() {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const [list, lastWebhook] = await Promise.all([
      query(
        `SELECT op.id, op.status, op.amount, op.currency, op.amount_charged, op.amount_net, op.network,
                op.environment, op.transaction_reference, op.failure_reason, op.subscription_id, op.invoice_id,
                op.created_at, op.paid_at, o.name AS organization_name, p.name AS plan_name
           FROM online_payments op
           JOIN organizations o ON o.id = op.organization_id
           LEFT JOIN subscription_plans p ON p.id = op.plan_id
          ORDER BY op.created_at DESC
          LIMIT 100`
      ),
      query(`SELECT event_type, signature_ok, received_at FROM saspay_webhook_events ORDER BY received_at DESC LIMIT 1`),
    ]);
    const config = getSaspayConfig();
    const mode = await getPaymentMode();
    return NextResponse.json({
      data: list.rows,
      config: {
        enabled: config.enabled,
        mode,
        environment: config.environment,
        problem: config.problem,
        has_webhook_secret: config.hasWebhookSecret,
        last_webhook: lastWebhook.rows[0] || null,
      },
    });
  } catch (err) {
    console.error('Online payments list error:', err);
    return NextResponse.json({ error: 'Erreur lors du chargement des paiements en ligne' }, { status: 500 });
  }
}

/** Revérifie un paiement auprès de SasPay (active la licence s'il est confirmé). */
export async function POST(request: Request) {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json().catch(() => ({}))) as { id?: unknown };
  const id = typeof body.id === 'string' ? body.id : '';
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Paiement invalide' }, { status: 400 });
  try {
    const row = await syncOnlinePayment(id);
    return NextResponse.json({ success: true, data: { status: row.status, subscription_id: row.subscription_id } });
  } catch (err) {
    console.error('Online payment resync error:', err);
    return NextResponse.json({ error: 'Vérification impossible' }, { status: 500 });
  }
}
