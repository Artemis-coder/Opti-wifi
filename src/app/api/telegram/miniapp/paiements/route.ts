/**
 * API de la Mini App « Paiement en ligne » : statut SasPay, bascule en ligne / manuel,
 * statistiques et transactions. Même logique que le menu du chat (lib/telegram-payment)
 * et le back-office (Moyens de paiement, Transactions).
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/neon/db';
import { authorizeMiniApp } from '@/lib/telegram-webapp';
import { changePaymentMode, getPaymentStatus } from '@/lib/telegram-payment';
import { OnlinePaymentError, syncOnlinePayment } from '@/lib/saspay/payments';
import { UUID_RE } from '@/lib/platform-actions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const denied = await authorizeMiniApp(request);
  if (denied) return denied;
  const view = new URL(request.url).searchParams.get('view') || 'overview';
  try {
    if (view === 'overview') {
      const [status, totals, daily, networks] = await Promise.all([
        getPaymentStatus(),
        query(
          `SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE status = 'succeeded')::int AS succeeded,
                  COUNT(*) FILTER (WHERE status IN ('failed', 'expired', 'cancelled'))::int AS failed,
                  COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
                  COALESCE(SUM(amount) FILTER (WHERE status = 'succeeded'), 0)::float AS amount
             FROM online_payments WHERE created_at > NOW() - interval '30 days'`
        ),
        query(
          `SELECT to_char(d, 'YYYY-MM-DD') AS day,
                  COUNT(op.id) FILTER (WHERE op.status = 'succeeded')::int AS succeeded,
                  COUNT(op.id) FILTER (WHERE op.status IN ('failed', 'expired', 'cancelled'))::int AS failed,
                  COUNT(op.id) FILTER (WHERE op.status = 'pending')::int AS pending,
                  COALESCE(SUM(op.amount) FILTER (WHERE op.status = 'succeeded'), 0)::float AS amount
             FROM generate_series(date_trunc('day', NOW()) - interval '29 days', date_trunc('day', NOW()), interval '1 day') d
             LEFT JOIN online_payments op ON date_trunc('day', op.created_at) = d
            GROUP BY d ORDER BY d`
        ),
        query(
          `SELECT COALESCE(network, 'Inconnu') AS network, COUNT(*)::int AS n
             FROM online_payments WHERE status = 'succeeded' AND created_at > NOW() - interval '30 days'
            GROUP BY 1 ORDER BY n DESC LIMIT 5`
        ),
      ]);
      return NextResponse.json({ status, totals: totals.rows[0], daily: daily.rows, networks: networks.rows });
    }
    if (view === 'transactions') {
      const { rows } = await query(
        `SELECT op.id, op.status, op.amount, op.currency, op.network, op.environment, op.failure_reason,
                op.subscription_id, op.created_at, op.paid_at, o.name AS organization_name, p.name AS plan_name
           FROM online_payments op
           JOIN organizations o ON o.id = op.organization_id
           LEFT JOIN subscription_plans p ON p.id = op.plan_id
          ORDER BY op.created_at DESC LIMIT 50`
      );
      return NextResponse.json({ payments: rows });
    }
    return NextResponse.json({ error: 'Vue inconnue.' }, { status: 400 });
  } catch (err) {
    console.error('Mini App paiements read error:', err);
    return NextResponse.json({ error: 'Lecture des paiements impossible.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await authorizeMiniApp(request);
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as { action?: string; mode?: string; id?: string } | null;
  try {
    if (body?.action === 'mode' && (body.mode === 'saspay' || body.mode === 'manual')) {
      const result = await changePaymentMode(body.mode, 'telegram-miniapp');
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
      return NextResponse.json({
        message: body.mode === 'saspay' ? 'Paiement en ligne activé pour les clients.' : 'Paiement manuel activé pour les clients.',
      });
    }
    if (body?.action === 'sync' && UUID_RE.test(String(body.id || ''))) {
      // Revérification auprès de SasPay : seule syncOnlinePayment() active une licence
      const row = await syncOnlinePayment(String(body.id));
      const labels: Record<string, string> = {
        succeeded: 'Paiement confirmé : licence activée.',
        pending: 'Toujours en attente chez SasPay.',
        failed: 'Paiement non abouti.',
        expired: 'Session de paiement expirée.',
        cancelled: 'Paiement annulé.',
      };
      return NextResponse.json({ message: labels[row.status] ?? `Statut : ${row.status}` });
    }
    return NextResponse.json({ error: 'Action invalide.' }, { status: 400 });
  } catch (err) {
    if (err instanceof OnlinePaymentError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('Mini App paiements action error:', err);
    return NextResponse.json({ error: "Erreur technique pendant l'action." }, { status: 500 });
  }
}
