import { NextResponse } from 'next/server';
import { isDevAgentRequest } from '@/lib/dev-agent-auth';
import { runSystemHealth } from '@/lib/system-health';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.optiwifi.site').replace(/\/$/, '');

// Bilan de santé pour la routine « diagnostic technique » (jeton DEV_AGENT_TOKEN) : composants en
// anomalie et erreurs récentes. La sécurité est exclue (l'agent de sécurité s'en occupe).
export async function GET(request: Request) {
  if (!isDevAgentRequest(request)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  const health = await runSystemHealth(SITE);
  const components = health.components
    .filter((c) => c.id !== 'security')
    .map((c) => ({ id: c.id, label: c.label, status: c.status, summary: c.summary, problems: c.checks.filter((k) => k.status !== 'ok') }));
  const broken = components.filter((c) => c.status !== 'ok');
  return NextResponse.json({
    checked_at: health.checked_at,
    overall: broken.length ? (broken.some((c) => c.status === 'error') ? 'error' : 'warning') : 'ok',
    components: broken,
    ok_components: components.filter((c) => c.status === 'ok').map((c) => c.label),
    recent_errors: health.recent_errors.slice(0, 30).map((er) => ({ ...er, message: String(er.message).slice(0, 500) })),
  });
}
