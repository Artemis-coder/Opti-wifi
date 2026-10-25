import { NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/tenant';
import { query } from '@/lib/neon/db';

// Enregistre l'abonnement push du navigateur courant pour l'utilisateur connecté.
export async function POST(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const endpoint: unknown = body?.endpoint;
  const p256dh: unknown = body?.keys?.p256dh;
  const auth: unknown = body?.keys?.auth;

  if (
    typeof endpoint !== 'string' || !endpoint.startsWith('https://') || endpoint.length > 1000 ||
    typeof p256dh !== 'string' || p256dh.length > 200 ||
    typeof auth !== 'string' || auth.length > 100
  ) {
    return NextResponse.json({ error: 'Abonnement invalide' }, { status: 400 });
  }

  try {
    // Un appareil appartient au dernier compte qui s'y est abonné
    await query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (endpoint) DO UPDATE
         SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, user_agent = EXCLUDED.user_agent`,
      [ctx.userId, endpoint, p256dh, auth, (request.headers.get('user-agent') || '').slice(0, 300)]
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Push subscription error:', err);
    return NextResponse.json({ error: "Erreur lors de l'enregistrement" }, { status: 500 });
  }
}

// Désabonnement de ce navigateur
export async function DELETE(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (typeof body?.endpoint !== 'string') {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }
  await query('DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2', [body.endpoint, ctx.userId]);
  return NextResponse.json({ success: true });
}
