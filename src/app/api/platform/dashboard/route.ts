import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { Organization, Subscription, Payment } from "@/types/platform";
import { query } from '@/lib/neon/db';
import { getPlatformStats, parseStatsRange } from '@/lib/platform-stats';
import { getClientCountries } from '@/lib/geo';

// Licences « alarmantes » : se terminent dans les 7 prochains jours sans renouvellement prévu
const ALARMING_EXPIRY = `s.status IN ('active', 'trialing') AND s.end_date BETWEEN NOW() AND NOW() + interval '7 days'
            AND o.status NOT IN ('suspended', 'cancelled', 'archived')
            AND NOT EXISTS (SELECT 1 FROM subscriptions s2 WHERE s2.organization_id = s.organization_id AND s2.id <> s.id
                              AND s2.status IN ('active', 'trialing') AND s2.end_date > s.end_date)`;

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

  const now = new Date();

  const [orgsRes, subsRes, paymentsRes] = await Promise.all([
    supabase.from('organizations').select('id, status, created_at'),
    supabase.from('subscriptions').select('id, organization_id, plan_id, status, start_date, end_date, cancelled_at, created_at'),
    supabase.from('payments').select('id, organization_id, amount, currency, status, paid_at, created_at'),
  ]);

  const orgs = orgsRes.data || [];
  const subs = subsRes.data || [];
  const payments = paymentsRes.data || [];

  const nowISO = now.toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const totalClients = orgs.length;
  const activeClients = orgs.filter((o: Organization) => o.status === 'active').length;
  const suspendedClients = orgs.filter((o: Organization) => o.status === 'suspended').length;
  const newClientsWeek = orgs.filter((o: Organization) => o.created_at >= sevenDaysAgo).length;
  const newClientsMonth = orgs.filter((o: Organization) => o.created_at >= thirtyDaysAgo).length;

  const activeSubs = subs.filter((s: Subscription) => s.status === 'active' || s.status === 'trialing').length;
  const expiringSubs = subs.filter(
    (s: Subscription) => (s.status === 'active' || s.status === 'trialing') && s.end_date && s.end_date <= thirtyDaysAhead && s.end_date >= nowISO
  ).length;
  const expiredSubs = subs.filter((s: Subscription) => s.status === 'expired' || s.status === 'cancelled').length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekAgoISO = weekAgo.toISOString();

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStartISO = monthStart.toISOString();

  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearStartISO = yearStart.toISOString();

  const paidToday = payments.filter(
    (p: Payment) => p.status === 'successful' && p.paid_at && p.paid_at >= todayISO
  ).reduce((acc: number, p: Payment) => acc + Number(p.amount), 0);

  const paidWeek = payments.filter(
    (p: Payment) => p.status === 'successful' && p.paid_at && p.paid_at >= weekAgoISO
  ).reduce((acc: number, p: Payment) => acc + Number(p.amount), 0);

  const paidMonth = payments.filter(
    (p: Payment) => p.status === 'successful' && p.paid_at && p.paid_at >= monthStartISO
  ).reduce((acc: number, p: Payment) => acc + Number(p.amount), 0);

  const paidYear = payments.filter(
    (p: Payment) => p.status === 'successful' && p.paid_at && p.paid_at >= yearStartISO
  ).reduce((acc: number, p: Payment) => acc + Number(p.amount), 0);

  const currency = payments.find((p: Payment) => p.currency)?.currency || 'XOF';

  const kpis = {
    total_clients: totalClients,
    active_clients: activeClients,
    suspended_clients: suspendedClients,
    new_clients_this_week: newClientsWeek,
    new_clients_this_month: newClientsMonth,
    active_subscriptions: activeSubs,
    expiring_subscriptions: expiringSubs,
    expired_subscriptions: expiredSubs,
    revenue_today: paidToday,
    revenue_this_week: paidWeek,
    revenue_this_month: paidMonth,
    revenue_this_year: paidYear,
    currency,
  };

  // Éléments à traiter par le super admin
  let todo = {
    pending_registrations: [] as unknown[],
    pending_license_requests: [] as unknown[],
    upcoming_expirations: [] as unknown[],
  };
  try {
    const [regRes, reqRes, expRes, countsRes] = await Promise.all([
      query(
        `SELECT id, name, contact_name, email, phone, created_at
           FROM organizations WHERE status = 'pending_approval'
          ORDER BY created_at ASC LIMIT 5`
      ),
      query(
        `SELECT r.id, r.type, r.duration_months, r.created_at, o.id AS organization_id, o.name AS organization_name,
                p.name AS plan_name
           FROM license_requests r
           JOIN organizations o ON o.id = r.organization_id
           LEFT JOIN subscription_plans p ON p.id = r.plan_id
          WHERE r.status = 'pending'
          ORDER BY r.created_at ASC LIMIT 5`
      ),
      query(
        `SELECT s.id, s.end_date, o.id AS organization_id, o.name AS organization_name, p.name AS plan_name,
                COALESCE(p.trial_days, 0) > 0 AS is_trial,
                CEIL(EXTRACT(EPOCH FROM (s.end_date - NOW())) / 86400)::int AS days_left
           FROM subscriptions s
           JOIN organizations o ON o.id = s.organization_id
           LEFT JOIN subscription_plans p ON p.id = s.plan_id
          WHERE ${ALARMING_EXPIRY}
          ORDER BY s.end_date ASC LIMIT 5`
      ),
      query(
        `SELECT
           (SELECT COUNT(*) FROM organizations WHERE status = 'pending_approval') AS pending_registrations,
           (SELECT COUNT(*) FROM license_requests WHERE status = 'pending') AS pending_license_requests,
           (SELECT COUNT(*) FROM subscriptions s JOIN organizations o ON o.id = s.organization_id
             WHERE ${ALARMING_EXPIRY}) AS expiring_7d,
           (SELECT COUNT(*) FROM organizations o
             WHERE o.status IN ('active', 'trial', 'expiring')
               AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.organization_id = o.id
                                 AND s.status IN ('active', 'trialing') AND s.end_date > NOW())) AS clients_without_license`
      ),
    ]);
    todo = {
      pending_registrations: regRes.rows,
      pending_license_requests: reqRes.rows,
      upcoming_expirations: expRes.rows,
    };
    const c = countsRes.rows[0] || {};
    Object.assign(kpis, {
      pending_registrations: Number(c.pending_registrations || 0),
      pending_license_requests: Number(c.pending_license_requests || 0),
      expiring_7d: Number(c.expiring_7d || 0),
      clients_without_license: Number(c.clients_without_license || 0),
    });
  } catch (err) {
    console.error('Platform dashboard todo error:', err);
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
