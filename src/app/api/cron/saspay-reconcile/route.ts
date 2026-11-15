import { NextResponse } from 'next/server';
import { getSaspayConfig } from '@/lib/saspay/client';
import { syncPendingPayments } from '@/lib/saspay/payments';
import { reportSecurityEvent } from '@/lib/security-events';
import { recordCronRun } from '@/lib/system-errors';

// Filet de sécurité : revérifie les paiements en ligne restés en attente (webhook perdu,
// client qui a fermé l'onglet avant le retour). Voir vercel.json.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'Endpoint non configuré.' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    reportSecurityEvent({ type: 'webhook_bad_secret', request, detail: 'Cron SasPay appelé sans le bon secret' });
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }
  if (!getSaspayConfig().enabled) return NextResponse.json({ skipped: true, reason: 'SasPay désactivé' });

  const startedAt = Date.now();
  try {
    const result = await syncPendingPayments({ maxAgeHours: 72, limit: 100 });
    await recordCronRun('saspay-reconcile', true, `${result.checked} vérifié(s), ${result.succeeded} confirmé(s)`, startedAt);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error('SasPay reconcile error:', err);
    await recordCronRun('saspay-reconcile', false, err instanceof Error ? err.message : 'Erreur', startedAt);
    return NextResponse.json({ error: 'Échec de la vérification' }, { status: 500 });
  }
}
