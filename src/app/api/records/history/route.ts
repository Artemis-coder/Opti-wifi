import { NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/tenant';
import { ChangeError, getRecordHistory } from '@/lib/record-changes';

export const dynamic = 'force-dynamic';

// Historique d'une collecte ou d'une allocation : ?type=collection|allocation&id=…
export async function GET(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx || !ctx.organizationId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const id = url.searchParams.get('id') || '';
  if (type !== 'collection' && type !== 'allocation') return NextResponse.json({ error: 'Type invalide' }, { status: 400 });
  try {
    return NextResponse.json({ data: await getRecordHistory(ctx, type, id) });
  } catch (err) {
    if (err instanceof ChangeError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error('Record history error:', err);
    return NextResponse.json({ error: "Erreur lors du chargement de l'historique" }, { status: 500 });
  }
}
