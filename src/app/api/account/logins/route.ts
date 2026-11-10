import { NextResponse } from 'next/server';
import { query } from '@/lib/neon/db';
import { getSessionContext } from '@/lib/tenant';
import { getLoginHistory } from '@/lib/login-history';

export const dynamic = 'force-dynamic';

/**
 * Dernières connexions du compte connecté (appareil, adresse IP, lieu approximatif), et la
 * date de dernière connexion connue du compte (connexions antérieures à l'historique).
 */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const [data, user] = await Promise.all([
    getLoginHistory(ctx.userId),
    query(`SELECT last_sign_in_at FROM users WHERE id = $1`, [ctx.userId]),
  ]);
  const last = user.rows[0]?.last_sign_in_at as string | null | undefined;
  return NextResponse.json({ data, lastSignInAt: last ? new Date(last).toISOString() : null });
}
