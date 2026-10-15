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
  role: 'administrateur' | 'collecteur';
  telephone?: string | null;
  devise?: string | null;
  organization_id?: string | null;
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

export function verifyToken(token: string): { sub: string; email: string; role: string; organization_id?: string | null } | null {
  try {
    return jwt.verify(token, JWT_SECRET_Typed) as any;
  } catch {
    return null;
  }
}

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

export async function getUserById(id: string): Promise<NeonUser | null> {
  const result = await query(
    `SELECT u.id, u.email, u.email_confirmed, u.user_metadata, u.app_metadata, u.created_at, u.updated_at,
            p.nom, p.role, p.telephone, p.devise, p.organization_id
     FROM users u
     LEFT JOIN profiles p ON p.id = u.id
     WHERE u.id = $1`,
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

export async function authenticate(email: string, password: string): Promise<NeonUser | null> {
  const result = await query(
    `SELECT u.id, u.email, u.password_hash, u.email_confirmed, u.banned_until, u.user_metadata, u.app_metadata, u.created_at, u.updated_at,
            p.nom, p.role, p.telephone, p.devise, p.organization_id
     FROM users u
     LEFT JOIN profiles p ON p.id = u.id
     WHERE u.email = $1`,
    [email.toLowerCase()]
  );

  if (!result.rows || result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  if (row.banned_until && new Date(row.banned_until) > new Date()) {
    return null;
  }

  const valid = await comparePassword(password, row.password_hash);
  if (!valid) {
    return null;
  }

  await query('UPDATE users SET last_sign_in_at = NOW() WHERE id = $1', [row.id]);

  return {
    id: row.id,
    email: row.email,
    nom: row.nom,
    role: row.role || 'collecteur',
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

  if (!token) {
    return null;
  }

  const payload = verifyToken(token);
  if (!payload) {
    return null;
  }

  const user = await getUserById(payload.sub);
  if (!user) {
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
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const payload = verifyToken(token);
  if (!payload) {
    return null;
  }

  return getUserById(payload.sub);
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
    await query(
      `UPDATE users SET banned_until = NOW() + INTERVAL '${duration.replace(/'/g, '')}' WHERE id = $1`,
      [userId]
    );
  } else {
    await query(`UPDATE users SET banned_until = NULL WHERE id = $1`, [userId]);
  }
}

export function createTokenFromUser(user: NeonUser): string {
  return signToken(user);
}
