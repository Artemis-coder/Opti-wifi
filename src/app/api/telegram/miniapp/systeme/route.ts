/**
 * API de la Mini App « Système » : santé de l'application (mêmes contrôles que État du système)
 * et sécurité (intrusions bloquées, incidents de l'agent de sécurité).
 */
import { NextResponse } from 'next/server';
import { query } from '@/lib/neon/db';
import { authorizeMiniApp } from '@/lib/telegram-webapp';
import { checkAndRecord, healthHistory, lastStoredHealth } from '@/lib/system-health';
import { INCIDENT_STATUS_LABEL, SECURITY_EVENTS, SEVERITY_LABEL, listIncidents, securitySummary, updateIncident } from '@/lib/security-events';

export const dynamic = 'force-dynamic';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.optiwifi.site').replace(/\/$/, '');

export async function GET(request: Request) {
  const denied = await authorizeMiniApp(request);
  if (denied) return denied;
  const view = new URL(request.url).searchParams.get('view') || 'health';
  try {
    if (view === 'health') {
      const [last, history] = await Promise.all([lastStoredHealth(), healthHistory(24 * 7)]);
      // Disponibilité par jour : part des contrôles « ok » (7 jours)
      const byDay = new Map<string, { ok: number; warning: number; error: number }>();
      for (let i = 6; i >= 0; i--) byDay.set(new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10), { ok: 0, warning: 0, error: 0 });
      for (const h of history) {
        const day = new Date(h.checked_at).toISOString().slice(0, 10);
        const d = byDay.get(day) ?? { ok: 0, warning: 0, error: 0 };
        d[h.overall] += 1;
        byDay.set(day, d);
      }
      return NextResponse.json({ last, daily: [...byDay.entries()].map(([day, d]) => ({ day, ...d })) });
    }
    if (view === 'security') {
      const [day, week, daily, incidents, handled] = await Promise.all([
        securitySummary(24),
        securitySummary(24 * 7),
        query(
          `SELECT to_char(d, 'YYYY-MM-DD') AS day,
                  COUNT(e.id) FILTER (WHERE e.severity = 1)::int AS low,
                  COUNT(e.id) FILTER (WHERE e.severity = 2)::int AS medium,
                  COUNT(e.id) FILTER (WHERE e.severity = 3)::int AS high
             FROM generate_series(date_trunc('day', NOW()) - interval '13 days', date_trunc('day', NOW()), interval '1 day') d
             LEFT JOIN security_events e ON date_trunc('day', e.occurred_at) = d
            GROUP BY d ORDER BY d`
        ),
        listIncidents({ limit: 20 }),
        listIncidents({ status: ['resolved', 'ignored'], limit: 10 }),
      ]);
      const label = (i: Awaited<ReturnType<typeof listIncidents>>[number]) => ({
        id: i.id,
        title: i.title,
        severity: i.severity,
        severity_label: SEVERITY_LABEL[i.severity],
        status: i.status,
        status_label: INCIDENT_STATUS_LABEL[i.status],
        source: `${i.ip || 'source inconnue'}${i.country ? ` (${i.country})` : ''}`,
        account: i.user_email || i.identifier,
        attempts: i.event_count,
        last_seen: i.last_seen,
        // Les routes et détails viennent des attaquants : affichés comme texte, jamais interprétés
        route: i.last_route,
        analysis: i.analysis?.slice(0, 1500) ?? null,
        resolution: i.resolution?.slice(0, 600) ?? null,
        handled_by: i.handled_by,
      });
      return NextResponse.json({
        day: { events: day.events, sources: day.sources, open_incidents: day.open_incidents, open_high: day.open_high },
        week: { events: week.events, sources: week.sources },
        byType: week.byType.slice(0, 6).map((t) => ({ type: SECURITY_EVENTS[t.type]?.title ?? t.type, n: t.n })),
        daily: daily.rows,
        incidents: incidents.map(label),
        handled: handled.map(label),
      });
    }
    return NextResponse.json({ error: 'Vue inconnue.' }, { status: 400 });
  } catch (err) {
    console.error('Mini App système read error:', err);
    return NextResponse.json({ error: 'Lecture de l’état du système impossible.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await authorizeMiniApp(request);
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as { action?: string; id?: string; decision?: string } | null;
  try {
    if (body?.action === 'check') {
      // Contrôle complet en direct (enregistré au plus toutes les 5 minutes, alertes au changement d'état)
      const health = await checkAndRecord(SITE, 'manual');
      return NextResponse.json({ health });
    }
    if (body?.action === 'incident' && (body.decision === 'resolve' || body.decision === 'ignore')) {
      const incident = await updateIncident(String(body.id || ''), {
        status: body.decision === 'resolve' ? 'resolved' : 'ignored',
        handled_by: 'Super admin (Mini App Telegram)',
      });
      if (!incident) return NextResponse.json({ error: 'Incident introuvable.' }, { status: 404 });
      return NextResponse.json({ message: `Incident : ${INCIDENT_STATUS_LABEL[incident.status]}.` });
    }
    return NextResponse.json({ error: 'Action invalide.' }, { status: 400 });
  } catch (err) {
    console.error('Mini App système action error:', err);
    return NextResponse.json({ error: "Erreur technique pendant l'action." }, { status: 500 });
  }
}
