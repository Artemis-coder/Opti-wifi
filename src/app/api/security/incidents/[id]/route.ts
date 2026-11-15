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

const REPO_URL = 'https://github.com/Artemis-coder/Opti-wifi';
const COMPARE_URL = `${REPO_URL}/compare/main...develop?expand=1`;
const PR_URL_RE = /^https:\/\/github\.com\/Artemis-coder\/Opti-wifi\/pull\/\d+$/;
const PREVIEW_URL = 'https://dev.optiwifi.site';

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
    fix_commit?: string;
    pr_url?: string;
  };
  // Liens du correctif : uniquement vers le dépôt du projet (les données d'incident viennent d'attaquants)
  const commit = typeof body.fix_commit === 'string' && /^[0-9a-f]{7,40}$/i.test(body.fix_commit) ? body.fix_commit : null;
  const prUrl = typeof body.pr_url === 'string' && PR_URL_RE.test(body.pr_url) ? body.pr_url : null;
  const fixLinks = commit
    ? `\n\nCorrectif : ${REPO_URL}/commit/${commit}\nValidation avant production : ${prUrl || COMPARE_URL}`
    : '';
  const handledBy = actor.kind === 'agent' ? 'Agent de sécurité' : actor.email;
  const incident = await updateIncident(id, {
    status: body.status,
    analysis: typeof body.analysis === 'string' ? body.analysis : undefined,
    resolution: typeof body.resolution === 'string' ? body.resolution + fixLinks : fixLinks || undefined,
    handled_by: handledBy,
  });
  if (!incident) return NextResponse.json({ error: 'Incident introuvable ou statut invalide' }, { status: 404 });

  if (actor.kind === 'agent' && (body.analysis || body.resolution) && telegramNotificationsEnabled()) {
    const e = escapeTelegramHtml;
    const text = [
      commit ? `🛠️ <b>Correctif de sécurité prêt — votre validation est requise</b>` : `🤖 <b>Analyse de l’agent de sécurité</b>`,
      `Tâche <code>${incident.id.slice(0, 8)}</code> · ${e(incident.title)}`,
      `Statut : <b>${INCIDENT_STATUS_LABEL[incident.status]}</b>`,
      '',
      e((body.analysis || '').slice(0, 2800)),
      body.resolution ? `\n<b>Action :</b> ${e(body.resolution.slice(0, 800))}` : '',
      commit
        ? `\n⚠️ Rien n'est en production. Testez sur la préproduction, puis fusionnez la PR vers <code>main</code> pour déployer.`
        : '',
    ].join('\n');
    const reply_markup = commit
      ? {
          inline_keyboard: [
            [{ text: '🔍 Voir le correctif', url: `${REPO_URL}/commit/${commit}` }],
            [{ text: '🧪 Tester en préproduction', url: PREVIEW_URL }],
            [{ text: '✅ Valider pour la production', url: prUrl || COMPARE_URL }],
          ],
        }
      : undefined;
    await sendTelegramMessageDetailed({ text, parse_mode: 'HTML', reply_markup });
  }
  return NextResponse.json({ incident });
}
