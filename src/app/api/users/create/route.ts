import { adminClient } from '@/lib/neon/admin';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { checkQuota } from '@/lib/quotas';
import { getSessionContext } from '@/lib/tenant';
import { setMustChangePassword } from '@/lib/password-change';
import { rejectTestEmailInProduction } from '@/lib/test-accounts';
import { notifyInBackground, notifyOrganizationAdmins } from '@/lib/notifications';

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
    const orgId = ctx.organizationId;

    const body = await request.json();
    const { nom, email, telephone, mot_de_passe } = body;
    const role = body.role || 'collecteur';

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
    if (!['administrateur', 'collecteur'].includes(role)) {
      return NextResponse.json({ error: 'Rôle invalide.' }, { status: 400 });
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

    const quotaCheck = await checkQuota(clientSupabase, orgId, 'users');
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
          body: `${String(nom).trim()} a été ajouté comme ${role === 'administrateur' ? 'administrateur' : 'collecteur'}.`,
          link: '/users',
        },
        creatorId
      )
    );

    return NextResponse.json({
      success: true,
      profile: savedProfile ?? profile,
    });
  } catch (error: unknown) {
    console.error('Create user error:', error);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}
