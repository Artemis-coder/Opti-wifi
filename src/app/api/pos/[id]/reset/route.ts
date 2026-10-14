import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await getSupabaseServerClient();

  // ── Auth & Admin check ───────────────────────────────────────────
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profil introuvable.' }, { status: 403 });
  }

  if (profile.role !== 'administrateur') {
    return NextResponse.json(
      { error: 'Accès refusé : seul un administrateur peut vider les données d\'un POS.' },
      { status: 403 }
    );
  }

  // ── Resolve posId ────────────────────────────────────────────────
  const { id: posId } = await params;

  if (!posId) {
    return NextResponse.json({ error: 'Identifiant du POS manquant.' }, { status: 400 });
  }

  // ── Verify POS exists and belongs to this org ────────────────────
  const { data: posData, error: posError } = await supabase
    .from('points_of_sale')
    .select('id')
    .eq('id', posId)
    .single();

  if (posError || !posData) {
    return NextResponse.json({ error: 'Point de vente introuvable.' }, { status: 404 });
  }

  // ── Step 1: Fetch collection IDs for this POS ────────────────────
  const { data: collectionsData, error: colFetchError } = await supabase
    .from('collections')
    .select('id')
    .eq('pos_id', posId);

  if (colFetchError) {
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des collectes.' },
      { status: 500 }
    );
  }

  const collectionIds = (collectionsData || []).map((c: { id: string }) => c.id);

  // ── Step 2: Delete collection_items ─────────────────────────────
  if (collectionIds.length > 0) {
    const { error: itemsError } = await supabase
      .from('collection_items')
      .delete()
      .in('collection_id', collectionIds);

    if (itemsError) {
      return NextResponse.json(
        { error: 'Erreur lors de la suppression des lignes de collecte.' },
        { status: 500 }
      );
    }
  }

  // ── Step 3: Delete collections ───────────────────────────────────
  const { error: collectionsError } = await supabase
    .from('collections')
    .delete()
    .eq('pos_id', posId);

  if (collectionsError) {
    return NextResponse.json(
      { error: 'Erreur lors de la suppression des collectes.' },
      { status: 500 }
    );
  }

  // ── Step 4: Delete ticket_allocations ───────────────────────────
  const { error: allocError } = await supabase
    .from('ticket_allocations')
    .delete()
    .eq('pos_id', posId);

  if (allocError) {
    return NextResponse.json(
      { error: 'Erreur lors de la suppression des allocations de tickets.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'Données du POS vidées avec succès.',
    deletedCollections: collectionIds.length,
  });
}
