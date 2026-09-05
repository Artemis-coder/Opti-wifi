import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'Supabase environment variables are not configured. ' +
    'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local'
  );
}

function getSupabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY n\'est pas configurée.' },
        { status: 500 }
      );
    }

    const supabase = getSupabaseAdmin();

    const body = await request.json();
    const { nom, email, role, telephone, mot_de_passe } = body;

    if (!nom || !email || !mot_de_passe) {
      return NextResponse.json(
        { error: 'Les champs nom, email et mot de passe sont requis.' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const clientSupabase = createServerClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
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
