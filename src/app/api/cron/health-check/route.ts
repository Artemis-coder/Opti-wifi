import { NextRequest, NextResponse } from 'next/server';
import { checkAndRecord } from '@/lib/system-health';
import { recordCronRun } from '@/lib/system-errors';

export const maxDuration = 30;

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.optiwifi.site').replace(/\/$/, '');

// Contrôle de santé (cron Vercel quotidien ; peut aussi être appelé toutes les 5 minutes par un
// service de surveillance externe, avec l'en-tête Authorization: Bearer CRON_SECRET).
// Enregistre l'historique et prévient le super admin uniquement quand un état change.
export async function GET(request: NextRequest) {
  const CRON_SECRET = process.env.CRON_SECRET;

  // Fail closed: if no CRON_SECRET configured, always deny
  if (!CRON_SECRET) {
    return NextResponse.json({ error: 'Endpoint non configuré.' }, { status: 503 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    // Marquée comme lancée avant le contrôle, qui vérifie aussi les tâches planifiées
    await recordCronRun('health-check', true, 'En cours', startedAt);
    const health = await checkAndRecord(SITE, 'cron');
    await recordCronRun('health-check', true, health.overall === 'ok' ? 'Tout est opérationnel' : 'Points à vérifier', startedAt);
    // Never expose diagnostic details in cron responses
    return NextResponse.json({ ok: true, overall: health.overall });
  } catch (error) {
    await recordCronRun('health-check', false, error instanceof Error ? error.message : 'Erreur', startedAt);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
