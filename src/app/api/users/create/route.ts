import { adminClient } from '@/lib/neon/admin';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { checkQuota } from '@/lib/quotas';
import { getSessionContext, rejectIfReadOnly } from '@/lib/tenant';
import { setMustChangePassword } from '@/lib/password-change';
import { rejectTestEmailInProduction } from '@/lib/test-accounts';
import { notifyInBackground, notifyOrganizationAdmins } from '@/lib/notifications';
import { query } from '@/lib/neon/db';
import { appUrl, generateTemporaryPassword } from '@/lib/password-tokens';
import { isEmailConfigured, sendInvitationEmail } from '@/lib/email';
import { findPosAccountsByPhone, internalPosAccountEmail, MIN_PHONE_DIGITS, phoneDigits } from '@/lib/pos-account-phone';

const ROLE_LABELS: Record<string, string> = {
  administrateur: 'administrateur',
  collecteur: 'collecteur',
  point_de_vente: 'accès point de vente',
};

export async function POST(request: NextRequest) {
  try {
    const supabase = adminClient;

    // Seul un administrateur d'organisation peut ajouter un membre à SON organisation
    const ctx = await getSessionContext();
    if (!ctx) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    }
    if (ctx.role !== 'administrateur' || !ctx.organizationId || ctx.organizationBlocked) {
      return NextResponse.json({ error: 'Action réservée aux administrateurs.' }, { status: 403 });
    }
    const readOnly = await rejectIfReadOnly(ctx);
    if (readOnly) return readOnly;
    const orgId = ctx.organizationId;

    const body = await request.json();
    const { nom, telephone } = body;
    const role = body.role || 'collecteur';
    // Compte point de vente : connexion par téléphone, e-mail facultatif (adresse interne sinon)
    const hasRealEmail = typeof body.email === 'string' && body.email.trim() !== '';
    const email: string =
      role === 'point_de_vente' && !hasRealEmail && typeof body.pos_id === 'string'
        ? internalPosAccountEmail(body.pos_id)
        : body.email;
    // Mot de passe temporaire : saisi par l'administrateur, ou généré s'il est laissé vide
    const mot_de_passe: string =
      typeof body.mot_de_passe === 'string' && body.mot_de_passe.trim() ? body.mot_de_passe.trim() : generateTemporaryPassword();
    const sendByEmail = body.send_email === true && (role !== 'point_de_vente' || hasRealEmail);

    if (!nom || !email || !mot_de_passe) {
      return NextResponse.json(
        { error: 'Les champs nom, email et mot de passe sont requis.' },
        { status: 400 }
      );
    }
    const testEmailError = rejectTestEmailInProduction(String(email));
    if (testEmailError) {
      return NextResponse.json({ error: testEmailError }, { status: 400 });
    }
    if (!['administrateur', 'collecteur', 'point_de_vente'].includes(role)) {
      return NextResponse.json({ error: 'Rôle invalide.' }, { status: 400 });
    }
    // Compte point de vente : rattaché à un point de vente de l'organisation, un seul accès actif par point de vente
    const isPosAccountRole = role === 'point_de_vente';
    const posId: string | null = isPosAccountRole && typeof body.pos_id === 'string' ? body.pos_id : null;
    if (isPosAccountRole) {
      if (!posId) {
        return NextResponse.json({ error: 'Point de vente manquant.' }, { status: 400 });
      }
      const pos = await query(`SELECT id FROM points_of_sale WHERE id = $1 AND organization_id = $2`, [posId, orgId]);
      if (pos.rows.length === 0) {
        return NextResponse.json({ error: 'Point de vente introuvable.' }, { status: 404 });
      }
      const existing = await query(
        `SELECT id FROM profiles WHERE pos_id = $1 AND role = 'point_de_vente' AND deleted_at IS NULL`,
        [posId],
      );
      if (existing.rows.length > 0) {
        return NextResponse.json({ error: 'Ce point de vente a déjà un accès.' }, { status: 409 });
      }
      // Le numéro est l'identifiant de connexion : obligatoire et propre à ce point de vente
      if (phoneDigits(telephone).length < MIN_PHONE_DIGITS) {
        return NextResponse.json({ error: 'Numéro de téléphone requis pour la connexion du point de vente.' }, { status: 400 });
      }
      if ((await findPosAccountsByPhone(telephone)).length > 0) {
        return NextResponse.json({ error: 'Ce numéro est déjà utilisé par un autre point de vente.' }, { status: 409 });
      }
    }
    if (typeof mot_de_passe !== 'string' || mot_de_passe.length < 6) {
      return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const clientSupabase = createServerClient(undefined, undefined, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
      }
    });

    // Les accès point de vente (consultation seule) ne comptent pas dans le nombre d'utilisateurs
    // du forfait : ils sont déjà limités à un par point de vente.
    const quotaCheck = isPosAccountRole ? { allowed: true, message: '' } : await checkQuota(clientSupabase, orgId, 'users');
    if (!quotaCheck.allowed) {
      return NextResponse.json({
        error: quotaCheck.message
      }, { status: 403 });
    }
    // Nombre de collecteurs limité par le forfait
    if (role === 'collecteur') {
      const collectorCheck = await checkQuota(clientSupabase, orgId, 'collectors');
      if (!collectorCheck.allowed) {
        return NextResponse.json({ error: collectorCheck.message }, { status: 403 });
      }
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: String(email).trim().toLowerCase(),
      password: mot_de_passe,
      email_confirm: true,
      user_metadata: {
        nom: nom.trim(),
        role,
        telephone: telephone || null,
        organization_id: orgId,
      },
    });

    if (authError) {
      console.error('Auth createUser error:', JSON.stringify(authError, null, 2));
      if (authError.message?.includes('Database error creating new user')) {
        return NextResponse.json(
          {
            error:
              'Impossible de créer l\'utilisateur. Le trigger Supabase handle_new_user est probablement cassé. ' +
              'Exécutez le script SQL supabase/fix_trigger_telephone.sql dans le SQL Editor de Supabase, puis redémarrez le serveur.',
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: 'Impossible de créer ce compte (email déjà utilisé ?).' }, { status: 400 });
    }

    if (!authData?.user) {
      return NextResponse.json({ error: 'Erreur lors de la création de l\'utilisateur.' }, { status: 500 });
    }

    // Mot de passe fixé par l'administrateur : le membre devra choisir le sien à sa première connexion
    await setMustChangePassword(authData.user.id, true);

    const profile: Record<string, unknown> = {
      id: authData.user.id,
      nom: nom.trim(),
      email: email.trim().toLowerCase(),
      role,
      organization_id: orgId,
    };
    if (posId) {
      profile.pos_id = posId;
      // Le numéro de connexion devient aussi celui de la fiche du point de vente
      await query(`UPDATE points_of_sale SET telephone = $1, updated_at = NOW() WHERE id = $2 AND organization_id = $3`, [
        String(telephone).trim(),
        posId,
        orgId,
      ]);
    }

    if (telephone) {
      profile.telephone = telephone;
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(profile, { onConflict: 'id' });

    if (profileError) {
      console.warn('Profile upsert warning:', profileError.message);
    }

    const { data: savedProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (fetchError) {
      console.warn('Profile fetch warning:', fetchError.message);
    }

    const creatorId = ctx.userId;
    notifyInBackground(() =>
      notifyOrganizationAdmins(
        orgId,
        {
          type: 'team.member_added',
          title: 'Nouveau membre dans l’équipe',
          body: `${String(nom).trim()} a été ajouté comme ${ROLE_LABELS[role] ?? 'collecteur'}.`,
          link: '/users',
        },
        creatorId
      )
    );

    // Invitation par e-mail avec les accès (si demandé et si l'envoi d'e-mails est configuré)
    let emailSent = false;
    if (sendByEmail && isEmailConfigured()) {
      const info = await query(
        `SELECT o.name AS org, p.nom AS inviter FROM organizations o LEFT JOIN profiles p ON p.id = $2 WHERE o.id = $1`,
        [orgId, ctx.userId]
      );
      const sent = await sendInvitationEmail({
        to: String(email).trim().toLowerCase(),
        name: String(nom).trim(),
        organizationName: info.rows[0]?.org || 'votre organisation',
        inviterName: info.rows[0]?.inviter || null,
        role: role === 'administrateur' || role === 'point_de_vente' ? role : 'collecteur',
        loginUrl: appUrl('/login', request),
        temporaryPassword: mot_de_passe,
      });
      emailSent = sent.success;
      if (!sent.success) console.error('Invitation email not sent:', sent.error);
    }

    return NextResponse.json({
      success: true,
      profile: savedProfile ?? profile,
      // Accès à transmettre au membre (affichés une seule fois : le mot de passe n'est pas conservé en clair)
      access: {
        email: String(email).trim().toLowerCase(),
        temporary_password: mot_de_passe,
        login_url: appUrl('/login', request),
        // Point de vente : il se connecte avec ce numéro
        ...(posId ? { login_phone: String(telephone).trim(), email_is_internal: !hasRealEmail } : {}),
      },
      email_sent: emailSent,
    });
  } catch (error: unknown) {
    console.error('Create user error:', error);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}
