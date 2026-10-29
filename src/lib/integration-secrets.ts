// ============================================================
// OPTIWIFI - Configuration du bot Telegram saisie dans le back-office.
// - Stockée chiffrée (AES-256-GCM, clé dérivée de JWT_SECRET) dans integration_secrets.
// - Prioritaire sur les variables Vercel, qui restent le repli.
// - hydrateTelegramEnv() place la configuration effective dans process.env au début de
//   chaque traitement du bot : le code existant (qui lit process.env) fonctionne tel quel.
// Les valeurs ne sont jamais renvoyées au navigateur.
// ============================================================
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'crypto';
import { query } from '@/lib/neon/db';

export const TELEGRAM_KEYS = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET', 'TELEGRAM_CHAT_ID'] as const;
export type TelegramKey = (typeof TELEGRAM_KEYS)[number];

// Valeurs Vercel d'origine, mémorisées avant toute hydratation (repli et origine affichée)
const VERCEL_VALUES: Record<TelegramKey, string> = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN?.trim() || '',
  TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID?.trim() || '',
};

function encryptionKey(): Buffer {
  const base = process.env.JWT_SECRET?.trim();
  if (!base) throw new Error('JWT_SECRET manquant : chiffrement impossible');
  return Buffer.from(hkdfSync('sha256', base, 'optiwifi', 'integration-secrets', 32));
}

function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}

function decrypt(payload: string): string | null {
  try {
    const raw = Buffer.from(payload, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
  } catch {
    // JWT_SECRET changé depuis l'enregistrement : la valeur est à ressaisir
    return null;
  }
}

let cache: { at: number; values: Partial<Record<TelegramKey, string>>; unreadable: TelegramKey[] } | null = null;
const CACHE_MS = 60_000;

async function loadStored(): Promise<{ values: Partial<Record<TelegramKey, string>>; unreadable: TelegramKey[] }> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache;
  const values: Partial<Record<TelegramKey, string>> = {};
  const unreadable: TelegramKey[] = [];
  try {
    const { rows } = await query(`SELECT key, value_encrypted FROM integration_secrets WHERE key = ANY($1::text[])`, [
      [...TELEGRAM_KEYS],
    ]);
    for (const r of rows) {
      const v = decrypt(r.value_encrypted);
      if (v) values[r.key as TelegramKey] = v;
      else unreadable.push(r.key as TelegramKey);
    }
  } catch (err) {
    // Table absente (migration pas encore passée) ou base indisponible : repli sur Vercel
    console.error('integration_secrets read error:', err instanceof Error ? err.message : err);
  }
  cache = { at: Date.now(), values, unreadable };
  return cache;
}

/** Configuration effective du bot (interface, sinon Vercel) placée dans process.env. */
export async function hydrateTelegramEnv(): Promise<void> {
  const { values } = await loadStored();
  for (const key of TELEGRAM_KEYS) {
    const value = values[key] || VERCEL_VALUES[key];
    if (value) process.env[key] = value;
    else delete process.env[key];
  }
}

export interface TelegramConfigSource {
  key: TelegramKey;
  configured: boolean;
  source: 'interface' | 'vercel' | null;
  /** Valeur enregistrée illisible (JWT_SECRET changé) : à ressaisir */
  unreadable: boolean;
}

/** Origine de chaque réglage, sans jamais renvoyer de valeur. */
export async function telegramConfigSources(): Promise<TelegramConfigSource[]> {
  const { values, unreadable } = await loadStored();
  return TELEGRAM_KEYS.map((key) => ({
    key,
    configured: !!(values[key] || VERCEL_VALUES[key]),
    source: values[key] ? 'interface' : VERCEL_VALUES[key] ? 'vercel' : null,
    unreadable: unreadable.includes(key),
  }));
}

export async function saveTelegramSetting(key: TelegramKey, value: string, userId: string): Promise<void> {
  await query(
    `INSERT INTO integration_secrets (key, value_encrypted, updated_by, updated_at) VALUES ($1, $2, $3, NOW())
     ON CONFLICT (key) DO UPDATE SET value_encrypted = EXCLUDED.value_encrypted, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
    [key, encrypt(value), userId]
  );
  cache = null;
}

/** Retire la valeur saisie : la variable Vercel reprend la main. */
export async function clearTelegramSetting(key: TelegramKey): Promise<void> {
  await query('DELETE FROM integration_secrets WHERE key = $1', [key]);
  cache = null;
}

/** Secret de webhook aléatoire (64 caractères hexadécimaux, accepté par Telegram). */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString('hex');
}

/** Le jeton effectif vient-il des variables Vercel (et non de l'interface) ? */
export async function botTokenFromVercel(): Promise<boolean> {
  const { values } = await loadStored();
  return !values.TELEGRAM_BOT_TOKEN && !!VERCEL_VALUES.TELEGRAM_BOT_TOKEN;
}
