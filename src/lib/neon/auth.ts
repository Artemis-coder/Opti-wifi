/* eslint-disable @typescript-eslint/no-explicit-any */
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query, queryOne } from './db';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not configured. Set JWT_SECRET in your environment variables.');
}
const JWT_SECRET_Typed: string = JWT_SECRET;
const JWT_EXPIRES_IN = '24h';
export const AUTH_COOKIE_NAME = 'neon-auth-token';

export interface NeonUser {
  id: string;
  email: string;
  nom?: string;
  role: 'administrateur' | 'collecteur' | 'point_de_vente';
  /** Compte « point de vente » : le point de vente qu'il consulte (lecture seule). */
  pos_id?: string | null;
  telephone?: string | null;
  devise?: string | null;
  organization_id?: string | null;
  /** Statut de l'organisation (active, suspended, archived…) : sert à couper l'accès aux données. */
  organization_status?: string | null;
  /** L'organisation a déjà eu une licence mais aucune n'est active et en cours : accès aux données coupé. */
  licence_expired?: boolean;
  email_confirmed: boolean;
  user_metadata?: Record<string, any> | null;
  app_metadata?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface NeonSession {
  access_token: string;
  user: NeonUser;
}

export function signToken(user: NeonUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      organization_id: user.organization_id,
      user_metadata: user.user_metadata,
      app_metadata: user.app_metadata,
    },
    JWT_SECRET_Typed,
    { expiresIn: JWT_EXPIRES_IN, algorithm: 'HS256' }
  );
}

export function verifyToken(token: string): { sub: string; email: string; role: string; organization_id?: string | null; iat?: number } | null {
  try {
    return jwt.verify(token, JWT_SECRET_Typed, { algorithms: ['HS256'] }) as any;
  } catch {
    return null;
  }
}

/** Clé d'app_metadata : date (ms) du dernier changement de mot de passe. */
export const PASSWORD_CHANGED_AT_KEY = 'password_changed_at';

/**
 * Session émise avant le dernier changement de mot de passe : refusée. Un mot de passe changé
 * (ou réinitialisé après un vol de compte) déconnecte donc toutes les autres sessions.
 */
export function isTokenRevoked(user: Pick<NeonUser, 'app_metadata'>, issuedAt: number | undefined): boolean {
  const changedAt = Number(user.app_metadata?.[PASSWORD_CHANGED_AT_KEY]);
  if (!changedAt || typeof issuedAt !== 'number') return false;
  return issuedAt * 1000 < changedAt;
}

/** Enregistre le changement de mot de passe (à la seconde, comme le champ iat des jetons). */
export async function markPasswordChanged(userId: string): Promise<void> {
  await query(
    `UPDATE users SET app_metadata = COALESCE(app_metadata, '{}'::jsonb) || jsonb_build_object($2::text, $3::bigint) WHERE id = $1`,
    [userId, PASSWORD_CHANGED_AT_KEY, Math.floor(Date.now() / 1000) * 1000],
  );
}

/** Jeton → utilisateur actif, ou null (signature, expiration, compte bloqué, session révoquée). */
export async function getUserFromToken(token: string | null | undefined): Promise<NeonUser | null> {
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload?.sub) return null;
  const user = await getUserById(payload.sub);
  if (!user || isTokenRevoked(user, payload.iat)) return null;
  return user;
}

