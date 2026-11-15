import { NextResponse } from 'next/server';
import { getSessionContext, POS_ACCOUNT_ROLE } from '@/lib/tenant';
import { UUID_RE } from '@/lib/platform-actions';
import { isOnlinePaymentOffered } from '@/lib/saspay/mode';
import { OnlinePaymentError, startOnlinePayment } from '@/lib/saspay/payments';
import { siteOrigin } from '@/lib/saspay/site-origin';
import { clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit';

// Paiement en ligne d'une licence (SasPay, page de paiement hébergée).
// GET : le paiement en ligne est-il proposé ? POST { planId } : crée la session et renvoie son URL.

function canPay(ctx: NonNullable<Awaited<ReturnType<typeof getSessionContext>>>): boolean {
  return Boolean(ctx.organizationId) && !ctx.organizationBlocked && ctx.role !== 'collecteur' && ctx.role !== POS_ACCOUNT_ROLE;
}

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  return NextResponse.json({ data: { enabled: canPay(ctx) && (await isOnlinePaymentOffered()) } });
}

export async function POST(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (!canPay(ctx)) return NextResponse.json({ error: 'Action non autorisée' }, { status: 403 });
  if (!(await isOnlinePaymentOffered())) {
    return NextResponse.json({ error: "Le paiement en ligne n'est pas disponible pour le moment." }, { status: 503 });
  }

  const wait = rateLimit(`saspay-checkout:${ctx.userId}`, 10, 10 * 60_000) || rateLimit(`saspay-checkout:ip:${clientIp(request)}`, 20, 10 * 60_000);
  if (wait) return tooManyRequests(wait);

  const body = (await request.json().catch(() => ({}))) as { planId?: unknown };
  const planId = typeof body.planId === 'string' ? body.planId : '';
  if (!UUID_RE.test(planId)) return NextResponse.json({ error: 'Forfait invalide' }, { status: 400 });

  try {
    const result = await startOnlinePayment({
      organizationId: ctx.organizationId!,
      userId: ctx.userId,
      planId,
      siteOrigin: siteOrigin(request),
    });
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof OnlinePaymentError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('Online payment start error:', err);
    return NextResponse.json({ error: 'Impossible de démarrer le paiement' }, { status: 500 });
  }
}
