import { createServerClient } from '@/lib/neon/server';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { checkQuota, getUserOrganizationId } from '@/lib/quotas';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(undefined, undefined, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    });

    const { data: { user: callerUser } } = await supabase.auth.getUser();
    const orgId = callerUser ? await getUserOrganizationId(supabase) : null;

    if (!orgId) {
      return NextResponse.json({ error: 'Organisation requise.' }, { status: 400 });
    }

    const body = await request.json();
    const { pos_id, ticket_type_id, quantite, notes, space_id, date_allocation } = body;

    if (!pos_id || !ticket_type_id || !quantite || quantite <= 0) {
      return NextResponse.json({
        error: 'Champs requis manquants: pos_id, ticket_type_id, quantite (> 0)'
      }, { status: 400 });
    }

    const quotaCheck = await checkQuota(supabase, orgId, 'tickets_per_month');
    if (!quotaCheck.allowed) {
      return NextResponse.json({
        error: quotaCheck.message
      }, { status: 403 });
    }

    // Le POS et le type de ticket doivent appartenir à l'organisation de l'utilisateur
    const [posCheck, typeCheck] = await Promise.all([
      supabase.from('points_of_sale').select('id').eq('id', pos_id).eq('organization_id', orgId).maybeSingle(),
      supabase.from('ticket_types').select('id').eq('id', ticket_type_id).eq('organization_id', orgId).maybeSingle(),
    ]);
    if (!posCheck.data || !typeCheck.data) {
      return NextResponse.json({ error: 'Point de vente ou type de ticket introuvable.' }, { status: 404 });
    }

    const { data: allocation, error: allocError } = await supabase
      .from('ticket_allocations')
      .insert({
        pos_id,
        ticket_type_id,
        quantite,
        notes: notes || null,
        space_id: space_id || null,
        organization_id: orgId,
        date_allocation: date_allocation || null,
      })
      .select()
      .single();

    if (allocError) {
      console.error('Erreur création allocation:', allocError);
      return NextResponse.json({ error: "Erreur lors de la création de l'allocation." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      allocation,
    });
  } catch (error: unknown) {
    console.error('Erreur allocation:', error);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}