// --- Protection contre les essais de mots de passe en série ---
const MAX_FAILED_LOGINS = 10;
const LOCK_MINUTES = 15;
// Hash factice : une adresse inconnue coûte le même temps qu'une vraie (pas d'énumération des comptes)
const DUMMY_HASH = '$2b$10$hio5M2wOVt32nnLUNx6IN.hWt6mHTU/bw4wrq/rZr3hbSnTzV3Xq.';

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createUserInDb(
  email: string,
  password: string,
  nom?: string,
  role: 'administrateur' | 'collecteur' = 'collecteur',
  telephone?: string,
  organization_id?: string
): Promise<NeonUser | null> {
  const passwordHash = await hashPassword(password);

  const result = await query(
    `INSERT INTO users (email, password_hash, email_confirmed, user_metadata, app_metadata, created_at, updated_at)
     VALUES ($1, $2, true, $3, $4, NOW(), NOW())
     RETURNING id, email, created_at, updated_at`,
    [
      email.toLowerCase(),
      passwordHash,
      JSON.stringify({ nom: nom || undefined, role, telephone: telephone || undefined, organization_id: organization_id || undefined }),
      JSON.stringify({ role }),
    ]
  );

  if (!result.rows || result.rows.length === 0) {
    return null;
  }

  const userRow = result.rows[0];
  const user: NeonUser = {
    id: userRow.id,
    email: userRow.email,
    nom: nom,
    role,
    telephone: telephone || null,
    devise: 'XOF',
    organization_id: organization_id || null,
    email_confirmed: true,
    user_metadata: { nom: nom || undefined, role, telephone: telephone || undefined, organization_id: organization_id || undefined },
    app_metadata: { role },
    created_at: userRow.created_at,
    updated_at: userRow.updated_at,
  };

  return user;
}

