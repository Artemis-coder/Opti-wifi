import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/supabase/platform';
import { query } from '@/lib/neon/db';
import { exportFileName, exportOrganizationData } from '@/lib/account-deletion';

export const dynamic = 'force-dynamic';

// Le super admin peut télécharger les données de l'espace avant de l'effacer.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const { rows } = await query(`SELECT organization_id, organization_name FROM account_deletion_requests WHERE id = $1`, [id]);
  const req = rows[0];
  if (!req?.organization_id) return NextResponse.json({ error: 'Données déjà supprimées ou demande introuvable' }, { status: 404 });
  try {
    const data = await exportOrganizationData(req.organization_id);
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${exportFileName(req.organization_name)}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('Deletion export error:', err);
    return NextResponse.json({ error: "Erreur pendant l'export" }, { status: 500 });
  }
}
