import { type NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/neon/auth';
import { query } from '@/lib/neon/db';
import { hash } from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token et mot de passe requis' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères' },
        { status: 400 }
      );
    }

    // Verify the token
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Token invalide ou expiré' },
        { status: 401 }
      );
    }

    // Hash the new password
    const hashedPassword = await hash(password, 12);

    // Update the user's password hash in the database
    await query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [hashedPassword, payload.sub]
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Mot de passe mis à jour avec succès' 
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur interne' },
      { status: 500 }
    );
  }
}