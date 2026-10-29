import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/supabase/platform';
import { query } from '@/lib/neon/db';
import { registerTelegramWebhook, WEBHOOK_PATH } from '@/lib/bot-health';
import {
  botTokenFromVercel,
  clearTelegramSetting,
  generateWebhookSecret,
  hydrateTelegramEnv,
  saveTelegramSetting,
  telegramConfigSources,
  type TelegramKey,
} from '@/lib/integration-secrets';

export const maxDuration = 30;

// Configuration du bot Telegram (super admin). Les valeurs ne sont jamais renvoyées :
// seulement leur origine (interface / Vercel), le nom du bot et l'adresse du webhook.

const TOKEN_RE = /^\d{6,12}:[A-Za-z0-9_-]{30,}$/;
const SECRET_RE = /^[A-Za-z0-9_-]{32,256}$/;
const CHAT_RE = /^-?\d{3,20}$/;
const KEYS: Record<string, TelegramKey> = { token: 'TELEGRAM_BOT_TOKEN', secret: 'TELEGRAM_WEBHOOK_SECRET', chat: 'TELEGRAM_CHAT_ID' };

async function telegram(token: string, method: string) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
  return (await res.json().catch(() => ({}))) as { ok?: boolean; result?: Record<string, unknown>; description?: string };
}

async function state(origin: string) {
  await hydrateTelegramEnv();
  const sources = await telegramConfigSources();
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  let bot: string | null = null;
  let webhookHost: string | null = null;
  if (token) {
    const [me, info] = await Promise.all([telegram(token, 'getMe').catch(() => null), telegram(token, 'getWebhookInfo').catch(() => null)]);
    bot = me?.ok ? `@${(me.result as { username?: string }).username}` : null;
    const url = (info?.result as { url?: string })?.url;
    webhookHost = url ? new URL(url).host : null;
  }
  const isProduction = process.env.VERCEL_ENV === 'production';
  return {
    environment: process.env.VERCEL_ENV || 'development',
    sources,
    bot,
    webhook: { host: webhookHost, expected: `${new URL(origin).host}${WEBHOOK_PATH}`, connectedHere: webhookHost === new URL(origin).host },
    // Hors production, brancher le webhook n'est permis qu'avec un bot saisi ici (jamais celui de Vercel)
    canConnect: /^https:/.test(origin) && (isProduction || !(await botTokenFromVercel())),
  };
}

export async function GET(request: Request) {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    return NextResponse.json({ data: await state(new URL(request.url).origin) });
  } catch (err) {
    console.error('Telegram config GET error:', err);
    return NextResponse.json({ error: 'Erreur lors du chargement de la configuration' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const origin = new URL(request.url).origin;
  const body = (await request.json().catch(() => ({}))) as { token?: string; chatId?: string; secret?: string; connect?: boolean };

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const chatId = typeof body.chatId === 'string' ? body.chatId.trim() : '';
  const secretInput = typeof body.secret === 'string' ? body.secret.trim() : '';
  if (token && !TOKEN_RE.test(token))
    return NextResponse.json({ error: 'Jeton invalide : copiez-le tel que donné par @BotFather (123456789:ABC…)' }, { status: 400 });
  if (chatId && !CHAT_RE.test(chatId))
    return NextResponse.json({ error: 'Chat autorisé invalide : un identifiant numérique (ex. 123456789)' }, { status: 400 });
  if (secretInput && secretInput !== 'generate' && !SECRET_RE.test(secretInput)) {
    return NextResponse.json({ error: 'Secret invalide : 32 à 256 caractères, lettres, chiffres, « _ » ou « - »' }, { status: 400 });
  }

  try {
    let botName: string | null = null;
    if (token) {
      const me = await telegram(token, 'getMe');
      if (!me.ok) return NextResponse.json({ error: 'Telegram ne reconnaît pas ce jeton : vérifiez-le avec @BotFather' }, { status: 400 });
      botName = `@${(me.result as { username?: string }).username}`;
    }

    await hydrateTelegramEnv();
    const sourcesBefore = await telegramConfigSources();
    const hasSecret = sourcesBefore.find((x) => x.key === 'TELEGRAM_WEBHOOK_SECRET')?.configured;
    // Nouveau bot sans secret existant : on en génère un
    const secret = secretInput === 'generate' || (token && !hasSecret && !secretInput) ? generateWebhookSecret() : secretInput;
    const willConnect = body.connect === true || !!secret || !!token;

    // Changer le jeton ou le secret impose de rebrancher le webhook tout de suite
    if (willConnect) {
      const isProduction = process.env.VERCEL_ENV === 'production';
      if (!/^https:/.test(origin))
        return NextResponse.json({ error: 'Le webhook ne peut être branché que sur une adresse https.' }, { status: 400 });
      if (!isProduction && !token && (await botTokenFromVercel())) {
        return NextResponse.json({ error: 'Hors production, saisissez d’abord le jeton d’un bot de test.' }, { status: 400 });
      }
    }

    const changed: string[] = [];
    if (token) {
      await saveTelegramSetting('TELEGRAM_BOT_TOKEN', token, auth.user.id);
      changed.push('jeton du bot');
    }
    if (secret) {
      await saveTelegramSetting('TELEGRAM_WEBHOOK_SECRET', secret, auth.user.id);
      changed.push('secret du webhook');
    }
    if (chatId) {
      await saveTelegramSetting('TELEGRAM_CHAT_ID', chatId, auth.user.id);
      changed.push('chat autorisé');
    }

    let webhook: { ok: boolean; message: string } | null = null;
    if (willConnect) webhook = await registerTelegramWebhook(origin);

    await query(
      `INSERT INTO platform_audit_logs (platform_user_id, action, entity_type, entity_id, new_data)
       VALUES ($1, 'telegram_config.update', 'platform_settings', 'telegram', $2)`,
      [auth.platformUser.id, JSON.stringify({ modifie: changed.join(', ') || 'aucun', bot: botName, webhook: webhook?.message ?? null })],
    ).catch((err) => console.error('Telegram config audit error:', err));

    return NextResponse.json({ success: true, changed, webhook, data: await state(origin) });
  } catch (err) {
    console.error('Telegram config PUT error:', err);
    return NextResponse.json({ error: "Erreur lors de l'enregistrement de la configuration" }, { status: 500 });
  }
}

// Retire une valeur saisie : la variable Vercel reprend la main (?key=token|secret|chat)
export async function DELETE(request: Request) {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const key = KEYS[new URL(request.url).searchParams.get('key') || ''];
  if (!key) return NextResponse.json({ error: 'Réglage inconnu' }, { status: 400 });
  try {
    await clearTelegramSetting(key);
    await query(
      `INSERT INTO platform_audit_logs (platform_user_id, action, entity_type, entity_id, new_data)
       VALUES ($1, 'telegram_config.reset', 'platform_settings', 'telegram', $2)`,
      [auth.platformUser.id, JSON.stringify({ retire: key })],
    ).catch(() => {});
    return NextResponse.json({ success: true, data: await state(new URL(request.url).origin) });
  } catch (err) {
    console.error('Telegram config DELETE error:', err);
    return NextResponse.json({ error: 'Erreur lors de la réinitialisation' }, { status: 500 });
  }
}
