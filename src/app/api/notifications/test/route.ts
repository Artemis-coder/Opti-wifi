import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { getSessionContext } from '@/lib/tenant';
import { notifyUsers } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

const DELAY_MS = 10_000;

/**
 * « Tester la sonnerie » (Paramètres > Notifications) : envoie une notification au compte
 * connecté 10 secondes plus tard, le temps de verrouiller le téléphone. Une par 30 secondes.
 */
export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  const userId = ctx.userId;
  const slot = Math.floor(Date.now() / 30_000);
  after(async () => {
    await new Promise((r) => setTimeout(r, DELAY_MS));
    await notifyUsers([userId], {
      type: 'system.test',
      title: 'Test de sonnerie',
      body: 'Si votre téléphone a sonné, les notifications fonctionnent sur cet appareil.',
      link: '/settings?tab=notifications',
      dedupeKey: `ring-test:${slot}`,
      ring: true,
    });
  });
  return NextResponse.json({ success: true, delaySeconds: DELAY_MS / 1000 });
}
