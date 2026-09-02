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

interface ExchangeItem {
  ticket_type_id: string;
  quantite: number;
}

interface RequestBody {
  pos_id: string;
  space_id?: string | null;
  notes?: string | null;
  returns: ExchangeItem[];
  receives: ExchangeItem[];
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
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return { error: NextResponse.json({ error: 'Profil utilisateur introuvable.' }, { status: 403 }) };
  }

  if (profile.role !== 'administrateur') {
    return { error: NextResponse.json({ error: 'Accès refusé: privilèges administrateur requis.' }, { status: 403 }) };
  }

  return { user };
}

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();

  const authResult = await requireAdmin(supabase);
  if (authResult.error) {
    return authResult.error;
  }

  const { user } = authResult;

  try {
    const body: RequestBody = await request.json();

    if (!body.pos_id) {
      return NextResponse.json({ error: 'Le point de vente est requis.' }, { status: 400 });
    }

    if (!Array.isArray(body.returns) || body.returns.length === 0) {
      return NextResponse.json({ error: 'Au moins un ticket à rendre est requis.' }, { status: 400 });
    }

    if (!Array.isArray(body.receives) || body.receives.length === 0) {
      return NextResponse.json({ error: 'Au moins un ticket à recevoir est requis.' }, { status: 400 });
    }

    const returnsPayload = body.returns.map((r) => ({
      ticket_type_id: r.ticket_type_id,
      quantite: Math.max(0, parseInt(String(r.quantite), 10) || 0),
    }));

    const receivesPayload = body.receives.map((r) => ({
      ticket_type_id: r.ticket_type_id,
      quantite: Math.max(0, parseInt(String(r.quantite), 10) || 0),
    }));

    const { data, error } = await supabase.rpc('perform_ticket_exchange', {
      p_pos_id: body.pos_id,
      p_space_id: body.space_id || null,
      p_notes: body.notes || null,
      p_user_id: user.id,
      p_returns: returnsPayload,
      p_receives: receivesPayload,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = data as { success: boolean; message: string; exchange_group_id?: string };
    if (!result?.success) {
      return NextResponse.json({ error: result?.message || 'Échec de l\'échange.' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      exchange_group_id: result.exchange_group_id,
    });
  } catch (error: unknown) {
    console.error('Exchange error:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur. Veuillez contacter l\'administrateur.' },
      { status: 500 }
    );
  }
}
