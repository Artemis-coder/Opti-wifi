import { NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/tenant';
import { query } from '@/lib/neon/db';
import { createTicket, listTickets, parseNewTicket } from '@/lib/support';

// Tickets de support du client : ceux de son organisation, création d'un ticket.
// Ouvert même licence expirée ou client suspendu : c'est justement là qu'il a besoin d'aide.

async function authorName(userId: string): Promise<string> {
  const { rows } = await query('SELECT p.nom, u.email FROM users u LEFT JOIN profiles p ON p.id = u.id WHERE u.id = $1', [userId]);
  return rows[0]?.nom || rows[0]?.email || 'Client';
}

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (!ctx.organizationId) return NextResponse.json({ error: 'Aucune organisation associée' }, { status: 403 });
  try {
    return NextResponse.json({ data: await listTickets(ctx.organizationId) });
  } catch (err) {
    console.error('Support GET error:', err);
    return NextResponse.json({ error: 'Erreur lors du chargement des tickets' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (!ctx.organizationId) return NextResponse.json({ error: 'Aucune organisation associée' }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseNewTicket(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const result = await createTicket({
      organizationId: ctx.organizationId,
      authorUserId: ctx.userId,
      authorName: await authorName(ctx.userId),
      fromSupport: false,
      subject: parsed.subject,
      message: parsed.message,
      category: parsed.category,
      priority: 'normal',
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, data: result.data });
  } catch (err) {
    console.error('Support POST error:', err);
    return NextResponse.json({ error: "Erreur lors de l'envoi du ticket" }, { status: 500 });
  }
}
