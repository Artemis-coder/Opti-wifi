// ============================================================
// OPTIWIFI - Mot de passe à changer à la première connexion.
// Un mot de passe qui n'a pas été choisi par l'utilisateur lui-même (généré par
// le système, fixé par un administrateur, réinitialisé) est marqué dans
// users.app_metadata.must_change_password. Ce champ est copié dans le jeton de
// session : le proxy redirige alors vers /change-password tant qu'il est présent.
// ============================================================
import type { NextResponse } from 'next/server';
import { query } from '@/lib/neon/db';
import { AUTH_COOKIE_NAME } from '@/lib/neon/auth';

export const MUST_CHANGE_PASSWORD_KEY = 'must_change_password';

/** Même règle qu'à l'inscription. Renvoie un message d'erreur, ou null si le mot de passe est valide. */
export function validatePasswordStrength(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Le mot de passe doit contenir au moins 8 caractères.';
  }
  if (password.length > 128) {
    return 'Le mot de passe ne doit pas dépasser 128 caractères.';
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return 'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial.';
  }
  return null;
}

/** Marque (ou démarque) le mot de passe d'un utilisateur comme devant être changé. */
export async function setMustChangePassword(userId: string, value: boolean): Promise<void> {
  if (value) {
    await query(
      `UPDATE users SET app_metadata = COALESCE(app_metadata, '{}'::jsonb) || jsonb_build_object($2::text, true), updated_at = NOW()
        WHERE id = $1`,
      [userId, MUST_CHANGE_PASSWORD_KEY]
    );
  } else {
    await query(
      `UPDATE users SET app_metadata = COALESCE(app_metadata, '{}'::jsonb) - $2::text, updated_at = NOW() WHERE id = $1`,
      [userId, MUST_CHANGE_PASSWORD_KEY]
    );
  }
}

/** Pose le cookie de session (mêmes options que la connexion). */
export function setAuthCookie(response: NextResponse, token: string): void {
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60,
    path: '/',
  });
}
