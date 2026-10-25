import { type NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, verifyToken, getUserById, clearAuthCookie } from '@/lib/neon/auth';

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ user: null });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json({ user: null });
  }

  const user = await getUserById(payload.sub);
  if (!user) {
    // Compte suspendu, supprimé ou banni : la session est révoquée, on efface le cookie
    const response = NextResponse.json({ user: null });
    clearAuthCookie(response);
    return response;
  }

  // Ne jamais exposer les métadonnées internes, le hash de mot de passe, etc.
  const safeUser = {
    id: user.id,
    email: user.email,
    nom: user.nom,
    role: user.role,
    telephone: user.telephone,
    organization_id: user.organization_id,
    // État d'accès calculé côté serveur (utilisé par le layout client pour l'écran de statut)
    organization_status: user.organization_status ?? null,
    licence_expired: user.licence_expired === true,
    email_confirmed: user.email_confirmed,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };

  return NextResponse.json({ user: safeUser });
}
