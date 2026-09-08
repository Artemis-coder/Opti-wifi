import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET() {
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

  // Récupérer le profil avec l'organisation
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json({ error: 'Organisation non trouvée' }, { status: 404 });
  }

  // Récupérer tous les abonnements de l'organisation
  const { data: subscriptions, error } = await supabase
    .from('subscriptions')
    .select(`
      *,
      plan:subscription_plans(id, name, price, currency, billing_period, trial_days, max_users, max_points_of_sale, max_tickets_per_month)
    `)
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Séparer l'abonnement en cours des autres
  const activeStatuses = ['trialing', 'active', 'past_due'];
  const current = subscriptions?.find((s) => activeStatuses.includes(s.status)) || null;
  const others = subscriptions?.filter((s) => s.id !== current?.id) || [];

  return NextResponse.json({
    current,
    others,
  });
}
