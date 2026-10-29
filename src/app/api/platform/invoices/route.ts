import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/neon/admin';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getInvoiceStats } from '@/lib/billing-stats';

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(undefined, undefined, {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { data: platformUser } = await supabase
    .from('platform_users')
    .select('role, is_active')
    .eq('auth_user_id', user.id)
    .single();

  if (!platformUser || !platformUser.is_active || platformUser.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const adminClient = createAdminClient();

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status') || 'all';
  const search = searchParams.get('search') || '';

  let query = adminClient
    .from('invoices')
    .select(`
      *,
      organization:organizations!inner(name, email)
    `)
    .order('created_at', { ascending: false });

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  if (search) {
    query = query.ilike('organization.name', `%${search}%`);
  }

  const { data: invoices, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Chiffres clés (toutes périodes + mois en cours), indépendants des filtres de la liste
  const stats = await getInvoiceStats().catch((err) => {
    console.error('Billing stats error:', err);
    return null;
  });

  return NextResponse.json({ data: invoices, stats });
}
