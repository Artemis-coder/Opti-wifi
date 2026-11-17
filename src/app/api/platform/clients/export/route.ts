import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/neon/server';
import { query } from '@/lib/neon/db';
import { toCsv, toXlsx, type TableFormat } from '@/lib/export/table-file';
import {
  CLIENT_STATUSES,
  CLIENT_STATUS_LABELS,
  CLIENT_STATUS_SQL,
  LATEST_SUBSCRIPTION_JOIN,
  OFFER_END_SQL,
  OFFER_STATUSES,
  OFFER_STATUS_LABELS,
  OFFER_STATUS_SQL,
  type ClientStatus,
  type OfferStatus,
} from '@/lib/platform-client-status';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Numéro utilisable par une plateforme SMS : sans espaces, points, tirets ni parenthèses. */
const cleanPhone = (p: string | null) => (p || '').replace(/[\s.\-()]/g, '');

const frDate = (d: string | Date | null) => {
  if (!d) return '';
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('fr-FR', { timeZone: 'Africa/Abidjan' });
};

const list = (v: string | null) =>
  (v || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Export des clients (super admin uniquement), pour une plateforme d'envoi de SMS ou un tableur.
 * Paramètres : format=csv|xlsx, content=contacts|full,
 * clients=<statuts du client> (vide : tous sauf supprimés), offers=<statuts de l'offre> (vide : tous),
 * plans=<id>,none (vide : toutes les offres), withPhone=1, withEmail=1, search=…, preview=1 (nombre seul).
 * Chaque export est tracé dans le journal d'audit de la plateforme.
 */
export async function GET(request: Request) {
  const auth = await requirePlatformAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const sp = new URL(request.url).searchParams;
  const format: TableFormat = sp.get('format') === 'xlsx' ? 'xlsx' : 'csv';
  const content = sp.get('content') === 'full' ? 'full' : 'contacts';
  const clientStatuses = list(sp.get('clients')).filter((v) => (CLIENT_STATUSES as string[]).includes(v));
  const offerStatuses = list(sp.get('offers')).filter((v) => (OFFER_STATUSES as string[]).includes(v));
  const planFilter = list(sp.get('plans'));
  const planIds = planFilter.filter((p) => UUID.test(p));
  const includeNoPlan = planFilter.includes('none');
  const anyPlan = planFilter.length === 0;
  const withPhone = sp.get('withPhone') === '1';
  const withEmail = sp.get('withEmail') === '1';
  const search = (sp.get('search') || '').trim().slice(0, 100);
  const pattern = search ? `%${search.replace(/[\\%_]/g, (m) => `\\${m}`)}%` : null;

  try {
    const { rows } = await query(
      `SELECT * FROM (
         SELECT o.name, o.contact_name, o.email, o.phone, o.country, o.currency, o.created_at,
                s.plan_id, p.name AS plan_name,
                ${CLIENT_STATUS_SQL} AS client_status,
                ${OFFER_STATUS_SQL} AS offer_status,
                ${OFFER_END_SQL} AS offer_end
           FROM organizations o
           ${LATEST_SUBSCRIPTION_JOIN}
           LEFT JOIN subscription_plans p ON p.id = s.plan_id
          WHERE (NOT $5::boolean OR NULLIF(btrim(o.phone), '') IS NOT NULL)
            AND (NOT $6::boolean OR NULLIF(btrim(o.email), '') IS NOT NULL)
            AND ($7::text IS NULL OR o.name ILIKE $7 OR o.contact_name ILIKE $7 OR o.email ILIKE $7 OR o.phone ILIKE $7)
       ) c
       WHERE (CASE WHEN cardinality($1::text[]) = 0 THEN c.client_status <> 'deleted' ELSE c.client_status = ANY($1::text[]) END)
         AND (cardinality($8::text[]) = 0 OR c.offer_status = ANY($8::text[]))
         AND ($2::boolean OR c.plan_id = ANY($3::uuid[]) OR ($4::boolean AND c.plan_id IS NULL))
       ORDER BY c.name ASC
       LIMIT 20000`,
      [clientStatuses, anyPlan, planIds, includeNoPlan, withPhone, withEmail, pattern, offerStatuses]
    );

    if (sp.get('preview') === '1') return NextResponse.json({ count: rows.length });

    const headers =
      content === 'full'
        ? ['Client', 'Responsable', 'Téléphone', 'Email', 'Statut', 'Offre', "Statut de l'offre", 'Expiration', 'Pays', 'Devise', 'Création']
        : ['Client', 'Responsable', 'Téléphone', 'Email'];

    const data = rows.map((r) => {
      const base = [r.name || '', r.contact_name || '', cleanPhone(r.phone), (r.email || '').trim()];
      if (content !== 'full') return base;
      return [
        ...base,
        CLIENT_STATUS_LABELS[r.client_status as ClientStatus] || '',
        r.plan_name || 'Aucune',
        OFFER_STATUS_LABELS[r.offer_status as OfferStatus] || '',
        frDate(r.offer_end),
        r.country || '',
        r.currency || '',
        frDate(r.created_at),
      ];
    });

    // Traçabilité : export de données personnelles
    await query(
      `INSERT INTO platform_audit_logs (platform_user_id, action, entity_type, new_data)
       VALUES ($1, 'clients.export', 'organization', $2)`,
      [
        auth.platformUser.id,
        JSON.stringify({ format, content, clients: clientStatuses, offers: offerStatuses, plans: planFilter, withPhone, withEmail, search: search || null, count: data.length }),
      ]
    ).catch((e) => console.error('Audit export clients:', e));

    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `clients-optispace-${content === 'full' ? 'complet' : 'contacts'}-${stamp}.${format}`;
    const headersOut = {
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    };

    if (format === 'xlsx') {
      const file = toXlsx(headers, data, 'Clients');
      return new NextResponse(Buffer.from(file), {
        headers: { ...headersOut, 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      });
    }
    return new NextResponse(toCsv(headers, data), {
      headers: { ...headersOut, 'Content-Type': 'text/csv; charset=utf-8' },
    });
  } catch (err) {
    console.error('Platform clients export error:', err);
    return NextResponse.json({ error: "Erreur lors de l'export des clients" }, { status: 500 });
  }
}
