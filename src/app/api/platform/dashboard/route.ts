import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: Request) {
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

  let rangeStart: Date;
  const now = new Date();

  switch (range) {
    case '7d':
      rangeStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      rangeStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      rangeStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '6m':
      rangeStart = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      break;
    case '1y':
      rangeStart = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      rangeStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  const rangeStartISO = rangeStart.toISOString();

  const [orgsRes, subsRes, paymentsRes, plansRes, orgsInRangeRes] = await Promise.all([
    supabase.from('organizations').select('id, status, created_at'),
    supabase.from('subscriptions').select('id, organization_id, plan_id, status, start_date, end_date, cancelled_at, created_at'),
    supabase.from('payments').select('id, organization_id, amount, currency, status, paid_at, created_at'),
    supabase.from('subscription_plans').select('id, name, created_at'),
    supabase.from('organizations').select('id, status, created_at').gte('created_at', rangeStartISO),
  ]);

  const orgs = orgsRes.data || [];
  const subs = subsRes.data || [];
  const payments = paymentsRes.data || [];
  const plans = plansRes.data || [];
  const orgsInRange = orgsInRangeRes.data || [];

  const nowISO = now.toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const totalClients = orgs.length;
  const activeClients = orgs.filter((o) => o.status === 'active').length;
  const suspendedClients = orgs.filter((o) => o.status === 'suspended').length;
  const newClientsWeek = orgs.filter((o) => o.created_at >= sevenDaysAgo).length;
  const newClientsMonth = orgs.filter((o) => o.created_at >= thirtyDaysAgo).length;

  const activeSubs = subs.filter((s) => s.status === 'active' || s.status === 'trialing').length;
  const expiringSubs = subs.filter(
    (s) => (s.status === 'active' || s.status === 'trialing') && s.end_date && s.end_date <= thirtyDaysAgo + 'T23:59:59' && s.end_date >= nowISO
  ).length;
  const expiredSubs = subs.filter((s) => s.status === 'expired' || s.status === 'cancelled').length;

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
    (p) => p.status === 'successful' && p.paid_at && p.paid_at >= todayISO
  ).reduce((acc, p) => acc + Number(p.amount), 0);

  const paidWeek = payments.filter(
    (p) => p.status === 'successful' && p.paid_at && p.paid_at >= weekAgoISO
  ).reduce((acc, p) => acc + Number(p.amount), 0);

  const paidMonth = payments.filter(
    (p) => p.status === 'successful' && p.paid_at && p.paid_at >= monthStartISO
  ).reduce((acc, p) => acc + Number(p.amount), 0);

  const paidYear = payments.filter(
    (p) => p.status === 'successful' && p.paid_at && p.paid_at >= yearStartISO
  ).reduce((acc, p) => acc + Number(p.amount), 0);

  const currency = payments.find((p) => p.currency)?.currency || 'XOF';

  // Chart: Registration evolution (daily buckets)
  const periodDays = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : range === '6m' ? 180 : 365;
  const chartStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const registrationsChart = [];
  for (let i = 0; i < periodDays; i++) {
    const dayStart = new Date(chartStart);
    dayStart.setDate(chartStart.getDate() + i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const dayISO = dayStart.toISOString();
    const dayStr = dayStart.toISOString().split('T')[0];

    const newAccounts = orgsInRange.filter(
      (o) => o.created_at >= dayStart.toISOString() && o.created_at <= dayEnd.toISOString()
    ).length;

    const activated = subs.filter(
      (s) => s.start_date && s.start_date >= dayISO && s.start_date <= dayEnd.toISOString()
    ).length;

    const deactivated = subs.filter(
      (s) => s.cancelled_at && s.cancelled_at >= dayISO && s.cancelled_at <= dayEnd.toISOString()
    ).length;

    registrationsChart.push({
      date: dayStr,
      new_accounts: newAccounts,
      activated,
      deactivated,
    });
  }

  // Chart: Subscription evolution
  const subsChart = [];
  for (let i = 0; i < periodDays; i++) {
    const dayStart = new Date(chartStart);
    dayStart.setDate(chartStart.getDate() + i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const dayISO = dayStart.toISOString();
    const dayStr = dayStart.toISOString().split('T')[0];

    const newSubs = subs.filter(
      (s) => s.created_at >= dayISO && s.created_at <= dayEnd.toISOString()
    ).length;

    const renewals = subs.filter(
      (s) => s.start_date && s.start_date >= dayISO && s.start_date <= dayEnd.toISOString() && s.created_at < dayISO
    ).length;

    const expirations = subs.filter(
      (s) => s.end_date && s.end_date >= dayISO && s.end_date <= dayEnd.toISOString()
    ).length;

    const cancellations = subs.filter(
      (s) => s.cancelled_at && s.cancelled_at >= dayISO && s.cancelled_at <= dayEnd.toISOString()
    ).length;

    subsChart.push({
      date: dayStr,
      new_subscriptions: newSubs,
      renewals,
      expirations,
      cancellations,
    });
  }

  // Chart: Revenue evolution
  const revenueChart = [];
  for (let i = 0; i < periodDays; i++) {
    const dayStart = new Date(chartStart);
    dayStart.setDate(chartStart.getDate() + i);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const dayISO = dayStart.toISOString();
    const dayStr = dayStart.toISOString().split('T')[0];

    const revenue = payments.filter(
      (p) => p.status === 'successful' && p.paid_at && p.paid_at >= dayISO && p.paid_at <= dayEnd.toISOString()
    ).reduce((acc, p) => acc + Number(p.amount), 0);

    revenueChart.push({
      date: dayStr,
      revenue,
    });
  }

  // Chart: Plan distribution
  const planCounts: Record<string, number> = {};
  subs.forEach((s) => {
    const plan = plans.find((p) => p.id === s.plan_id);
    const planName = plan?.name || 'Inconnu';
    planCounts[planName] = (planCounts[planName] || 0) + 1;
  });

  const planColors = ['#F59E0B', '#3B82F6', '#10B981', '#8B5CF6', '#EF4444', '#6366F1', '#14B8A8'];
  const planDistribution = Object.entries(planCounts).map(([name, value], idx) => ({
    name,
    value,
    fill: planColors[idx % planColors.length],
  }));

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

  return NextResponse.json({
    kpis,
    charts: {
      registrations: registrationsChart,
      subscriptions: subsChart,
      revenue: revenueChart,
      planDistribution,
    },
  });
}
