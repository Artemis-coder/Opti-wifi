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

    const quotaCheck = await checkQuota(supabase, orgId, 'tickets_per_month');
    if (!quotaCheck.allowed) {
      return NextResponse.json({
        error: quotaCheck.message
      }, { status: 403 });
    }

    const body = await request.json();
    const { pos_id, collecteur_id, space_id, statut, montant_attendu, montant_collecte, commission, date_collecte, notes } = body;

    if (!pos_id || !collecteur_id || !montant_attendu || !montant_collecte) {
      return NextResponse.json({
        error: 'Champs requis manquants: pos_id, collecteur_id, montant_attendu, montant_collecte'
      }, { status: 400 });
    }

    // Le POS et le collecteur doivent appartenir à l'organisation de l'utilisateur
    const [posCheck, collecteurCheck] = await Promise.all([
      supabase.from('points_of_sale').select('id').eq('id', pos_id).eq('organization_id', orgId).maybeSingle(),
      supabase.from('profiles').select('id').eq('id', collecteur_id).eq('organization_id', orgId).maybeSingle(),
    ]);
    if (!posCheck.data || !collecteurCheck.data) {
      return NextResponse.json({ error: 'Point de vente ou collecteur introuvable.' }, { status: 404 });
    }

    const { data: collection, error: colError } = await supabase
      .from('collections')
      .insert({
        pos_id,
        collecteur_id,
        space_id: space_id || null,
        organisation_id: orgId,
        organization_id: orgId,
        statut: statut || 'validee',
        montant_attendu: montant_attendu,
        montant_collecte: montant_collecte,
        commission: commission || 0,
        date_collecte: date_collecte || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (colError) {
      console.error('Erreur création collecte:', colError);
      return NextResponse.json({ error: 'Erreur lors de la création de la collecte.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      collection,
    });
  } catch (error: unknown) {
    console.error('Erreur collecte:', error);
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
  }
}