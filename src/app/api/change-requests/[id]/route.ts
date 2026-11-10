import { NextResponse } from 'next/server';
import { query } from '@/lib/neon/db';
import { getSessionContext, rejectIfReadOnly } from '@/lib/tenant';
import { ChangeError, decideChangeRequest } from '@/lib/record-changes';

export const dynamic = 'force-dynamic';

/** Décision de l'administrateur : { action: 'approve' | 'reject', note } */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx || !ctx.organizationId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (ctx.role !== 'administrateur') return NextResponse.json({ error: "Seul l'administrateur valide les corrections." }, { status: 403 });
  const readOnly = await rejectIfReadOnly(ctx);
  if (readOnly) return readOnly;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { action?: string; note?: string };
  if (body.action !== 'approve' && body.action !== 'reject') return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) || null : null;
  try {
    const result = await decideChangeRequest(ctx, id, body.action, note);
    return NextResponse.json({
      ...result,
      message: result.status === 'approved' ? 'Correction validée et appliquée.' : 'Correction refusée.',
    });
  } catch (err) {
    if (err instanceof ChangeError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('Change request decision error:', err);
    return NextResponse.json({ error: 'Erreur lors de la validation.' }, { status: 500 });
  }
}

/** Le collecteur annule sa propre demande en attente */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx || !ctx.organizationId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const { id } = await params;
  const { rows } = await query(
    `UPDATE change_requests SET status = 'cancelled', reviewed_at = NOW()
      WHERE id = $1 AND organization_id = $2 AND requested_by = $3 AND status = 'pending' RETURNING id`,
    [id, ctx.organizationId, ctx.userId]
  );
  if (!rows[0]) return NextResponse.json({ error: 'Demande introuvable ou déjà traitée.' }, { status: 404 });
  return NextResponse.json({ success: true });
}
