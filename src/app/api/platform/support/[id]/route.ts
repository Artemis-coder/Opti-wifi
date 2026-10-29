import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/supabase/platform';
import { addMessage, getTicket, updateTicket } from '@/lib/support';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Ticket (super admin) : lecture du fil, réponse du support, statut et priorité.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Ticket introuvable' }, { status: 404 });
  try {
    const data = await getTicket(id);
    if (!data) return NextResponse.json({ error: 'Ticket introuvable' }, { status: 404 });
    return NextResponse.json({ data });
  } catch (err) {
    console.error('Platform ticket GET error:', err);
    return NextResponse.json({ error: 'Erreur lors du chargement du ticket' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Ticket introuvable' }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as { message?: string };
  try {
    const result = await addMessage({
      ticketId: id,
      authorUserId: auth.user.id,
      authorName: auth.platformUser.full_name || 'Support OptiWifi',
      fromSupport: true,
      body: typeof body.message === 'string' ? body.message : '',
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, data: result.data });
  } catch (err) {
    console.error('Platform ticket reply error:', err);
    return NextResponse.json({ error: "Erreur lors de l'envoi de la réponse" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Ticket introuvable' }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as { status?: string; priority?: string };
  try {
    const result = await updateTicket({ ticketId: id, status: body.status, priority: body.priority });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, data: result.data });
  } catch (err) {
    console.error('Platform ticket PATCH error:', err);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour du ticket' }, { status: 500 });
  }
}
