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
      return NextResponse.json({ error: allocError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      allocation,
    });
  } catch (error: unknown) {
    console.error('Erreur allocation:', error);
    const message = error instanceof Error ? error.message : 'Erreur interne du serveur.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}