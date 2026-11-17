/**
 * Mini App Telegram (back-office OptiSpace dans Telegram) : vérification de l'identité.
 * Telegram signe les données d'ouverture (initData) avec le jeton du bot :
 * clé = HMAC-SHA256("WebAppData", jeton) ; signature = HMAC-SHA256(clé, données triées).
 * Seul le compte Telegram du super admin (TELEGRAM_CHAT_ID) est accepté.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { hydrateTelegramEnv } from '@/lib/integration-secrets';

/** Durée de validité d'une ouverture de la Mini App. */
const MAX_AGE_SECONDS = 12 * 60 * 60;

export const MINI_APP_PATH = '/telegram/app';

export type MiniAppAuth = { ok: true; userId: string } | { ok: false; status: 401 | 403 | 503; error: string };

export async function verifyMiniAppRequest(request: Request): Promise<MiniAppAuth> {
  await hydrateTelegramEnv();
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const adminId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !adminId) return { ok: false, status: 503, error: 'Bot Telegram non configuré.' };

  const initData = request.headers.get('x-telegram-init-data') || '';
  const params = new URLSearchParams(initData);
  const hash = params.get('hash') || '';
  if (!/^[a-f0-9]{64}$/.test(hash)) return { ok: false, status: 401, error: 'Ouvrez cette page depuis le bot Telegram.' };
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const expected = createHmac('sha256', secret).update(dataCheckString).digest();
  if (!timingSafeEqual(expected, Buffer.from(hash, 'hex'))) return { ok: false, status: 401, error: 'Signature Telegram invalide.' };

  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_SECONDS) {
    return { ok: false, status: 401, error: 'Session expirée : rouvrez la Mini App depuis le bot.' };
  }

  let userId = '';
  try {
    userId = String(JSON.parse(params.get('user') || '{}').id ?? '');
  } catch {
    // utilisateur illisible : refusé ci-dessous
  }
  if (!userId || userId !== adminId) return { ok: false, status: 403, error: 'Accès réservé au super administrateur.' };
  return { ok: true, userId };
}

/** Adresse publique de la Mini App (HTTPS obligatoire pour Telegram), ou null en local. */
export function miniAppUrl(): string | null {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.optiwifi.site').replace(/\/$/, '');
  return site.startsWith('https://') ? `${site}${MINI_APP_PATH}` : null;
}
