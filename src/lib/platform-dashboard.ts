// ============================================================
// OPTIWIFI - Chiffres clés du tableau de bord super admin.
// Source unique pour le back-office (/api/platform/dashboard), la Mini App Telegram et le bot :
// les mêmes chiffres partout. Revenus = paiements de licences réussis (table payments),
// comme « Revenus encaissés » des statistiques (lib/platform-stats).
// ============================================================
import { query } from '@/lib/neon/db';

// Licences « alarmantes » : se terminent dans les 7 prochains jours sans renouvellement prévu
const ALARMING_EXPIRY = `s.status IN ('active', 'trialing') AND s.end_date BETWEEN NOW() AND NOW() + interval '7 days'
            AND o.status NOT IN ('suspended', 'cancelled', 'archived')
            AND NOT EXISTS (SELECT 1 FROM subscriptions s2 WHERE s2.organization_id = s.organization_id AND s2.id <> s.id
                              AND s2.status IN ('active', 'trialing') AND s2.end_date > s.end_date)`;

export interface DashboardTodo {
  pending_registrations: { id: string; name: string; contact_name: string | null; email: string | null; phone: string | null; created_at: string }[];
  pending_license_requests: {
    id: string;
    type: string;
    duration_months: number;
    created_at: string;
    organization_id: string;
    organization_name: string;
    plan_name: string | null;
  }[];
  upcoming_expirations: {
    id: string;
    end_date: string;
    organization_id: string;
    organization_name: string;
    plan_name: string | null;
    is_trial: boolean;
    days_left: number;
  }[];
}

export interface DashboardKpiValues {
  total_clients: number;
  active_clients: number;
  suspended_clients: number;
  new_clients_this_week: number;
  new_clients_this_month: number;
  active_subscriptions: number;
  expiring_subscriptions: number;
  expired_subscriptions: number;
  revenue_today: number;
  revenue_this_week: number;
  revenue_this_month: number;
  revenue_this_year: number;
  currency: string;
  pending_registrations: number;
  pending_license_requests: number;
  expiring_7d: number;
  clients_without_license: number;
}

/** KPI et éléments à traiter du tableau de bord super admin. */
export async function getDashboardKpis(): Promise<{ kpis: DashboardKpiValues; todo: DashboardTodo }> {
  const [counts, revenue, regRes, reqRes, expRes, todoCounts] = await Promise.all([
    query(
      `SELECT
         (SELECT COUNT(*) FROM organizations)::int AS total_clients,
         (SELECT COUNT(*) FROM organizations WHERE status = 'active')::int AS active_clients,
         (SELECT COUNT(*) FROM organizations WHERE status = 'suspended')::int AS suspended_clients,
         (SELECT COUNT(*) FROM organizations WHERE created_at >= NOW() - interval '7 days')::int AS new_clients_this_week,
         (SELECT COUNT(*) FROM organizations WHERE created_at >= NOW() - interval '30 days')::int AS new_clients_this_month,
         (SELECT COUNT(*) FROM subscriptions WHERE status IN ('active', 'trialing'))::int AS active_subscriptions,
         (SELECT COUNT(*) FROM subscriptions WHERE status IN ('active', 'trialing')
            AND end_date IS NOT NULL AND end_date BETWEEN NOW() AND NOW() + interval '30 days')::int AS expiring_subscriptions,
         (SELECT COUNT(*) FROM subscriptions WHERE status IN ('expired', 'cancelled'))::int AS expired_subscriptions`
    ),
    query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE paid_at >= date_trunc('day', NOW())), 0)::float AS revenue_today,
         COALESCE(SUM(amount) FILTER (WHERE paid_at >= NOW() - interval '7 days'), 0)::float AS revenue_this_week,
         COALESCE(SUM(amount) FILTER (WHERE paid_at >= date_trunc('month', NOW())), 0)::float AS revenue_this_month,
         COALESCE(SUM(amount) FILTER (WHERE paid_at >= date_trunc('year', NOW())), 0)::float AS revenue_this_year,
         (SELECT currency FROM payments WHERE currency IS NOT NULL LIMIT 1) AS currency
       FROM payments WHERE status = 'successful' AND paid_at IS NOT NULL`
    ),
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
              s.trial_end IS NOT NULL AS is_trial,
              CEIL(EXTRACT(EPOCH FROM (s.end_date - NOW())) / 86400)::int AS days_left
         FROM subscriptions s
         JOIN organizations o ON o.id = s.organization_id
         LEFT JOIN subscription_plans p ON p.id = s.plan_id
        WHERE ${ALARMING_EXPIRY}
        ORDER BY s.end_date ASC LIMIT 5`
    ),
    query(
      `SELECT
         (SELECT COUNT(*) FROM organizations WHERE status = 'pending_approval')::int AS pending_registrations,
         (SELECT COUNT(*) FROM license_requests WHERE status = 'pending')::int AS pending_license_requests,
         (SELECT COUNT(*) FROM subscriptions s JOIN organizations o ON o.id = s.organization_id
           WHERE ${ALARMING_EXPIRY})::int AS expiring_7d,
         (SELECT COUNT(*) FROM organizations o
           WHERE o.status IN ('active', 'trial', 'expiring')
             AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.organization_id = o.id
                               AND s.status IN ('active', 'trialing') AND s.end_date > NOW()))::int AS clients_without_license`
    ),
  ]);

  const r = revenue.rows[0] || {};
  return {
    kpis: {
      ...(counts.rows[0] as Omit<DashboardKpiValues, 'currency'>),
      revenue_today: Number(r.revenue_today) || 0,
      revenue_this_week: Number(r.revenue_this_week) || 0,
      revenue_this_month: Number(r.revenue_this_month) || 0,
      revenue_this_year: Number(r.revenue_this_year) || 0,
      currency: r.currency || 'XOF',
      ...(todoCounts.rows[0] as Pick<DashboardKpiValues, 'pending_registrations' | 'pending_license_requests' | 'expiring_7d' | 'clients_without_license'>),
    },
    todo: {
      pending_registrations: regRes.rows as DashboardTodo['pending_registrations'],
      pending_license_requests: reqRes.rows as DashboardTodo['pending_license_requests'],
      upcoming_expirations: expRes.rows as DashboardTodo['upcoming_expirations'],
    },
  };
}
