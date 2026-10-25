import { type NextRequest, NextResponse } from 'next/server';
import { authenticate, signToken, AUTH_COOKIE_NAME } from '@/lib/neon/auth';
import type { AuthUser } from "@/lib/neon/query-builder";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email et mot de passe requis.' }, { status: 400 });
    }

    const user = await authenticate(email, password);

    if (!user) {
      // Message générique intentionnel — ne pas distinguer "email inconnu" de "mauvais mot de passe"
      return NextResponse.json({ error: 'Identifiants invalides.' }, { status: 401 });
    }

    const token = signToken(user);

    // Ne retourner QUE les champs nécessaires côté client — jamais user_metadata, app_metadata, password_hash
    const sessionUser: AuthUser = {
      id: user.id,
      email: user.email,
      nom: user.nom,
      role: user.role,
      telephone: user.telephone,
      devise: user.devise,
      organization_id: user.organization_id,
      email_confirmed: user.email_confirmed,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };

    const response = NextResponse.json({
      // Mot de passe temporaire : la page de connexion envoie vers /change-password
      must_change_password: user.app_metadata?.must_change_password === true,
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
    // En production, ne jamais exposer les détails techniques de l'erreur
    const isDev = process.env.NODE_ENV !== 'production';
    const message = isDev && err instanceof Error ? err.message : 'Erreur de connexion. Veuillez réessayer.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

