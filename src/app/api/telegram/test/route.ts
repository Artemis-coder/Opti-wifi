import { NextResponse } from 'next/server';
import { testTelegramConnection } from '@/lib/telegram';
import { isInternalOrSuperAdmin } from '@/lib/telegram-auth';

export async function GET(request: Request) {
  if (!(await isInternalOrSuperAdmin(request))) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }
  const success = await testTelegramConnection();
  return NextResponse.json({
    ok: success,
    message: success ? 'Message de test envoyé !' : 'Échec - vérifiez TELEGRAM_BOT_TOKEN et TELEGRAM_CHAT_ID',
  });
}
