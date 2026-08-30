import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nom, email, role, telephone, mot_de_passe } = body;

    if (!nom || !email || !mot_de_passe) {
      return NextResponse.json(
        { error: 'Les champs nom, email et mot de passe sont requis.' },
        { status: 400 }
      );
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: mot_de_passe,
      email_confirm: true,
      user_metadata: {
        nom: nom.trim(),
        role,
        telephone: telephone || null,
      },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const profile: Record<string, unknown> = {
      id: authData.user.id,
      nom: nom.trim(),
      email: email.trim().toLowerCase(),
      role,
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