// Appelée à chaque requête authentifiée côté serveur : un compte suspendu, banni ou supprimé
// n'est plus reconnu, ce qui révoque immédiatement l'accès même si sa session (JWT) est encore valide.
export async function getUserById(id: string): Promise<NeonUser | null> {
  const result = await query(
    `SELECT u.id, u.email, u.email_confirmed, u.user_metadata, u.app_metadata, u.created_at, u.updated_at,
            p.nom, p.role, p.pos_id, p.telephone, p.devise, p.organization_id,
            o.status AS organization_status,
            CASE
              WHEN p.organization_id IS NULL THEN false
              WHEN NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.organization_id = p.organization_id) THEN false
              ELSE NOT EXISTS (
                SELECT 1 FROM subscriptions s
                 WHERE s.organization_id = p.organization_id
                   AND s.status IN ('active', 'trialing')
                   AND (s.end_date IS NULL OR s.end_date > NOW())
              )
            END AS licence_expired
     FROM users u
     LEFT JOIN profiles p ON p.id = u.id
     LEFT JOIN organizations o ON o.id = p.organization_id
     WHERE u.id = $1
       AND (u.banned_until IS NULL OR u.banned_until <= NOW())
       AND (p.id IS NULL OR (p.is_active IS NOT FALSE AND p.deleted_at IS NULL))`,
    [id]
  );

  if (!result.rows || result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    nom: row.nom,
    role: row.role || 'collecteur',
    pos_id: row.pos_id ?? null,
    telephone: row.telephone,
    devise: row.devise,
    organization_id: row.organization_id,
    organization_status: row.organization_status ?? null,
    licence_expired: row.licence_expired === true,
    email_confirmed: row.email_confirmed,
    user_metadata: row.user_metadata,
    app_metadata: row.app_metadata,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function authenticate(email: string, password: string, request?: Request): Promise<NeonUser | null> {
  const result = await query(
    `SELECT u.id, u.email, u.password_hash, u.email_confirmed, u.banned_until, u.user_metadata, u.app_metadata, u.created_at, u.updated_at,
            p.nom, p.role, p.pos_id, p.telephone, p.devise, p.organization_id, p.is_active, p.deleted_at
     FROM users u
     LEFT JOIN profiles p ON p.id = u.id
     WHERE u.email = $1`,
    [email.toLowerCase()]
  );

  if (typeof password !== 'string' || password.length > 256) return null;

  if (!result.rows || result.rows.length === 0) {
    // Même travail qu'un compte existant (bcrypt + une écriture) : pas d'énumération par le temps
    await comparePassword(password, DUMMY_HASH);
    await query('SELECT 1');
    return null;
  }

  const row = result.rows[0];

  // Compte verrouillé après trop d'échecs : même réponse qu'un mauvais mot de passe
  const lockedUntil = Number(row.app_metadata?.login_locked_until);
  if (lockedUntil && lockedUntil > Date.now()) {
    await comparePassword(password, DUMMY_HASH);
    // Essais qui continuent sur un compte verrouillé : l'attaque est toujours en cours
    const { reportSecurityEvent } = await import('@/lib/security-events');
    reportSecurityEvent({ type: 'account_locked', request, userId: row.id, identifier: email, detail: 'Essai pendant le verrouillage' });
    return null;
  }

  if (row.banned_until && new Date(row.banned_until) > new Date()) {
    return null;
  }
  // Membre suspendu ou supprimé
  if (row.is_active === false || row.deleted_at) {
    return null;
  }

  const valid = await comparePassword(password, row.password_hash);
  if (!valid) {
    // Incrément atomique (essais lancés en parallèle comptés un par un) ; au seuil, verrouillage
    const res = await query(
      `UPDATE users u SET app_metadata = COALESCE(u.app_metadata, '{}'::jsonb) || (
         CASE WHEN COALESCE((u.app_metadata->>'failed_logins')::int, 0) + 1 >= $2
              THEN jsonb_build_object('failed_logins', 0, 'login_locked_until', $3::bigint)
              ELSE jsonb_build_object('failed_logins', COALESCE((u.app_metadata->>'failed_logins')::int, 0) + 1)
         END)
       WHERE u.id = $1
       RETURNING (u.app_metadata->>'login_locked_until')::bigint > 0 AS locked`,
      [row.id, MAX_FAILED_LOGINS, Date.now() + LOCK_MINUTES * 60_000],
    );
    if (res.rows[0]?.locked) {
      const { reportSecurityEvent } = await import('@/lib/security-events');
      reportSecurityEvent({ type: 'account_locked', request, userId: row.id, identifier: email, detail: `${MAX_FAILED_LOGINS} mauvais mots de passe` });
    }
    return null;
  }

  await query(
    `UPDATE users SET last_sign_in_at = NOW(), app_metadata = COALESCE(app_metadata, '{}'::jsonb) - 'failed_logins' - 'login_locked_until' WHERE id = $1`,
    [row.id],
  );

  return {
    id: row.id,
    email: row.email,
    nom: row.nom,
    role: row.role || 'collecteur',
    pos_id: row.pos_id ?? null,
    telephone: row.telephone,
    devise: row.devise,
    organization_id: row.organization_id,
    email_confirmed: row.email_confirmed,
    user_metadata: row.user_metadata,
    app_metadata: row.app_metadata,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getSessionFromCookies(): Promise<NeonSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const user = await getUserFromToken(token);
  if (!token || !user) {
    return null;
  }

  return { access_token: token, user };
}

export function setAuthCookie(token: string, response: NextResponse): void {
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60,
    path: '/',
  });
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
}

export async function getCurrentUserFromRequest(request: NextRequest): Promise<NeonUser | null> {
  return getUserFromToken(request.cookies.get(AUTH_COOKIE_NAME)?.value);
}

export async function listAuthUsers(): Promise<Array<{
  id: string;
  email: string;
  banned_until?: string | null;
  created_at: string;
}>> {
  const result = await query(
    `SELECT id, email, banned_until, created_at FROM users ORDER BY created_at DESC`
  );
  return result.rows || [];
}

export async function setUserBan(userId: string, banned: boolean, duration: string = '1h'): Promise<void> {
  if (banned) {
    await query(`UPDATE users SET banned_until = NOW() + $2::interval WHERE id = $1`, [userId, duration]);
  } else {
    await query(`UPDATE users SET banned_until = NULL WHERE id = $1`, [userId]);
  }
}

export function createTokenFromUser(user: NeonUser): string {
  return signToken(user);
}
