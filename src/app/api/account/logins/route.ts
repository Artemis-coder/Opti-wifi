import { NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/tenant';
import { getLoginHistory } from '@/lib/login-history';

export const dynamic = 'force-dynamic';

/** Dernières connexions du compte connecté (appareil, adresse IP, lieu approximatif). */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const data = await getLoginHistory(ctx.userId);
  return NextResponse.json({ data });
}
