import { type NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon/db';
import { hashPassword } from '@/lib/neon/auth';
import { setMustChangePassword, validatePasswordStrength } from '@/lib/password-change';
import { verifyPasswordToken } from '@/lib/password-tokens';
import { sendPasswordChangedEmail } from '@/lib/email';

// Nouveau mot de passe depuis un lien e-mail (réinitialisation ou invitation).
// Le jeton est dédié à cet usage (jamais un jeton de session) et devient invalide
// dès que le mot de passe change.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { token, password } = body as { token?: string; password?: string };
    if (!token || !password) {
      return NextResponse.json({ error: 'Lien et mot de passe requis.' }, { status: 400 });
    }

    const link = await verifyPasswordToken(token);
    if (!link) {
      return NextResponse.json(
        { error: 'Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau.' },
        { status: 401 }
      );
    }

    const weak = validatePasswordStrength(password);
    if (weak) return NextResponse.json({ error: weak }, { status: 400 });

    const passwordHash = await hashPassword(password);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, link.userId]);
    // Mot de passe choisi par l'utilisateur lui-même : plus besoin de le changer à la connexion
    await setMustChangePassword(link.userId, false);

    sendPasswordChangedEmail(link.email).catch((err) => console.error('Password changed email error:', err));

    return NextResponse.json({
      success: true,
      purpose: link.purpose,
      message: link.purpose === 'invite' ? 'Votre compte est prêt : vous pouvez vous connecter.' : 'Mot de passe mis à jour.',
    });
  } catch (err: unknown) {
    console.error('Set password error:', err);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour du mot de passe.' }, { status: 500 });
  }
}
