import { NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/tenant';
import { query } from '@/lib/neon/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Notifications de l'utilisateur connecté (client ou super admin) + nombre de non-lues.
export async function GET(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const limit = Math.min(50, Math.max(1, Number(new URL(request.url).searchParams.get('limit')) || 20));
  try {
    const [list, unread] = await Promise.all([
      query(
        `SELECT id, type, title, body, link, read_at, created_at
           FROM notifications WHERE user_id = $1
          ORDER BY created_at DESC LIMIT $2`,
        [ctx.userId, limit]
      ),
      query('SELECT COUNT(*) AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL', [ctx.userId]),
    ]);
    return NextResponse.json({ data: list.rows, unread: Number(unread.rows[0]?.n || 0) });
  } catch (err) {
    console.error('Notifications GET error:', err);
    return NextResponse.json({ error: 'Erreur lors du chargement des notifications' }, { status: 500 });
  }
}

// Marquer comme lues : { ids: [...] } ou { all: true }
export async function PATCH(request: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { ids, all } = body as { ids?: string[]; all?: boolean };

  try {
    if (all === true) {
      await query('UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL', [ctx.userId]);
    } else if (Array.isArray(ids) && ids.length > 0 && ids.length <= 100 && ids.every((id) => UUID_RE.test(id))) {
      await query(
        'UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND id = ANY($2::uuid[]) AND read_at IS NULL',
        [ctx.userId, ids]
      );
    } else {
      return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Notifications PATCH error:', err);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 });
  }
}
