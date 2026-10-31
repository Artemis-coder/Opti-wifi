import { type NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon/db';
import { sendPasswordResetEmail } from '@/lib/email';
import { appUrl, createPasswordToken } from '@/lib/password-tokens';

// « Mot de passe oublié » : envoie un lien de réinitialisation (valable 1 h, usage unique).
// Réponse identique que le compte existe ou non (pas de fuite des adresses inscrites).
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email) {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 });
    }

    const result = await query(
      `SELECT u.id, u.email, p.nom
         FROM users u LEFT JOIN profiles p ON p.id = u.id
        WHERE lower(u.email) = $1 AND (u.banned_until IS NULL OR u.banned_until <= NOW())`,
      [email]
    );
    const user = result.rows[0];
    if (user) {
      const token = await createPasswordToken(user.id, 'reset');
      const sent = await sendPasswordResetEmail(user.email, appUrl(`/reset-password?token=${encodeURIComponent(token)}`, request), user.nom);
      if (!sent.success) console.error('Reset email not sent:', sent.error);
    }

    return NextResponse.json({ data: { message_id: 'sent' } });
  } catch (err: unknown) {
    console.error('Reset password error:', err);
    return NextResponse.json({ error: "Impossible d'envoyer le lien pour le moment." }, { status: 500 });
  }
}
