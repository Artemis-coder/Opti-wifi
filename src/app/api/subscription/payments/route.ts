import { NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/tenant';
import { listOrganizationOnlinePayments } from '@/lib/saspay/payments';

// Historique des paiements en ligne de l'organisation (page Abonnement).
// Réservé à l'administrateur du client ; filtré par l'organisation de la session.
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (!ctx.organizationId || ctx.role !== 'administrateur') {
    return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 });
  }
  try {
    return NextResponse.json({ data: await listOrganizationOnlinePayments(ctx.organizationId) });
  } catch (err) {
    console.error('Subscription payments GET error:', err);
    return NextResponse.json({ error: 'Erreur lors du chargement des paiements' }, { status: 500 });
  }
}
