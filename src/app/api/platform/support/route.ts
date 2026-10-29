import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/supabase/platform';
import { createTicket, listTickets, parseNewTicket, ticketCounts } from '@/lib/support';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Support (super admin) : tous les tickets + compteurs, ouverture d'un ticket pour un client.
// Auparavant, toute personne connectée (y compris un client) pouvait lister tous les tickets.
export async function GET(request: Request) {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const status = new URL(request.url).searchParams.get('status');
    const [tickets, counts] = await Promise.all([listTickets(null, status), ticketCounts()]);
    return NextResponse.json({ data: tickets, counts });
  } catch (err) {
    console.error('Platform support GET error:', err);
    return NextResponse.json({ error: 'Erreur lors du chargement des tickets' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId : '';
  if (!UUID_RE.test(organizationId)) return NextResponse.json({ error: 'Choisissez le client concerné' }, { status: 400 });
  const parsed = parseNewTicket(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const result = await createTicket({
      organizationId,
      authorUserId: auth.user.id,
      authorName: auth.platformUser.full_name || 'Support OptiWifi',
      fromSupport: true,
      ...parsed,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, data: result.data });
  } catch (err) {
    console.error('Platform support POST error:', err);
    return NextResponse.json({ error: 'Erreur lors de la création du ticket' }, { status: 500 });
  }
}
