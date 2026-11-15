import { NextResponse } from 'next/server';
import { reportSecurityEvent } from '@/lib/security-events';

// Ancienne route (flux Supabase) : elle changeait le mot de passe sans demander l'actuel et avec
// une règle de 6 caractères. Désactivée : le changement passe par /api/auth/change-password
// (mot de passe actuel exigé) et la réinitialisation par le lien reçu par e-mail (/api/auth/set-password).
// L'interface ne l'appelle plus : un appel est donc signalé comme suspect.
export async function POST(request: Request) {
  reportSecurityEvent({ type: 'legacy_route', request });
  return NextResponse.json(
    { error: 'Utilisez « Mot de passe oublié » sur la page de connexion, ou Paramètres → Sécurité pour changer votre mot de passe.' },
    { status: 410 },
  );
}
