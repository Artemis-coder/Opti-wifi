/**
 * API de la Mini App Telegram (back-office du super admin dans Telegram).
 * Authentification : signature Telegram (en-tête X-Telegram-Init-Data), voir lib/telegram-webapp.ts.
 * Données et actions : les mêmes fonctions que le back-office et l'assistant.
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/neon/db';
import { authorizeMiniApp } from '@/lib/telegram-webapp';
import { listExpiringLicences, listLicenseRequests, listOrganizations } from '@/lib/bot/admin-data';
import { getDashboardKpis } from '@/lib/platform-dashboard';
import { getPlatformStats, parseStatsRange } from '@/lib/platform-stats';
import { activateLicense, rejectLicenseRequest, UUID_RE } from '@/lib/platform-actions';
import { getBotPlatformUserId } from '@/lib/bot/assistant';

export const dynamic = 'force-dynamic';

async function authorize(request: Request) {
  return { response: await authorizeMiniApp(request) };
}

export async function GET(request: Request) {
  const { response } = await authorize(request);
  if (response) return response;

  const url = new URL(request.url);
  const view = url.searchParams.get('view') || 'overview';
  try {
    switch (view) {
      case 'overview': {
        // Mêmes chiffres que le tableau de bord super admin (lib/platform-dashboard)
        const { kpis, todo } = await getDashboardKpis();
        return NextResponse.json({ kpis, todo });
      }
      case 'stats':
        // Mêmes statistiques et graphiques que le tableau de bord (inscriptions, licences, revenus)
        return NextResponse.json(await getPlatformStats(parseStatsRange(url.searchParams.get('range'))));
      case 'activity': {
        // Activité des clients : collectes de leurs points de vente (30 derniers jours)
        const [daily, top] = await Promise.all([
          query(
            `SELECT to_char(d, 'YYYY-MM-DD') AS day,
                    COALESCE(SUM(c.montant_collecte), 0)::float AS amount, COUNT(c.id)::int AS count
               FROM generate_series(date_trunc('day', NOW()) - interval '29 days', date_trunc('day', NOW()), interval '1 day') d
               LEFT JOIN collections c ON date_trunc('day', COALESCE(c.date_collecte, c.created_at)) = d
              GROUP BY d ORDER BY d`
          ),
          query(
            `SELECT o.name, COALESCE(SUM(c.montant_collecte), 0)::float AS amount
               FROM collections c JOIN organizations o ON o.id = COALESCE(c.organization_id, c.organisation_id)
              WHERE COALESCE(c.date_collecte, c.created_at) > NOW() - interval '30 days'
              GROUP BY o.name ORDER BY amount DESC LIMIT 5`
          ),
        ]);
        return NextResponse.json({ daily: daily.rows, top: top.rows });
      }
      case 'requests':
        return NextResponse.json(await listLicenseRequests({ status: url.searchParams.get('status') || 'pending' }));
      case 'clients':
        return NextResponse.json(
          await listOrganizations({ search: (url.searchParams.get('q') || '').slice(0, 80), limit: 50 })
        );
      case 'expiring':
        return NextResponse.json(await listExpiringLicences({ days: 30 }));
      default:
        return NextResponse.json({ error: 'Vue inconnue.' }, { status: 400 });
    }
  } catch (err) {
    console.error('Mini App read error:', err);
    return NextResponse.json({ error: 'Lecture des données impossible.' }, { status: 500 });
  }
}

/** Approuver ou refuser une demande de licence (confirmé dans l'interface). */
export async function POST(request: Request) {
  const { response } = await authorize(request);
  if (response) return response;

  const body = (await request.json().catch(() => null)) as { action?: string; requestId?: string; note?: string } | null;
  const action = body?.action;
  const requestId = String(body?.requestId || '');
  const note = typeof body?.note === 'string' ? body.note.slice(0, 500) : null;
  if (!['approve', 'reject'].includes(action || '') || !UUID_RE.test(requestId)) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  const platformUserId = await getBotPlatformUserId();
  if (!platformUserId) return NextResponse.json({ error: 'Aucun compte super admin actif.' }, { status: 409 });

  try {
    if (action === 'reject') {
      const result = await rejectLicenseRequest({ requestId, note, platformUserId });
      return result.ok
        ? NextResponse.json({ message: result.message })
        : NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { rows } = await query(
      `SELECT organization_id, plan_id, duration_months, status FROM license_requests WHERE id = $1`,
      [requestId]
    );
    const r = rows[0];
    if (!r) return NextResponse.json({ error: 'Demande introuvable.' }, { status: 404 });
    if (r.status !== 'pending') return NextResponse.json({ error: 'Cette demande a déjà été traitée.' }, { status: 409 });
    if (!r.plan_id) return NextResponse.json({ error: 'La demande ne précise pas de forfait : traitez-la dans le back-office.' }, { status: 422 });

    const result = await activateLicense({
      organizationId: r.organization_id,
      planId: r.plan_id,
      durationMonths: Number(r.duration_months) || 1,
      requestId,
      platformUserId,
      note: note || 'Via la Mini App Telegram',
    });
    return result.ok
      ? NextResponse.json({ message: result.message })
      : NextResponse.json({ error: result.error }, { status: result.status });
  } catch (err) {
    console.error('Mini App action error:', err);
    return NextResponse.json({ error: "Erreur technique pendant l'exécution." }, { status: 500 });
  }
}
