import { NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/tenant';
import { UUID_RE } from '@/lib/platform-actions';
import { query } from '@/lib/neon/db';
import { syncOnlinePayment } from '@/lib/saspay/payments';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';

// Statut d'un paiement en ligne (page de retour après SasPay). Déclenche une vérification
// auprès de SasPay : la licence s'active ici si le webhook n'est pas encore arrivé.
// Un client ne voit que les paiements de son organisation.
export async function GET(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx?.organizationId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const ref = new URL(request.url).searchParams.get('ref') || '';
  if (!UUID_RE.test(ref)) return NextResponse.json({ error: 'Référence invalide' }, { status: 400 });

  const wait = rateLimit(`saspay-status:${ctx.userId}`, 60, 60_000);
  if (wait) return tooManyRequests(wait);

  const own = await query(`SELECT 1 FROM online_payments WHERE id = $1 AND organization_id = $2`, [ref, ctx.organizationId]);
  if (!own.rows[0]) return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 });

  try {
    const row = await syncOnlinePayment(ref);
    const plan = await query(`SELECT name FROM subscription_plans WHERE id = $1`, [row.plan_id]);
    const sub = row.subscription_id
      ? await query(`SELECT end_date FROM subscriptions WHERE id = $1`, [row.subscription_id])
      : { rows: [] as { end_date: string }[] };
    return NextResponse.json({
      data: {
        status: row.status,
        amount: Number(row.amount),
        currency: row.currency,
        plan_name: plan.rows[0]?.name ?? null,
        reference: row.transaction_reference,
        license_activated: Boolean(row.subscription_id),
        license_end_date: sub.rows[0]?.end_date ?? null,
        invoice_id: row.invoice_id,
        // Paiement reçu mais activation en échec : le support est prévenu
        needs_support: row.status === 'succeeded' && !row.subscription_id && Boolean(row.failure_reason),
        checkout_url: row.status === 'pending' ? row.checkout_url : null,
      },
    });
  } catch (err) {
    console.error('Online payment status error:', err);
    return NextResponse.json({ error: 'Vérification impossible pour le moment' }, { status: 500 });
  }
}
