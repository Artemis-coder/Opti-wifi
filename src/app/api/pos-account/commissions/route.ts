import { NextResponse } from 'next/server';
import { getSessionContext, isPosAccount } from '@/lib/tenant';
import { getPosAccountCommissions, parseCommissionPeriod } from '@/lib/pos-account-commissions';

// « Mes commissions » d'un compte point de vente : toujours limité au point de vente de la session.
export async function GET(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (!isPosAccount(ctx) || !ctx.organizationId || ctx.organizationBlocked) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }
  const period = parseCommissionPeriod(new URL(request.url).searchParams.get('period'));
  try {
    return NextResponse.json({ data: await getPosAccountCommissions(ctx.posId, ctx.organizationId, period) });
  } catch (err) {
    console.error('POS account commissions error:', err);
    return NextResponse.json({ error: 'Erreur lors du chargement des commissions' }, { status: 500 });
  }
}
