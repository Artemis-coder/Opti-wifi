import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionContext } from '@/lib/tenant';
import { getAccountNotices } from '@/lib/account-notices';
import { AUTH_COOKIE_NAME, verifyToken } from '@/lib/neon/auth';

// Avis du bandeau de l'espace client (profil à compléter, abonnement qui se termine…).
// `session` identifie la connexion en cours (date d'émission du jeton) : un « Plus tard »
// ne vaut que pour cette connexion, le bandeau revient à chaque nouvelle connexion.
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (ctx.isPlatformAdmin || !ctx.organizationId) return NextResponse.json({ data: [], session: null });

  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  const payload = token ? (verifyToken(token) as { iat?: number } | null) : null;
  const session = payload?.iat ? `${ctx.userId}:${payload.iat}` : null;

  try {
    const data = await getAccountNotices(ctx);
    return NextResponse.json({ data, session });
  } catch (err) {
    console.error('Account notices error:', err);
    return NextResponse.json({ data: [], session });
  }
}
