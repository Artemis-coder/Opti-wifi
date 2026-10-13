import { adminClient } from '@/lib/neon/admin';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = adminClient;

    const body = await request.json();
    const { nom, email, role, telephone, mot_de_passe } = body;

    if (!nom || !email || !mot_de_passe) {
      return NextResponse.json(
        { error: 'Les champs nom, email et mot de passe sont requis.' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const clientSupabase = createServerClient(undefined, undefined, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
      }
    });

    const { data: { user: callerUser } } = await clientSupabase.auth.getUser();
    let orgId: string | null = null;

    if (callerUser) {
      const { data: callerProfile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', callerUser.id)
        .single();

      orgId = callerProfile?.organization_id || null;

      if (orgId) {
        // Check active subscription quota
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('*, plan:subscription_plans(*)')
          .eq('organization_id', orgId)
          .in('status', ['active', 'trialing'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (sub?.plan && typeof sub.plan.max_users === 'number') {
          const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', orgId);

          if (count !== null && count >= sub.plan.max_users) {
            return NextResponse.json({
              error: `Limite d'utilisateurs atteinte (${count}/${sub.plan.max_users}) pour le forfait "${sub.plan.name}". Veuillez mettre à niveau votre abonnement pour ajouter d'autres membres.`
            }, { status: 403 });
          }
        }
      }
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
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
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (!authData?.user) {
      return NextResponse.json({ error: 'Erreur lors de la création de l\'utilisateur.' }, { status: 500 });
    }

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

    return NextResponse.json({
      success: true,
      profile: savedProfile ?? profile,
    });
  } catch (error: unknown) {
    console.error('Create user error:', error);
    const message = error instanceof Error ? error.message : 'Erreur interne du serveur.';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
