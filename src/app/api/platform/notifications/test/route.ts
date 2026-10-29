import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/supabase/platform';
import { sendTestNotification } from '@/lib/notifications';
import { getTelegramBotInfo, isTelegramConfigured } from '@/lib/telegram';
import { hydrateTelegramEnv } from '@/lib/integration-secrets';

// Envoie une notification de test au super admin connecté sur chaque canal
// (in-app, push, Telegram) et renvoie l'état de chacun.
export async function POST() {
  await hydrateTelegramEnv();
  const auth = await requirePlatformAdmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const [bot, result] = await Promise.all([
      isTelegramConfigured() ? getTelegramBotInfo() : Promise.resolve({ ok: false, error: 'TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID manquant' }),
      sendTestNotification(auth.user.id),
    ]);
    return NextResponse.json({
      inApp: result.inApp,
      push: result.push,
      telegram: { ...result.telegram, bot: 'username' in bot ? bot.username : undefined, botError: bot.ok ? undefined : bot.error },
    });
  } catch (err) {
    console.error('Notification test error:', err);
    return NextResponse.json({ error: 'Erreur lors du test des notifications' }, { status: 500 });
  }
}
