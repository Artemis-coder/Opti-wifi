import { NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/tenant';
import { exportFileName, exportOrganizationData } from '@/lib/account-deletion';

export const dynamic = 'force-dynamic';

// Téléchargement de toutes les données de l'espace (administrateur de l'espace), y compris si
// la licence a expiré : l'utilisateur garde le droit de récupérer ses données.
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx || !ctx.organizationId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (ctx.role !== 'administrateur') {
    return NextResponse.json({ error: "Seul l'administrateur de l'espace peut télécharger ses données." }, { status: 403 });
  }
  try {
    const data = await exportOrganizationData(ctx.organizationId);
    const name = (data.organization as { name?: string } | null)?.name || 'espace';
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${exportFileName(name)}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('Account export error:', err);
    return NextResponse.json({ error: "Erreur pendant l'export des données" }, { status: 500 });
  }
}
