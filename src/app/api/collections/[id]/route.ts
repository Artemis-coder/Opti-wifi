import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { getSessionContext, canAccessOrganization } from '@/lib/tenant';

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
    const ctx = await getSessionContext();
    if (!ctx) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    const { id } = await params;
    const supabase = await getSupabaseServerClient();

    const { data: collection, error } = await supabase
      .from('collections')
      .select(
        `*,
         pos:points_of_sale(*),
         collecteur:profiles(*),
         items:collection_items(
           *,
           ticket_type:ticket_types(*)
         )`
      )
      .eq('id', id)
      .single();

    if (
      error ||
      !collection ||
      !canAccessOrganization(ctx, collection.organization_id || collection.organisation_id)
    ) {
      console.error('Collection detail error:', error);
      return NextResponse.json(
        { error: 'Collecte introuvable', details: error?.message },
        { status: 404 }
      );
    }

    return NextResponse.json(collection);
  } catch (e: unknown) {
    console.error('Collection detail exception:', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
