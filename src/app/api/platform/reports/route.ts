import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Helper: create authenticated supabase client
async function makeSupabase() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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

// Helper: auth guard
async function guardSuperAdmin(supabase: ReturnType<typeof createServerClient>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié', status: 401 };

  const { data: pu } = await supabase
    .from('platform_users')
    .select('role, is_active')
    .eq('auth_user_id', user.id)
    .single();

  if (!pu || !pu.is_active) return { error: 'Accès refusé', status: 403 };
  return { user, pu };
}

// GET /api/platform/reports?type=kpi|csv_clients|csv_payments|csv_subscriptions
export async function GET(request: Request) {
  const supabase = await makeSupabase();
  const guard = await guardSuperAdmin(supabase);
  if ('error' in guard && guard.status) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'kpi';

  // ── KPI Report (MRR, ARR, Churn, etc.) ──────────────────────────────────────
  if (type === 'kpi') {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

    const [subsRes, paymentsRes, plansRes] = await Promise.all([
      supabase.from('subscriptions').select('id, plan_id, status, start_date, end_date, cancelled_at, created_at'),
      supabase.from('payments').select('id, amount, currency, status, paid_at, created_at'),
      supabase.from('subscription_plans').select('id, name, price, billing_period'),
    ]);

    const subs = subsRes.data || [];
    const payments = paymentsRes.data || [];
    const plans = plansRes.data || [];

    // MRR: sum of monthly-equivalent prices for active subscriptions
    const activeSubs = subs.filter((s) => s.status === 'active' || s.status === 'trialing');
    const mrr = activeSubs.reduce((acc, s) => {
      const plan = plans.find((p) => p.id === s.plan_id);
      if (!plan) return acc;
      let monthly = Number(plan.price);
      if (plan.billing_period === 'annual') monthly = monthly / 12;
      if (plan.billing_period === 'semiannual') monthly = monthly / 6;
      if (plan.billing_period === 'quarterly') monthly = monthly / 3;
      return acc + monthly;
    }, 0);

    const arr = mrr * 12;

    // Churn: subscriptions cancelled this month / subs active at start of month
    const cancelledThisMonth = subs.filter(
      (s) => s.cancelled_at && s.cancelled_at >= monthStart
    ).length;
    const activeAtMonthStart = subs.filter(
      (s) => s.created_at < monthStart && (s.status === 'active' || s.status === 'trialing')
    ).length;
    const churnRate = activeAtMonthStart > 0 ? (cancelledThisMonth / activeAtMonthStart) * 100 : 0;

    // Revenue this month vs prev month
    const revenueThisMonth = payments
      .filter((p) => p.status === 'successful' && p.paid_at && p.paid_at >= monthStart)
      .reduce((acc, p) => acc + Number(p.amount), 0);

    const revenuePrevMonth = payments
      .filter(
        (p) =>
          p.status === 'successful' &&
          p.paid_at &&
          p.paid_at >= prevMonthStart &&
          p.paid_at <= prevMonthEnd
      )
      .reduce((acc, p) => acc + Number(p.amount), 0);

    const revenueGrowth =
      revenuePrevMonth > 0 ? ((revenueThisMonth - revenuePrevMonth) / revenuePrevMonth) * 100 : 0;

    // New subs this month
    const newSubsThisMonth = subs.filter((s) => s.created_at >= monthStart).length;

    // ARPU: Average Revenue Per User (active subs)
    const arpu = activeSubs.length > 0 ? mrr / activeSubs.length : 0;

    const currency = payments.find((p) => p.currency)?.currency || 'XOF';

    return NextResponse.json({
      data: {
        mrr,
        arr,
        churn_rate: Number(churnRate.toFixed(2)),
        revenue_this_month: revenueThisMonth,
        revenue_prev_month: revenuePrevMonth,
        revenue_growth: Number(revenueGrowth.toFixed(2)),
        new_subscriptions_this_month: newSubsThisMonth,
        active_subscriptions: activeSubs.length,
        arpu: Number(arpu.toFixed(2)),
        currency,
      },
    });
  }

  // ── CSV Export: Clients ──────────────────────────────────────────────────────
  if (type === 'csv_clients') {
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name, contact_name, email, phone, status, currency, created_at')
      .order('created_at', { ascending: false });

    if (!orgs) return NextResponse.json({ error: 'Erreur de récupération' }, { status: 500 });

    const headers = ['ID', 'Nom', 'Contact', 'Email', 'Téléphone', 'Statut', 'Devise', 'Date création'];
    const rows = orgs.map((o) => [
      o.id,
      `"${(o.name || '').replace(/"/g, '""')}"`,
      `"${(o.contact_name || '').replace(/"/g, '""')}"`,
      o.email || '',
      o.phone || '',
      o.status,
      o.currency,
      new Date(o.created_at).toLocaleDateString('fr-FR'),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="clients-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  }

  // ── CSV Export: Payments ─────────────────────────────────────────────────────
  if (type === 'csv_payments') {
    const { data: payments } = await supabase
      .from('payments')
      .select('id, organization_id, amount, currency, payment_method, transaction_reference, status, paid_at, created_at')
      .order('created_at', { ascending: false });

    if (!payments) return NextResponse.json({ error: 'Erreur de récupération' }, { status: 500 });

    const headers = ['ID', 'Organisation', 'Montant', 'Devise', 'Méthode', 'Référence', 'Statut', 'Payé le', 'Créé le'];
    const rows = payments.map((p) => [
      p.id,
      p.organization_id || '',
      p.amount,
      p.currency,
      p.payment_method || '',
      p.transaction_reference || '',
      p.status,
      p.paid_at ? new Date(p.paid_at).toLocaleDateString('fr-FR') : '',
      new Date(p.created_at).toLocaleDateString('fr-FR'),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="paiements-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  }

  // ── CSV Export: Subscriptions ────────────────────────────────────────────────
  if (type === 'csv_subscriptions') {
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('id, organization_id, plan_id, status, start_date, end_date, trial_end, auto_renew, cancelled_at, created_at')
      .order('created_at', { ascending: false });

    if (!subs) return NextResponse.json({ error: 'Erreur de récupération' }, { status: 500 });

    const headers = ['ID', 'Organisation', 'Plan', 'Statut', 'Début', 'Fin', 'Fin essai', 'Auto-renew', 'Annulé le', 'Créé le'];
    const rows = subs.map((s) => [
      s.id,
      s.organization_id || '',
      s.plan_id || '',
      s.status,
      s.start_date ? new Date(s.start_date).toLocaleDateString('fr-FR') : '',
      s.end_date ? new Date(s.end_date).toLocaleDateString('fr-FR') : '',
      s.trial_end ? new Date(s.trial_end).toLocaleDateString('fr-FR') : '',
      s.auto_renew ? 'Oui' : 'Non',
      s.cancelled_at ? new Date(s.cancelled_at).toLocaleDateString('fr-FR') : '',
      new Date(s.created_at).toLocaleDateString('fr-FR'),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="abonnements-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  }

  // ── CSV Export: Audit Logs ───────────────────────────────────────────────────
  if (type === 'csv_audit') {
    const { data: logs } = await supabase
      .from('platform_audit_logs')
      .select('id, platform_user_id, organization_id, action, entity_type, entity_id, ip_address, created_at')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (!logs) return NextResponse.json({ error: 'Erreur de récupération' }, { status: 500 });

    const headers = ['ID', 'Utilisateur', 'Organisation', 'Action', 'Type entité', 'Entité ID', 'IP', 'Date'];
    const rows = logs.map((l) => [
      l.id,
      l.platform_user_id || '',
      l.organization_id || '',
      l.action,
      l.entity_type || '',
      l.entity_id || '',
      l.ip_address || '',
      new Date(l.created_at).toLocaleString('fr-FR'),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  }

  return NextResponse.json({ error: 'Type de rapport non supporté' }, { status: 400 });
}
