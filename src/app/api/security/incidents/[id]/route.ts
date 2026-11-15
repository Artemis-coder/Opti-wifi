import { NextResponse } from 'next/server';
import { authorizeSecurityAccess } from '@/lib/security-agent-auth';
import { escapeTelegramHtml, sendTelegramMessageDetailed } from '@/lib/telegram';
import { telegramNotificationsEnabled } from '@/lib/notifications';
import {
  getIncident,
  incidentEvents,
  INCIDENT_STATUS_LABEL,
  updateIncident,
  type SecurityIncident,
} from '@/lib/security-events';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const actor = await authorizeSecurityAccess(request);
  if (!actor) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  const { id } = await params;
  const incident = await getIncident(id);
  if (!incident) return NextResponse.json({ error: 'Incident introuvable' }, { status: 404 });
  return NextResponse.json({ incident, events: await incidentEvents(id, 100) });
}

// Mise à jour d'une tâche de sécurité (statut, analyse, résolution). Quand l'agent livre son
// analyse, elle est envoyée sur Telegram.
export async function PATCH(request: Request, { params }: Params) {
  const actor = await authorizeSecurityAccess(request);
  if (!actor) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    status?: SecurityIncident['status'];
    analysis?: string;
    resolution?: string;
  };
  const handledBy = actor.kind === 'agent' ? 'Agent de sécurité' : actor.email;
  const incident = await updateIncident(id, {
    status: body.status,
    analysis: typeof body.analysis === 'string' ? body.analysis : undefined,
    resolution: typeof body.resolution === 'string' ? body.resolution : undefined,
    handled_by: handledBy,
  });
  if (!incident) return NextResponse.json({ error: 'Incident introuvable ou statut invalide' }, { status: 404 });

  if (actor.kind === 'agent' && (body.analysis || body.resolution) && telegramNotificationsEnabled()) {
    const e = escapeTelegramHtml;
    const text = [
      `🤖 <b>Analyse de l’agent de sécurité</b>`,
      `Tâche <code>${incident.id.slice(0, 8)}</code> · ${e(incident.title)}`,
      `Statut : <b>${INCIDENT_STATUS_LABEL[incident.status]}</b>`,
      '',
      e((body.analysis || '').slice(0, 2500)),
      body.resolution ? `\n<b>Action :</b> ${e(body.resolution.slice(0, 800))}` : '',
    ].join('\n');
    await sendTelegramMessageDetailed({ text, parse_mode: 'HTML' });
  }
  return NextResponse.json({ incident });
}
