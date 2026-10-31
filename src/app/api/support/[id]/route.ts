import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/tenant';
import { query } from '@/lib/neon/db';
import { addMessage, getTicket } from '@/lib/support';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Ticket du client (même organisation) : lecture du fil et réponse.
async function loadOwnTicket(params: Promise<{ id: string }>) {
  const ctx = await getSessionContext();
  if (!ctx) return { error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) } as const;
  const { id } = await params;
  if (!UUID_RE.test(id)) return { error: NextResponse.json({ error: 'Ticket introuvable' }, { status: 404 }) } as const;
  const data = await getTicket(id);
  // Même réponse qu'un ticket inexistant : ne révèle pas les tickets des autres clients
  // Un collecteur n'accède qu'aux tickets qu'il a ouverts
  if (
    !data ||
    !ctx.organizationId ||
    data.ticket.organization_id !== ctx.organizationId ||
    (ctx.role !== 'administrateur' && data.ticket.created_by !== ctx.userId)
  ) {
    return { error: NextResponse.json({ error: 'Ticket introuvable' }, { status: 404 }) } as const;
  }
  return { ctx, id, data } as const;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const r = await loadOwnTicket(params);
    if ('error' in r) return r.error;
    return NextResponse.json({ data: r.data });
  } catch (err) {
    console.error('Support ticket GET error:', err);
    return NextResponse.json({ error: 'Erreur lors du chargement du ticket' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const r = await loadOwnTicket(params);
    if ('error' in r) return r.error;
    const body = (await request.json().catch(() => ({}))) as { message?: string };
    const { rows } = await query('SELECT p.nom, u.email FROM users u LEFT JOIN profiles p ON p.id = u.id WHERE u.id = $1', [
      r.ctx.userId,
    ]);
    const result = await addMessage({
      ticketId: r.id,
      authorUserId: r.ctx.userId,
      authorName: rows[0]?.nom || rows[0]?.email || 'Client',
      fromSupport: false,
      body: typeof body.message === 'string' ? body.message : '',
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, data: result.data });
  } catch (err) {
    console.error('Support reply error:', err);
    return NextResponse.json({ error: "Erreur lors de l'envoi de la réponse" }, { status: 500 });
  }
}
