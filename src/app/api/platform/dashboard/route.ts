import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getDashboardKpis } from '@/lib/platform-dashboard';
import { getPlatformStats, parseStatsRange } from '@/lib/platform-stats';
import { getClientCountries } from '@/lib/geo';

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

  const { data: platformUser, error: puError } = await supabase
    .from('platform_users')
    .select('role, is_active')
    .eq('auth_user_id', user.id)
    .single();

  if (puError || !platformUser || !platformUser.is_active) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const range = searchParams.get('range') || '30d';

  // KPI et éléments à traiter : source unique partagée avec la Mini App Telegram et le bot
  let kpis = null;
  let todo = null;
  try {
    ({ kpis, todo } = await getDashboardKpis());
  } catch (err) {
    console.error('Platform dashboard kpis error:', err);
    return NextResponse.json({ error: 'Erreur lors du chargement du tableau de bord' }, { status: 500 });
  }

  // Statistiques (inscriptions, licences, revenus, répartition) par tranche de temps
  let stats = null;
  try {
    stats = await getPlatformStats(parseStatsRange(range));
  } catch (err) {
    console.error('Platform dashboard stats error:', err);
  }

  // Pays des clients (Top 3 sur le tableau de bord)
  let countries = null;
  try {
    countries = await getClientCountries();
  } catch (err) {
    console.error('Platform dashboard countries error:', err);
  }

  return NextResponse.json({ kpis, todo, stats, countries });
}
