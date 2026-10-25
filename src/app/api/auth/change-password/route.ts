import { type NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { AUTH_COOKIE_NAME, verifyToken, getUserById, hashPassword, signToken } from '@/lib/neon/auth';
import { getPlatformUser } from '@/lib/neon/server';
import { query } from '@/lib/neon/db';
import { MUST_CHANGE_PASSWORD_KEY, setAuthCookie, validatePasswordStrength } from '@/lib/password-change';

// L'utilisateur connecté choisit son propre mot de passe.
// Utilisé obligatoirement après une connexion avec un mot de passe temporaire.
export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    return NextResponse.json({ error: 'Session expirée. Reconnectez-vous.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { newPassword, confirmPassword } = body as { newPassword?: string; confirmPassword?: string };

  const strengthError = validatePasswordStrength(newPassword);
  if (strengthError) {
    return NextResponse.json({ error: strengthError }, { status: 400 });
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: 'Les deux mots de passe ne correspondent pas.' }, { status: 400 });
  }

  try {
    const current = await query('SELECT password_hash FROM users WHERE id = $1', [payload.sub]);
    if (!current.rows[0]) {
      return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 });
    }
    if (await bcrypt.compare(newPassword as string, current.rows[0].password_hash)) {
      return NextResponse.json(
        { error: 'Choisissez un mot de passe différent du mot de passe temporaire.' },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(newPassword as string);
    await query(
      `UPDATE users
          SET password_hash = $1,
              app_metadata = COALESCE(app_metadata, '{}'::jsonb) - $3::text,
              updated_at = NOW()
        WHERE id = $2`,
      [passwordHash, payload.sub, MUST_CHANGE_PASSWORD_KEY]
    );

    // Nouveau jeton sans le marqueur, pour que le proxy laisse passer
    const user = await getUserById(payload.sub);
    if (!user) {
      return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 });
    }
    const platformUser = await getPlatformUser(user.id);
    const redirect = platformUser?.role === 'super_admin' ? '/platform/dashboard' : '/dashboard';

    const response = NextResponse.json({ success: true, redirect });
    setAuthCookie(response, signToken(user));
    return response;
  } catch (err) {
    console.error('Change password error:', err);
    return NextResponse.json({ error: 'Erreur lors du changement de mot de passe.' }, { status: 500 });
  }
}
