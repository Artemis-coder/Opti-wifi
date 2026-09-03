import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const cookieStore = await cookies();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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

  if (!platformUser || !platformUser.is_active) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const [orgRes, subRes, historyRes, paymentsRes, usersRes, posRes] = await Promise.all([
    supabase.from('organizations').select('*').eq('id', id).single(),
    supabase
      .from('subscriptions')
      .select('*, plan:subscription_plans(*)')
      .eq('organization_id', id)
      .order('created_at', { ascending: false })
      .maybeSingle(),
    supabase
      .from('subscriptions')
      .select('*, plan:subscription_plans(name,price,currency)')
      .eq('organization_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('payments')
      .select('*')
      .eq('organization_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('id, nom, email, role, created_at, updated_at')
      .eq('organization_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('points_of_sale')
      .select('id, nom, statut, created_at')
      .eq('organization_id', id)
      .order('created_at', { ascending: false }),
  ]);

  if (orgRes.error || !orgRes.data) {
    return NextResponse.json({ error: 'Organisation introuvable' }, { status: 404 });
  }

  const org = orgRes.data;

  const userCountResult = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', id);

  const posCountResult = await supabase
    .from('points_of_sale')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', id);

  const allocationCountResult = await supabase
    .from('ticket_allocations')
    .select('quantite', { count: 'exact' })
    .eq('organization_id', id);

  const ticketsSoldResult = await supabase
    .from('collection_items')
    .select('quantite_vendue', { count: 'exact' })
    .eq('organization_id', id);

  const collectionsResult = await supabase
    .from('collections')
    .select('montant_collecte', { count: 'exact' })
    .eq('organization_id', id);

  let totalAllocated = 0;
  let ticketsSold = 0;
  let revenue = 0;
  let collectionCount = 0;

  if (allocationCountResult.data) {
    totalAllocated = allocationCountResult.data.reduce((acc, curr) => acc + (Number(curr.quantite) || 0), 0);
  }

  if (ticketsSoldResult.data) {
    ticketsSold = ticketsSoldResult.data.reduce(
      (acc, curr) => acc + (Number(curr.quantite_vendue) || 0),
      0
    );
  }

  if (collectionsResult.data) {
    collectionCount = collectionsResult.data.length;
    revenue = collectionsResult.data.reduce(
      (acc, curr) => acc + Number(curr.montant_collecte || 0),
      0
    );
  }

  const lastActivityResult = await supabase
    .from('collections')
    .select('created_at', { count: 'exact', head: true })
    .eq('organization_id', id)
    .order('created_at', { ascending: false })
    .maybeSingle();

  const enrichedOrg = {
    ...org,
    user_count: userCountResult.count || 0,
    pos_count: posCountResult.count || 0,
    ticket_allocated: totalAllocated,
    tickets_sold: ticketsSold,
    revenue: revenue,
    collection_count: collectionCount,
    last_activity: lastActivityResult.data?.created_at || null,
  };

  return NextResponse.json({
    data: {
      organization: enrichedOrg,
      subscription: subRes.data || null,
      subscriptions_history: historyRes.data || [],
      payments: paymentsRes.data || [],
      users: usersRes.data || [],
      pos: posRes.data || [],
    },
  });
}
