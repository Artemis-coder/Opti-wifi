import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { getSessionContext } from '@/lib/tenant';
import { query } from '@/lib/neon/db';
import { trackServer } from '@/lib/analytics/server';
import { EVENTS } from '@/lib/analytics/events';

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
  return createServerClient(undefined, undefined, {
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

async function requireAuth(supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>) {
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

  if (profile.role !== 'administrateur' && profile.role !== 'collecteur') {
    return { error: NextResponse.json({ error: 'Accès refusé: privilèges insuffisants.' }, { status: 403 }) };
  }

  return { user };
}

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();

  const authResult = await requireAuth(supabase);
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

    // Accepter à la fois ticket_type_id (snake_case) et ticketTypeId (camelCase)
    const returnsPayload = body.returns.map((r: { ticket_type_id?: string; ticketTypeId?: string; quantite?: number | string }) => ({
      ticket_type_id: r.ticket_type_id || r.ticketTypeId,
      quantite: Math.max(0, parseInt(String(r.quantite), 10) || 0),
    }));

    const receivesPayload = body.receives.map((r: { ticket_type_id?: string; ticketTypeId?: string; quantite?: number | string }) => ({
      ticket_type_id: r.ticket_type_id || r.ticketTypeId,
      quantite: Math.max(0, parseInt(String(r.quantite), 10) || 0),
    }));

    if (returnsPayload.some((r) => !r.ticket_type_id || r.quantite <= 0)) {
      return NextResponse.json({ error: 'Chaque ticket à rendre doit avoir un identifiant et une quantité valide (> 0).' }, { status: 400 });
    }

    if (receivesPayload.some((r) => !r.ticket_type_id || r.quantite <= 0)) {
      return NextResponse.json({ error: 'Chaque ticket à recevoir doit avoir un identifiant et une quantité valide (> 0).' }, { status: 400 });
    }

    // Le POS et les types de tickets doivent appartenir à l'organisation de l'utilisateur.
    const ctx = await getSessionContext();
    if (!ctx) {
      return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
    }
    if (ctx.organizationBlocked && !ctx.isPlatformAdmin) {
      return NextResponse.json({ error: 'Accès suspendu pour cette organisation.' }, { status: 403 });
    }
    if (!ctx.isPlatformAdmin) {
      const ticketTypeIds = [...new Set([...returnsPayload, ...receivesPayload].map((r) => r.ticket_type_id as string))];
      const owned = await query(
        `SELECT
           (SELECT COUNT(*) FROM points_of_sale WHERE id = $1 AND organization_id = $2) AS pos_ok,
           (SELECT COUNT(*) FROM ticket_types WHERE id = ANY($3::uuid[]) AND organization_id = $2) AS types_ok`,
        [body.pos_id, ctx.organizationId, ticketTypeIds]
      );
      const row = owned.rows[0];
      if (Number(row?.pos_ok) !== 1 || Number(row?.types_ok) !== ticketTypeIds.length) {
        return NextResponse.json({ error: 'Point de vente ou type de ticket introuvable.' }, { status: 404 });
      }
    }

    const { data, error } = await supabase.rpc('perform_ticket_exchange', {
      p_pos_id: body.pos_id,
      p_space_id: body.space_id || null,
      p_notes: body.notes || null,
      p_user_id: user.id,
      p_returns: returnsPayload,
      p_receives: receivesPayload,
    });

    if (error) {
      console.error('RPC perform_ticket_exchange error:', error);
      return NextResponse.json({ error: error.message || 'Erreur lors de l\'échange de tickets.' }, { status: 500 });
    }

    const result = data as { success: boolean; message: string; exchange_group_id?: string };
    if (!result?.success) {
      return NextResponse.json({ error: result?.message || 'Échec de l\'échange.' }, { status: 400 });
    }

    const sum = (items: { quantite: number }[]) => items.reduce((n, r) => n + r.quantite, 0);
    trackServer(user.id, EVENTS.ticketsExchanged, {
      organization_id: ctx.organizationId ?? null,
      pos_id: body.pos_id,
      tickets_returned: sum(returnsPayload),
      tickets_received: sum(receivesPayload),
    });

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
