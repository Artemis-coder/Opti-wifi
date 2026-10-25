// ============================================================
// OPTIWIFI - Contrôle d'accès des routes du bot Telegram.
// ============================================================
import { createHmac, timingSafeEqual } from 'crypto';
import { requirePlatformAdmin } from '@/lib/supabase/platform';

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * Webhook Telegram : si TELEGRAM_WEBHOOK_SECRET est défini, Telegram doit renvoyer ce secret
 * dans l'en-tête X-Telegram-Bot-Api-Secret-Token (setWebhook avec secret_token).
 * Sans secret configuré, la route reste ouverte (seul le contrôle du chat autorisé s'applique).
 */
export function isTelegramWebhookAuthorized(request: Request): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!secret) return true;
  const header = request.headers.get('x-telegram-bot-api-secret-token') || '';
  return safeEqual(header, secret);
}

/** Appel interne (Bearer CRON_SECRET) ou super admin connecté. */
export async function isInternalOrSuperAdmin(request: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get('authorization') || '';
  if (secret && safeEqual(auth, `Bearer ${secret}`)) return true;
  const admin = await requirePlatformAdmin();
  return !('error' in admin);
}

/** Webhook Vercel : signature HMAC-SHA1 du corps (en-tête x-vercel-signature). */
export function isVercelWebhookSigned(rawBody: string, signature: string | null): boolean {
  const secret = process.env.VERCEL_WEBHOOK_SECRET?.trim();
  if (!secret || !signature) return false;
  const expected = createHmac('sha1', secret).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}
