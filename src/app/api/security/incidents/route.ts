import { NextResponse } from 'next/server';
import { authorizeSecurityAccess } from '@/lib/security-agent-auth';
import { incidentEvents, listIncidents, securitySummary } from '@/lib/security-events';

// Liste des incidents de sécurité (tâches) : super admin ou agent de sécurité.
// ?status=open,in_progress (défaut) | resolved | ignored · ?events=1 ajoute les derniers signaux.
export async function GET(request: Request) {
  const actor = await authorizeSecurityAccess(request);
  if (!actor) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

  const url = new URL(request.url);
  const status = (url.searchParams.get('status') || 'open,in_progress').split(',').filter(Boolean);
  const incidents = await listIncidents({ status, limit: Number(url.searchParams.get('limit')) || 50 });
  const withEvents = url.searchParams.get('events') === '1';
  const data = withEvents
    ? await Promise.all(incidents.map(async (i) => ({ ...i, events: await incidentEvents(i.id, 20) })))
    : incidents;
  return NextResponse.json({ summary: await securitySummary(24), incidents: data });
}
