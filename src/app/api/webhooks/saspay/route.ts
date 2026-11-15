import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { query } from '@/lib/neon/db';
import { verifySaspaySignature } from '@/lib/saspay/webhook';
import { syncOnlinePayment, syncPendingPayments } from '@/lib/saspay/payments';
import { reportSecurityEvent } from '@/lib/security-events';

// Webhook SasPay (configuré dans le tableau de bord SasPay : Développeur → Webhooks).
// Le contenu n'est jamais cru sur parole : il déclenche seulement une vérification auprès de
// SasPay (syncOnlinePayment). Réponse rapide (SasPay coupe à 15 s), traitement après la réponse.
export async function POST(request: Request) {
  // Corps BRUT : la signature est calculée dessus, octet par octet
  const raw = await request.text();
  const check = verifySaspaySignature(
    raw,
    request.headers.get('x-webhook-signature'),
    request.headers.get('x-webhook-timestamp'),
    process.env.SASPAY_WEBHOOK_SECRET?.trim()
  );

  let payload: { event?: unknown; data?: { id?: unknown } } | null = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = null;
  }
  const event = typeof payload?.event === 'string' ? payload.event.slice(0, 60) : request.headers.get('x-webhook-event')?.slice(0, 60) || 'inconnu';
  const transactionId = typeof payload?.data?.id === 'string' ? payload.data.id.slice(0, 64) : null;

  await query(
    `INSERT INTO saspay_webhook_events (event_type, transaction_id, signature_ok, payload) VALUES ($1, $2, $3, $4)`,
    [event, transactionId, check.ok, check.ok && payload ? JSON.stringify(payload) : null]
  ).catch((err) => console.error('SasPay webhook log error:', err));

  if (!check.ok) {
    if (check.reason === 'no_secret') {
      console.error('SasPay webhook reçu mais SASPAY_WEBHOOK_SECRET absent');
      return NextResponse.json({ error: 'Webhook non configuré' }, { status: 503 });
    }
    reportSecurityEvent({ type: 'webhook_bad_secret', request, detail: `Webhook SasPay refusé (${check.reason})` });
    return NextResponse.json({ error: 'Signature invalide' }, { status: 401 });
  }

  if (event.startsWith('transaction.')) {
    after(async () => {
      try {
        const known = transactionId
          ? await query(`SELECT id FROM online_payments WHERE transaction_id = $1`, [transactionId])
          : { rows: [] as { id: string }[] };
        if (known.rows[0]) await syncOnlinePayment(known.rows[0].id);
        // Transaction pas encore rattachée (cas normal au premier webhook) : on vérifie les paiements en attente
        else await syncPendingPayments({ maxAgeHours: 48, limit: 20 });
      } catch (err) {
        console.error('SasPay webhook processing error:', err);
      }
    });
  }
  return NextResponse.json({ received: true });
}
