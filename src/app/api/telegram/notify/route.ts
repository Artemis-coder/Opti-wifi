import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramNotificationByType } from '@/lib/telegram';
import { isInternalOrSuperAdmin } from '@/lib/telegram-auth';

const TYPES = ['build', 'database', 'error', 'custom'];

// Envoi d'une notification Telegram : appels internes (Bearer CRON_SECRET) ou super admin uniquement.
export async function POST(request: NextRequest) {
  if (!(await isInternalOrSuperAdmin(request))) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }
  try {
    const body = await request.json();
    const { type, ...data } = body;
    if (!TYPES.includes(type)) {
      return NextResponse.json({ error: 'Type de notification inconnu' }, { status: 400 });
    }
    const success = await sendTelegramNotificationByType(type, data);
    return success
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: 'Échec envoi Telegram' }, { status: 500 });
  } catch (error) {
    console.error('Telegram notify error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
