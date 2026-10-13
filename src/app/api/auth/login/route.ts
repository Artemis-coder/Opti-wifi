import { type NextRequest, NextResponse } from 'next/server';
import { authenticate, signToken, AUTH_COOKIE_NAME } from '@/lib/neon/auth';
import type { AuthUser } from "@/lib/neon/query-builder";
import { NextApiRequest } from 'next';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email et mot de passe requis.' }, { status: 400 });
    }

    const user = await authenticate(email, password);

    if (!user) {
      return NextResponse.json({ error: 'Identifiants invalides.' }, { status: 401 });
    }

    const token = signToken(user);

    const { nom, role, telephone, devise, organization_id, email_confirmed, user_metadata, app_metadata, ...safeUser } = user;
    const sessionUser: AuthUser = {
      id: user.id,
      email: user.email,
      nom: user.nom,
      role: user.role,
      telephone: user.telephone,
      devise: user.devise,
      organization_id: user.organization_id,
      email_confirmed: user.email_confirmed,
      user_metadata: user.user_metadata,
      app_metadata: user.app_metadata,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };

    const response = NextResponse.json({
      user: sessionUser,
      session: {
        access_token: token,
        user: sessionUser,
      },
    });

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (err: unknown) {
    console.error('Login API error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) || 'Erreur interne.' }, { status: 500 });
  }
}
