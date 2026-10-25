import { NextResponse, NextRequest } from 'next/server';
import { query } from '@/lib/neon/db';
import { getSessionContext, canAccessOrganization } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

// Informations de l'organisation : uniquement la sienne (ou toutes pour le super admin).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { id } = await params;
  if (!canAccessOrganization(ctx, id)) {
    return NextResponse.json({ error: 'Organisation introuvable' }, { status: 404 });
  }

  try {
    const { rows } = await query(
      'SELECT id, name, contact_name, email, phone, address, status, currency, created_at FROM organizations WHERE id = $1',
      [id]
    );
    if (!rows[0]) {
      return NextResponse.json({ error: 'Organisation introuvable' }, { status: 404 });
    }
    return NextResponse.json({ organization: rows[0] });
  } catch (err) {
    console.error('Organization fetch error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
