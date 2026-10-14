import { type NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/neon/auth';
import { query } from '@/lib/neon/db';
import { hash } from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

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

    // Also update Supabase Auth user password to keep in sync
    try {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      await supabaseAdmin.auth.admin.updateUserById(payload.sub, { password });
    } catch (supabaseError) {
      // Log but don't fail the request - Neon update succeeded
      console.error('Failed to update Supabase Auth user password:', supabaseError);
    }

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