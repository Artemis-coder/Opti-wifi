import { NextResponse } from 'next/server';
import { verifyToken, AUTH_COOKIE_NAME } from '@/lib/neon/auth';

/**
 * Ce endpoint est réservé aux administrateurs authentifiés.
 * Il ne doit PAS être accessible en production ou par des utilisateurs non admin.
 */
export async function GET(request: Request) {
  // Bloquer en production
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'Endpoint désactivé en production.' }, { status: 404 });
  }

  try {
    const cookieHeader = request.headers.get('cookie');
    const token = cookieHeader
      ?.split(';')
      .find(c => c.trim().startsWith(AUTH_COOKIE_NAME + '='))
      ?.split('=')[1];

    if (!token) {
      return NextResponse.json({ ok: false, error: 'Non authentifié.' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ ok: false, error: 'Session invalide.' }, { status: 401 });
    }

    if (payload.role !== 'administrateur') {
      return NextResponse.json({ ok: false, error: 'Accès réservé aux administrateurs.' }, { status: 403 });
    }

    // Réponse minimale — no schema, no table list, no host info
    return NextResponse.json({
      ok: true,
      env: process.env.VERCEL_ENV || 'development',
      message: 'Base de données accessible.',
    });
  } catch (error) {
    // Ne pas exposer les détails d'erreur
    return NextResponse.json({ ok: false, error: 'Erreur de diagnostic.' }, { status: 500 });
  }
}