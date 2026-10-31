import { NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/tenant';
import { getCollectorDashboard } from '@/lib/collector-dashboard';
import { parseDashboardPeriod } from '@/lib/client-dashboard';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Accueil du collecteur : toujours limité au collecteur de la session et à son organisation.
export async function GET(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (!ctx.organizationId || ctx.organizationBlocked) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

  const params = new URL(request.url).searchParams;
  const space = params.get('space');
  try {
    const data = await getCollectorDashboard(
      ctx.userId,
      ctx.organizationId,
      space && UUID_RE.test(space) ? space : null,
      parseDashboardPeriod(params.get('period')),
    );
    return NextResponse.json({ data });
  } catch (err) {
    console.error('Collector dashboard error:', err);
    return NextResponse.json({ error: 'Erreur lors du chargement de votre tournée' }, { status: 500 });
  }
}
