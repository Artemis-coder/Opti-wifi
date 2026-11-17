import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/tenant';
import { UUID_RE } from '@/lib/platform-actions';
import { getOrganizationOnlinePayment, syncOnlinePayment } from '@/lib/saspay/payments';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';

// Détail d'un paiement en ligne de l'organisation (administrateur du client uniquement).
// ?verify=1 sur un paiement en attente : revérifie auprès de SasPay (la licence s'active si confirmé).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (!ctx.organizationId || ctx.role !== 'administrateur') {
    return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 });

  try {
    let payment = await getOrganizationOnlinePayment(ctx.organizationId, id);
    // Même réponse qu'un paiement inexistant : ne révèle pas les paiements des autres clients
    if (!payment) return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 });

    const verify = request.nextUrl.searchParams.get('verify') === '1';
    if (verify && payment.status === 'pending') {
      // Même limite que la page de retour SasPay
      const wait = rateLimit(`saspay-status:${ctx.userId}`, 60, 60_000);
      if (wait) return tooManyRequests(wait);
      await syncOnlinePayment(id);
      payment = await getOrganizationOnlinePayment(ctx.organizationId, id);
      if (!payment) return NextResponse.json({ error: 'Paiement introuvable' }, { status: 404 });
    }
    return NextResponse.json({ data: payment });
  } catch (err) {
    console.error('Subscription payment GET error:', err);
    return NextResponse.json({ error: 'Vérification impossible pour le moment' }, { status: 500 });
  }
}
