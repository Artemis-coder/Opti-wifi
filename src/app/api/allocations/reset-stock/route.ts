import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Supabase environment variables are not configured. ' +
    'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local or your deployment environment.'
  );
}

interface ResetStockBody {
  organization_id: string;
  pos_id: string;
}

async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        );
      },
    },
  });
}

async function requireAdmin(supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: NextResponse.json({ error: 'Authentification requise.' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return { error: NextResponse.json({ error: 'Profil utilisateur introuvable.' }, { status: 403 }) };
  }

  if (profile.role !== 'administrateur') {
    return { error: NextResponse.json({ error: 'Accès refusé: privilèges insuffisants.' }, { status: 403 }) };
  }

  return { user, profile };
}

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();

  const authResult = await requireAdmin(supabase);
  if (authResult.error) {
    return authResult.error;
  }

  const { profile } = authResult;

  try {
    const body: ResetStockBody = await request.json();

    if (!body.organization_id) {
      return NextResponse.json({ error: 'organization_id est requis.' }, { status: 400 });
    }

    if (!body.pos_id) {
      return NextResponse.json({ error: 'pos_id est requis.' }, { status: 400 });
    }

    if (profile.organization_id !== body.organization_id) {
      return NextResponse.json({ error: 'Accès refusé: organisation invalide.' }, { status: 403 });
    }

    const { error } = await supabase
      .from('ticket_allocations')
      .delete()
      .eq('organization_id', body.organization_id)
      .eq('pos_id', body.pos_id);

    if (error) {
      console.error('Reset stock error:', error);
      return NextResponse.json({ error: error.message || 'Erreur lors de la réinitialisation du stock.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Le stock du point de vente a été réinitialisé avec succès.',
    });
  } catch (error: unknown) {
    console.error('Reset stock error:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur. Veuillez contacter l\'administrateur.' },
      { status: 500 }
    );
  }
}