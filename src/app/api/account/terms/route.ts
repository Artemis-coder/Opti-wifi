import { NextResponse } from 'next/server';
import { query } from '@/lib/neon/db';
import { getSessionContext } from '@/lib/tenant';
import { TERMS_VERSION } from '@/lib/terms';

export const dynamic = 'force-dynamic';

/**
 * Acceptation des conditions d'utilisation par le compte connecté (enregistrée à
 * l'inscription : version et date), et version en vigueur.
 */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const { rows } = await query(
    `SELECT user_metadata->>'terms_version' AS version, user_metadata->>'terms_accepted_at' AS accepted_at, created_at
       FROM users WHERE id = $1`,
    [ctx.userId]
  );
  const row = rows[0] || {};
  return NextResponse.json({
    data: {
      currentVersion: TERMS_VERSION,
      acceptedVersion: (row.version as string | null) ?? null,
      acceptedAt: (row.accepted_at as string | null) ?? null,
      accountCreatedAt: row.created_at ? new Date(row.created_at as string).toISOString() : null,
    },
  });
}
