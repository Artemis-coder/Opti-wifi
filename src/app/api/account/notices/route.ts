import { NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/tenant';
import { getAccountNotices } from '@/lib/account-notices';

// Avis du bandeau de l'espace client (profil à compléter, abonnement qui se termine…)
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (ctx.isPlatformAdmin || !ctx.organizationId) return NextResponse.json({ data: [] });
  try {
    const data = await getAccountNotices(ctx);
    return NextResponse.json({ data });
  } catch (err) {
    console.error('Account notices error:', err);
    return NextResponse.json({ data: [] });
  }
}
