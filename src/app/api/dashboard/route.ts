import { NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/tenant';
import { getClientDashboard, parseDashboardPeriod } from '@/lib/client-dashboard';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Tableau de bord du client : toujours limité à l'organisation de la session.
export async function GET(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (!ctx.organizationId || ctx.organizationBlocked) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

  const params = new URL(request.url).searchParams;
  const space = params.get('space');
  try {
    const data = await getClientDashboard(
      ctx.organizationId,
      space && UUID_RE.test(space) ? space : null,
      parseDashboardPeriod(params.get('period')),
    );
    return NextResponse.json({ data });
  } catch (err) {
    console.error('Client dashboard error:', err);
    return NextResponse.json({ error: 'Erreur lors du chargement du tableau de bord' }, { status: 500 });
  }
}
