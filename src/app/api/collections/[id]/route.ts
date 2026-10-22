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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await getSupabaseServerClient();

    // 1. Charger la collecte avec POS et collecteur
    const { data: collection, error: colError } = await supabase
      .from('collections')
      .select('*, pos:points_of_sale(*), collecteur:profiles(*)')
      .eq('id', id)
      .single();

    if (colError || !collection) {
      console.error('[API /collections/[id]] Erreur collecte:', colError);
      return NextResponse.json(
        { error: 'Collecte introuvable', details: colError?.message },
        { status: 404 }
      );
    }

    // 2. Charger les items avec le type de ticket
    const { data: items, error: itemsError } = await supabase
      .from('collection_items')
      .select('*, ticket_type:ticket_types(*)')
      .eq('collection_id', id);

    if (itemsError) {
      console.warn('[API /collections/[id]] Erreur items:', itemsError);
    }

    return NextResponse.json({
      ...collection,
      items: items || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur interne';
    console.error('[API /collections/[id]] Exception:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
