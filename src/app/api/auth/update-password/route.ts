import { type NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, verifyToken, getUserById, hashPassword } from '@/lib/neon/auth';
import { query } from '@/lib/neon/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères.' },
        { status: 400 }
      );
    }

    const token = request.cookies.get('neon-auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Session invalide' }, { status: 401 });
    }

    const passwordHash = await hashPassword(password);

    const result = await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, created_at, updated_at',
      [passwordHash, payload.sub]
    );

    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }

    const userRow = result.rows[0];
    const user = await getUserById(payload.sub);

    return NextResponse.json({
      user: user ? {
        id: user.id,
        email: user.email,
        nom: user.nom,
        role: user.role,
        organization_id: user.organization_id,
        user_metadata: user.user_metadata,
        app_metadata: user.app_metadata,
        email_confirmed: user.email_confirmed,
        created_at: user.created_at,
        updated_at: user.updated_at,
      } : null,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) || 'Erreur interne' }, { status: 500 });
  }
}
