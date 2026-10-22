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
  { params }: { params: { id: string } }
) {
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
    .eq('id', params.id)
    .single();

  if (error || !collection) {
    return NextResponse.json(
      { error: 'Collecte introuvable' },
      { status: 404 }
    );
  }

  return NextResponse.json(collection);
}
