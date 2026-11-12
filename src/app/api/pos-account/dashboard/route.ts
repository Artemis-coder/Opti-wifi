import { NextResponse } from 'next/server';
import { getSessionContext, isPosAccount } from '@/lib/tenant';
import { getPosAccountDashboard } from '@/lib/pos-account-dashboard';

// Accueil d'un compte point de vente : toujours limité au point de vente rattaché à la session.
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (!isPosAccount(ctx) || !ctx.organizationId || ctx.organizationBlocked) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }
  try {
    return NextResponse.json({ data: await getPosAccountDashboard(ctx.posId, ctx.organizationId) });
  } catch (err) {
    console.error('POS account dashboard error:', err);
    return NextResponse.json({ error: 'Erreur lors du chargement du tableau de bord' }, { status: 500 });
  }
}
