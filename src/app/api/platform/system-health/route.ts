import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/supabase/platform';
import { checkAndRecord, healthHistory, lastStoredHealth } from '@/lib/system-health';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

// État du système (super admin) : contrôles en direct + historique.
// ?summary=1 : carte du tableau de bord — dernier contrôle enregistré, refait s'il date de plus
// de 10 minutes.
// ?hours=24|168 : période de l'historique.
export async function GET(request: Request) {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const url = new URL(request.url);
  try {
    if (url.searchParams.get('summary') === '1') {
      const last = await lastStoredHealth();
      if (last && Date.now() - new Date(last.checked_at).getTime() < 10 * 60 * 1000) return NextResponse.json({ data: last });
      const fresh = await checkAndRecord(url.origin, 'manual');
      return NextResponse.json({
        data: {
          checked_at: fresh.checked_at,
          overall: fresh.overall,
          components: fresh.components.map((c) => ({ id: c.id, status: c.status, summary: c.summary })),
        },
      });
    }
    const hours = url.searchParams.get('hours') === '168' ? 168 : 24;
    const [health, history] = await Promise.all([checkAndRecord(url.origin, 'manual'), healthHistory(hours)]);
    return NextResponse.json({ data: health, history });
  } catch (err) {
    console.error('System health error:', err);
    return NextResponse.json({ error: 'Erreur pendant le contrôle' }, { status: 500 });
  }
}
