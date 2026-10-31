import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/neon/db';
import { hashPassword } from '@/lib/neon/auth';
import { getSessionContext } from '@/lib/tenant';
import { setMustChangePassword } from '@/lib/password-change';
import { appUrl, createPasswordToken, generateTemporaryPassword } from '@/lib/password-tokens';
import { isEmailConfigured, sendInvitationEmail } from '@/lib/email';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Accès d'un membre de l'équipe (administrateur de la même organisation uniquement).
 * Les mots de passe ne sont jamais conservés en clair : on ne peut pas « retrouver » des
 * accès, on en redonne de nouveaux.
 * - temporary_password : nouveau mot de passe temporaire (à changer à la connexion),
 *   renvoyé une seule fois pour être transmis (copie, WhatsApp) ; e-mail si demandé.
 * - invite_link : e-mail avec un lien pour que le membre choisisse son mot de passe
 *   (7 jours, usage unique) ; son mot de passe actuel reste valable jusque-là.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  if (ctx.role !== 'administrateur' || !ctx.organizationId || ctx.organizationBlocked) {
    return NextResponse.json({ error: 'Action réservée aux administrateurs.' }, { status: 403 });
  }

  const { id } = await context.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Membre introuvable.' }, { status: 404 });
  if (id === ctx.userId) {
    return NextResponse.json({ error: 'Pour votre propre compte, utilisez Paramètres → Sécurité.' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action as string;
  const sendByEmail = body.send_email === true;
  if (action !== 'temporary_password' && action !== 'invite_link') {
    return NextResponse.json({ error: 'Action invalide.' }, { status: 400 });
  }

  try {
    const { rows } = await query(
      `SELECT p.id, p.nom, p.role, u.email, o.name AS org, me.nom AS inviter
         FROM profiles p
         JOIN users u ON u.id = p.id
         JOIN organizations o ON o.id = p.organization_id
         LEFT JOIN profiles me ON me.id = $3
        WHERE p.id = $1 AND p.organization_id = $2 AND p.is_active = true`,
      [id, ctx.organizationId, ctx.userId]
    );
    const member = rows[0];
    if (!member) return NextResponse.json({ error: 'Membre introuvable.' }, { status: 404 });

    const base = {
      to: member.email as string,
      name: member.nom || member.email,
      organizationName: member.org || 'votre organisation',
      inviterName: member.inviter || null,
      role: (member.role === 'administrateur' ? 'administrateur' : 'collecteur') as 'administrateur' | 'collecteur',
      loginUrl: appUrl('/login', request),
    };

    if (action === 'invite_link') {
      if (!isEmailConfigured()) {
        return NextResponse.json({ error: "L'envoi d'e-mails n'est pas disponible. Générez un mot de passe temporaire." }, { status: 503 });
      }
      const token = await createPasswordToken(id, 'invite');
      const sent = await sendInvitationEmail({ ...base, setPasswordUrl: appUrl(`/reset-password?token=${encodeURIComponent(token)}`, request) });
      if (!sent.success) {
        console.error('Invite link email error:', sent.error);
        return NextResponse.json({ error: "L'e-mail n'a pas pu être envoyé. Réessayez ou générez un mot de passe temporaire." }, { status: 502 });
      }
      await audit(ctx.organizationId, ctx.userId, id, 'invite_sent');
      return NextResponse.json({ success: true, email_sent: true, email: member.email });
    }

    // Nouveau mot de passe temporaire
    const temporaryPassword = generateTemporaryPassword();
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [await hashPassword(temporaryPassword), id]);
    await setMustChangePassword(id, true);
    let emailSent = false;
    if (sendByEmail && isEmailConfigured()) {
      const sent = await sendInvitationEmail({ ...base, temporaryPassword });
      emailSent = sent.success;
      if (!sent.success) console.error('Temporary password email error:', sent.error);
    }
    await audit(ctx.organizationId, ctx.userId, id, 'password_reset');
    return NextResponse.json({
      success: true,
      email_sent: emailSent,
      access: { email: member.email, temporary_password: temporaryPassword, login_url: appUrl('/login', request) },
    });
  } catch (err) {
    console.error('Member access error:', err);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour des accès.' }, { status: 500 });
  }
}

/** Trace dans le journal de l'organisation (jamais le mot de passe) */
async function audit(organizationId: string, actorId: string, memberId: string, action: string) {
  await query(
    `INSERT INTO audit_logs (table_name, operation, nouvel_etat, effectue_par) VALUES ('profiles', $1, $2, $3)`,
    [action, JSON.stringify({ member_id: memberId, organization_id: organizationId }), actorId]
  ).catch((err) => console.error('Access audit error:', err));
}
