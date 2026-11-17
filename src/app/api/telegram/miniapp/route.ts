/**
 * API de la Mini App Telegram (back-office du super admin dans Telegram).
 * Authentification : signature Telegram (en-tête X-Telegram-Init-Data), voir lib/telegram-webapp.ts.
 * Données et actions : les mêmes fonctions que le back-office et l'assistant.
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/neon/db';
import { verifyMiniAppRequest } from '@/lib/telegram-webapp';
import { clientIp, rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { reportSecurityEvent } from '@/lib/security-events';
import { getPlatformOverview, listExpiringLicences, listLicenseRequests, listOrganizations } from '@/lib/bot/admin-data';
import { activateLicense, rejectLicenseRequest, UUID_RE } from '@/lib/platform-actions';
import { getBotPlatformUserId } from '@/lib/bot/assistant';

export const dynamic = 'force-dynamic';

async function authorize(request: Request) {
  const wait = rateLimit(`miniapp:${clientIp(request)}`, 120, 60_000);
  if (wait) return { response: tooManyRequests(wait) };
  const auth = await verifyMiniAppRequest(request);
  if (!auth.ok) {
    if (auth.status === 403) {
      reportSecurityEvent({ type: 'bot_stranger', request, detail: 'Ouverture de la Mini App Telegram par un autre compte' });
    }
    return { response: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  }
  return { response: null };
}

export async function GET(request: Request) {
  const { response } = await authorize(request);
  if (response) return response;

  const url = new URL(request.url);
  const view = url.searchParams.get('view') || 'overview';
  try {
    switch (view) {
      case 'overview': {
        const [overview, requests, expiring] = await Promise.all([
          getPlatformOverview(),
          listLicenseRequests({ status: 'pending' }),
          listExpiringLicences({ days: 30 }),
        ]);
        return NextResponse.json({ overview, pendingRequests: requests.total, expiring: expiring.expirent_bientot.length });
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
