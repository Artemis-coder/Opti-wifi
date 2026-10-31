// ============================================================
// OPTIWIFI - Jetons de réinitialisation et d'invitation (lien envoyé par e-mail).
// - Signés avec une clé dérivée, distincte de celle des sessions : un jeton de lien ne
//   peut jamais servir de session (et une session ne peut pas changer un mot de passe).
// - Durée courte : 1 h pour une réinitialisation, 7 jours pour une invitation.
// - Usage unique : le jeton embarque une empreinte du mot de passe actuel ; dès que le
//   mot de passe change, tous les liens déjà envoyés deviennent invalides.
// ============================================================
import { createHash, createHmac, randomInt } from 'crypto';
import jwt from 'jsonwebtoken';
import { query } from '@/lib/neon/db';

export type PasswordTokenPurpose = 'reset' | 'invite';

const LIFETIME: Record<PasswordTokenPurpose, string> = { reset: '1h', invite: '7d' };

function tokenSecret(): string {
  const base = process.env.JWT_SECRET;
  if (!base) throw new Error('JWT_SECRET manquant');
  return createHmac('sha256', base).update('optiwifi:password-token:v1').digest('hex');
}

/** Empreinte courte du hash du mot de passe actuel (le hash lui-même ne sort jamais) */
function fingerprint(passwordHash: string | null): string {
  return createHash('sha256').update(passwordHash || 'no-password').digest('hex').slice(0, 24);
}

export async function createPasswordToken(userId: string, purpose: PasswordTokenPurpose): Promise<string> {
  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  if (!rows[0]) throw new Error('Utilisateur introuvable');
  return jwt.sign({ sub: userId, purpose, fp: fingerprint(rows[0].password_hash) }, tokenSecret(), {
    expiresIn: LIFETIME[purpose],
    algorithm: 'HS256',
  } as jwt.SignOptions);
}

/** Vérifie un jeton de lien : signature, durée, et mot de passe inchangé depuis l'envoi. */
export async function verifyPasswordToken(
  token: string
): Promise<{ userId: string; purpose: PasswordTokenPurpose; email: string } | null> {
  try {
    const payload = jwt.verify(token, tokenSecret(), { algorithms: ['HS256'] }) as {
      sub?: string;
      purpose?: PasswordTokenPurpose;
      fp?: string;
    };
    if (!payload.sub || (payload.purpose !== 'reset' && payload.purpose !== 'invite')) return null;
    const { rows } = await query('SELECT email, password_hash FROM users WHERE id = $1', [payload.sub]);
    const user = rows[0];
    if (!user || fingerprint(user.password_hash) !== payload.fp) return null;
    return { userId: payload.sub, purpose: payload.purpose, email: user.email };
  } catch {
    return null;
  }
}

/** Domaines acceptés pour construire un lien (évite l'empoisonnement de l'en-tête Host) */
const TRUSTED_HOST = /^(localhost(:\d+)?|([a-z0-9-]+\.)*optiwifi\.site|opti-wifi[a-z0-9-]*\.vercel\.app)$/i;

/**
 * Adresse publique de l'application (liens des e-mails et des accès). Avec la requête, on
 * reprend l'adresse réellement utilisée (www.optiwifi.site, dev.optiwifi.site…) si elle fait
 * partie des domaines de l'application ; sinon la variable NEXT_PUBLIC_SITE_URL.
 */
export function appUrl(path = '', request?: Request): string {
  let base = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.optiwifi.site';
  if (request) {
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const proto = request.headers.get('x-forwarded-proto') || (host?.startsWith('localhost') ? 'http' : 'https');
    if (host && TRUSTED_HOST.test(host)) base = `${proto === 'http' && !host.startsWith('localhost') ? 'https' : proto}://${host}`;
  }
  return `${base.replace(/\/$/, '')}${path}`;
}

/**
 * Mot de passe temporaire lisible et conforme aux règles (majuscule, minuscule, chiffre,
 * caractère spécial), ex. « Kqm7-Tpx4-Rvz2! ». Sans caractères ambigus (0/O, 1/l/I).
 */
export function generateTemporaryPassword(): string {
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const pick = (s: string) => s[randomInt(s.length)];
  const block = () => pick(upper) + pick(lower) + pick(lower) + pick(digits);
  return `${block()}-${block()}-${block()}!`;
}
