import { query } from '@/lib/neon/db';

/**
 * Factures de licence.
 *
 * Émises à l'activation d'une licence payante (le support a vérifié le paiement) :
 * un paiement « réussi » + une facture « payée », dans la même requête.
 * Montant = prix mensuel du forfait × nombre de mois. Les forfaits d'essai ou gratuits
 * ne donnent pas lieu à facture. Une seule facture par licence (index unique).
 */
export interface IssuedInvoice {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
}

export async function issueLicenseInvoice(input: {
  subscriptionId: string;
  durationMonths: number;
  requestId?: string | null;
}): Promise<IssuedInvoice | null> {
  const { rows } = await query(
    `WITH lic AS (
       SELECT s.id AS subscription_id, s.organization_id, s.plan_id, s.start_date, s.end_date,
              p.name AS plan_name, p.currency,
              ROUND(p.price / CASE p.billing_period WHEN 'quarterly' THEN 3 WHEN 'semiannual' THEN 6
                                                     WHEN 'annual' THEN 12 ELSE 1 END, 2) AS unit_price,
              -- Facturable : forfait payant, hors essai gratuit (abonnement « trialing »)
              (p.price > 0 AND s.status <> 'trialing') AS billable
         FROM subscriptions s
         JOIN subscription_plans p ON p.id = s.plan_id
        WHERE s.id = $1::uuid
          AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.subscription_id = s.id)
     ),
     req AS (
       SELECT r.id, r.payment_reference, pm.name AS method_name
         FROM license_requests r
         LEFT JOIN payment_methods pm ON pm.id = r.payment_method_id
        WHERE r.id = $3::uuid
     ),
     org AS (
       SELECT o.id, jsonb_build_object('name', o.name, 'contact_name', o.contact_name, 'email', o.email,
                                       'phone', o.phone, 'address', o.address) AS billed_to
         FROM organizations o
        WHERE o.id = (SELECT organization_id FROM lic)
     ),
     pay AS (
       INSERT INTO payments (organization_id, subscription_id, plan_id, amount, currency, payment_method,
                             transaction_reference, status, paid_at)
       SELECT lic.organization_id, lic.subscription_id, lic.plan_id, ROUND(lic.unit_price * $2::int), lic.currency,
              (SELECT method_name FROM req), (SELECT payment_reference FROM req), 'successful', NOW()
         FROM lic WHERE lic.billable
       RETURNING id, amount, currency, payment_method, transaction_reference
     )
     INSERT INTO invoices (organization_id, subscription_id, payment_id, plan_id, license_request_id, invoice_number,
                           amount, currency, status, issued_at, paid_at, plan_name, unit_price, quantity,
                           duration_months, period_start, period_end, payment_method, payment_reference, billed_to)
     SELECT lic.organization_id, lic.subscription_id, pay.id, lic.plan_id, (SELECT id FROM req),
            'OPT-' || to_char(NOW(), 'YYYY') || '-' || lpad(nextval('invoice_number_seq')::text, 5, '0'),
            pay.amount, pay.currency, 'paid', NOW(), NOW(), lic.plan_name, lic.unit_price, $2::int,
            $2::int, lic.start_date, lic.end_date, pay.payment_method, pay.transaction_reference, org.billed_to
       FROM lic, pay, org
     RETURNING id, invoice_number, amount, currency`,
    [input.subscriptionId, input.durationMonths, input.requestId || null]
  );
  const r = rows[0];
  return r ? { id: r.id, invoice_number: r.invoice_number, amount: Number(r.amount), currency: r.currency } : null;
}

export interface InvoiceDetail {
  id: string;
  organization_id: string;
  invoice_number: string;
  status: string;
  amount: number;
  currency: string;
  issued_at: string | null;
  paid_at: string | null;
  plan_name: string | null;
  unit_price: number | null;
  quantity: number | null;
  duration_months: number | null;
  period_start: string | null;
  period_end: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  billed_to: { name?: string; contact_name?: string | null; email?: string | null; phone?: string | null; address?: string | null } | null;
}

const INVOICE_COLUMNS = `i.id, i.organization_id, i.invoice_number, i.status, i.amount, i.currency, i.issued_at, i.paid_at,
  COALESCE(i.plan_name, p.name) AS plan_name, i.unit_price, i.quantity, i.duration_months, i.period_start, i.period_end,
  i.payment_method, i.payment_reference, i.billed_to`;

function toDetail(r: Record<string, unknown>): InvoiceDetail {
  return {
    ...(r as unknown as InvoiceDetail),
    amount: Number(r.amount),
    unit_price: r.unit_price === null ? null : Number(r.unit_price),
    quantity: r.quantity === null ? null : Number(r.quantity),
    duration_months: r.duration_months === null ? null : Number(r.duration_months),
  };
}

export async function listOrganizationInvoices(organizationId: string): Promise<InvoiceDetail[]> {
  const { rows } = await query(
    `SELECT ${INVOICE_COLUMNS}
       FROM invoices i LEFT JOIN subscription_plans p ON p.id = i.plan_id
      WHERE i.organization_id = $1 AND i.status <> 'draft'
      ORDER BY i.issued_at DESC NULLS LAST, i.created_at DESC`,
    [organizationId]
  );
  return rows.map(toDetail);
}

export async function getInvoice(id: string): Promise<InvoiceDetail | null> {
  const { rows } = await query(
    `SELECT ${INVOICE_COLUMNS}
       FROM invoices i LEFT JOIN subscription_plans p ON p.id = i.plan_id
      WHERE i.id = $1`,
    [id]
  );
  return rows[0] ? toDetail(rows[0]) : null;
}

/** Émetteur affiché sur la facture (paramètres de la plateforme). */
export async function getInvoiceIssuer(): Promise<{ name: string; email: string | null; phone: string | null }> {
  const { rows } = await query(
    `SELECT key, value FROM platform_settings WHERE key IN ('platform_name', 'support_email', 'support_phone')`
  );
  const get = (k: string) => {
    const v = rows.find((r) => r.key === k)?.value;
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  };
  return { name: get('platform_name') || 'OptiWifi', email: get('support_email'), phone: get('support_phone') };
}
