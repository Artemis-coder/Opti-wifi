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

    const { data: allocation, error: allocError } = await supabase
      .from('ticket_allocations')
      .select('*, pos:points_of_sale(*), ticket_type:ticket_types(*)')
      .eq('id', id)
      .single();

    if (allocError || !allocation) {
      console.error('Allocation detail error:', allocError);
      return NextResponse.json(
        { error: 'Allocation introuvable', details: allocError?.message },
        { status: 404 }
      );
    }

    let allocatorProfile = null;
    if (allocation.alloue_par) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', allocation.alloue_par)
        .single();
      allocatorProfile = profile || null;
    }

    let exchangeOperations = [];
    if (allocation.exchange_group_id) {
      const { data: ops } = await supabase
        .from('ticket_allocations')
        .select('*, ticket_type:ticket_types(*)')
        .eq('exchange_group_id', allocation.exchange_group_id);
      exchangeOperations = ops || [];
    }

    return NextResponse.json({
      ...allocation,
      allocateur: allocatorProfile,
      exchangeOperations,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur interne';
    console.error('Allocation detail exception:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
