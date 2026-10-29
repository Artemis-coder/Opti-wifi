import { query } from '@/lib/neon/db';

/**
 * KPI des pages Factures et Transactions du back-office (toutes périodes confondues,
 * plus le mois en cours). Type de licence facturée déduit de la facture précédente
 * du même client : aucune → nouvelle, même forfait → renouvellement, sinon changement.
 */
export interface InvoiceStats {
  total: number;
  paid: number;
  paid_amount: number;
  month_count: number;
  month_amount: number;
  new_count: number;
  renewals: number;
  upgrades: number;
  clients: number;
  unpaid: number;
  unpaid_amount: number;
  average: number;
}

export async function getInvoiceStats(): Promise<InvoiceStats> {
  const { rows } = await query(
    `WITH inv AS (
       SELECT i.status, i.amount, i.issued_at, i.organization_id, i.plan_id,
              LAG(i.plan_id) OVER (PARTITION BY i.organization_id ORDER BY i.issued_at, i.created_at) AS prev_plan,
              ROW_NUMBER() OVER (PARTITION BY i.organization_id ORDER BY i.issued_at, i.created_at) AS rank_in_org
         FROM invoices i
        WHERE i.status <> 'draft'
     )
     SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status = 'paid')::int AS paid,
            COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0)::float AS paid_amount,
            COUNT(*) FILTER (WHERE issued_at >= date_trunc('month', NOW()))::int AS month_count,
            COALESCE(SUM(amount) FILTER (WHERE status = 'paid' AND issued_at >= date_trunc('month', NOW())), 0)::float AS month_amount,
            COUNT(*) FILTER (WHERE rank_in_org = 1)::int AS new_count,
            COUNT(*) FILTER (WHERE rank_in_org > 1 AND prev_plan = plan_id)::int AS renewals,
            COUNT(*) FILTER (WHERE rank_in_org > 1 AND prev_plan IS DISTINCT FROM plan_id)::int AS upgrades,
            COUNT(DISTINCT organization_id)::int AS clients,
            COUNT(*) FILTER (WHERE status IN ('issued', 'overdue'))::int AS unpaid,
            COALESCE(SUM(amount) FILTER (WHERE status IN ('issued', 'overdue')), 0)::float AS unpaid_amount
       FROM inv`
  );
  const r = rows[0] || {};
  const paid = Number(r.paid || 0);
  const paidAmount = Number(r.paid_amount || 0);
  return {
    total: Number(r.total || 0),
    paid,
    paid_amount: paidAmount,
    month_count: Number(r.month_count || 0),
    month_amount: Number(r.month_amount || 0),
    new_count: Number(r.new_count || 0),
    renewals: Number(r.renewals || 0),
    upgrades: Number(r.upgrades || 0),
    clients: Number(r.clients || 0),
    unpaid: Number(r.unpaid || 0),
    unpaid_amount: Number(r.unpaid_amount || 0),
    average: paid ? Math.round(paidAmount / paid) : 0,
  };
}

export interface PaymentStats {
  successful: number;
  successful_amount: number;
  month_count: number;
  month_amount: number;
  pending: number;
  failed: number;
  average: number;
  by_method: { method: string; count: number; amount: number }[];
}

export async function getPaymentStats(): Promise<PaymentStats> {
  const [totals, methods] = await Promise.all([
    query(
      `SELECT COUNT(*) FILTER (WHERE status = 'successful')::int AS successful,
              COALESCE(SUM(amount) FILTER (WHERE status = 'successful'), 0)::float AS successful_amount,
              COUNT(*) FILTER (WHERE status = 'successful' AND paid_at >= date_trunc('month', NOW()))::int AS month_count,
              COALESCE(SUM(amount) FILTER (WHERE status = 'successful' AND paid_at >= date_trunc('month', NOW())), 0)::float AS month_amount,
              COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
              COUNT(*) FILTER (WHERE status IN ('failed', 'cancelled', 'refunded'))::int AS failed
         FROM payments`
    ),
    query(
      `SELECT COALESCE(NULLIF(payment_method, ''), 'Non précisé') AS method, COUNT(*)::int AS count,
              COALESCE(SUM(amount), 0)::float AS amount
         FROM payments WHERE status = 'successful'
        GROUP BY 1 ORDER BY amount DESC`
    ),
  ]);
  const r = totals.rows[0] || {};
  const successful = Number(r.successful || 0);
  const amount = Number(r.successful_amount || 0);
  return {
    successful,
    successful_amount: amount,
    month_count: Number(r.month_count || 0),
    month_amount: Number(r.month_amount || 0),
    pending: Number(r.pending || 0),
    failed: Number(r.failed || 0),
    average: successful ? Math.round(amount / successful) : 0,
    by_method: methods.rows.map((m) => ({ method: m.method as string, count: Number(m.count), amount: Number(m.amount) })),
  };
}
