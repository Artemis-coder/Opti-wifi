import { NextResponse } from 'next/server';
import { query } from '@/lib/neon/db';
import { getSessionContext } from '@/lib/tenant';

// État de connexion des membres de l'équipe : dernière connexion, mot de passe temporaire
// encore à changer (accès pas encore utilisés). Réservé à l'administrateur.
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  if (ctx.role !== 'administrateur' || !ctx.organizationId) return NextResponse.json({ data: [] });
  const { rows } = await query(
    `SELECT p.id, u.last_sign_in_at,
            COALESCE((u.app_metadata ->> 'must_change_password')::boolean, false) AS pending_password
       FROM profiles p JOIN users u ON u.id = p.id
      WHERE p.organization_id = $1`,
    [ctx.organizationId]
  );
  return NextResponse.json({ data: rows });
}
