// ============================================================
// OPTIWIFI - Menu Telegram « 🩺 Santé de l'application » : bilan de tous les composants
// (base, API, notifications, serveur, Vercel, tâches planifiées, sécurité) et suivi des
// incidents de sécurité (détails, résolu, fausse alerte).
// ============================================================
import { checkSecurity, runSystemHealth, type SystemHealth, type SystemStatus } from '@/lib/system-health';
import { escapeTelegramHtml, sendTelegramMessage } from '@/lib/telegram';
import {
  formatIncidentTelegram,
  getIncident,
  incidentEvents,
  incidentKeyboard,
  INCIDENT_STATUS_LABEL,
  listIncidents,
  securitySummary,
  SECURITY_EVENTS,
  updateIncident,
} from '@/lib/security-events';

export const HEALTH_BUTTON = '🩺 Santé de l\'application';
const BTN_FULL = '🩺 Bilan complet';
const BTN_SECURITY = '🛡️ Sécurité (24 h)';
const BTN_INCIDENTS = '📋 Incidents ouverts';

export const HEALTH_MENU = {
  reply_markup: {
    keyboard: [
      [{ text: BTN_FULL }, { text: BTN_SECURITY }],
      [{ text: BTN_INCIDENTS }],
      [{ text: '🔙 Menu Principal' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  },
};

// Menu « 🛡️ Sécurité » : récapitulatif et outils de suivi des intrusions
export const SECURITY_BUTTON = '🛡️ Sécurité';
const SEC_RECAP = '📊 Récap sécurité';
const SEC_WEEK = '📅 Bilan 7 jours';
const SEC_HANDLED = '🗂️ Incidents traités';
const SEC_SETTINGS = '🔐 Réglages sensibles';

export const SECURITY_MENU = {
  reply_markup: {
    keyboard: [
      [{ text: SEC_RECAP }, { text: BTN_INCIDENTS }],
      [{ text: SEC_WEEK }, { text: SEC_HANDLED }],
      [{ text: SEC_SETTINGS }, { text: HEALTH_BUTTON }],
      [{ text: '🔙 Menu Principal' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  },
};

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.optiwifi.site').replace(/\/$/, '');
const DOT: Record<SystemStatus, string> = { ok: '✅', warning: '⚠️', error: '❌' };
const e = escapeTelegramHtml;

async function send(chatId: string, text: string, markup: Record<string, unknown> = HEALTH_MENU.reply_markup) {
  await sendTelegramMessage({ chat_id: chatId, text, parse_mode: 'HTML', reply_markup: markup });
}

/** Bilan complet en un message : verdict, puis chaque composant et ses points à vérifier. */
export function formatHealth(health: SystemHealth): string {
  const problems = health.components.filter((c) => c.status !== 'ok');
  const lines = [
    '🩺 <b>Santé de l’application</b>',
    '',
    problems.length === 0
      ? '✅ <b>Tout fonctionne à merveille.</b> Tous les composants sont opérationnels.'
      : `${health.overall === 'error' ? '❌' : '⚠️'} <b>${problems.length} composant(s) à vérifier</b>`,
    '',
  ];
  for (const c of health.components) {
    lines.push(`${DOT[c.status]} <b>${e(c.label)}</b> — ${e(c.summary)}`);
    for (const check of c.checks.filter((k) => k.status !== 'ok').slice(0, 4)) {
      lines.push(`   ${DOT[check.status]} ${e(check.label)} : ${e(check.message)}`);
    }
  }
  const time = new Date(health.checked_at).toLocaleString('fr-FR', { timeZone: 'Africa/Abidjan', dateStyle: 'short', timeStyle: 'short' });
  lines.push('', `<i>Contrôle du ${time} · détail sur ${SITE}/platform/system</i>`);
  return lines.join('\n');
}

async function securityView(hours = 24): Promise<string> {
  const s = await securitySummary(hours);
  const period = hours === 24 ? 'dernières 24 h' : `${Math.round(hours / 24)} derniers jours`;
  const lines = [`🛡️ <b>Sécurité — ${period}</b>`, ''];
  if (s.events === 0) {
    lines.push('✅ Aucune tentative d’intrusion détectée.');
  } else {
    lines.push(`🚧 <b>${s.events}</b> tentative(s) bloquée(s) depuis <b>${s.sources}</b> source(s) :`);
    for (const t of s.byType) lines.push(`• ${e(SECURITY_EVENTS[t.type]?.title ?? t.type)} : ${t.n}`);
  }
  lines.push(
    '',
    s.open_incidents === 0
      ? '📋 Aucun incident ouvert.'
      : `📋 <b>${s.open_incidents}</b> incident(s) ouvert(s)${s.open_high ? `, dont <b>${s.open_high} grave(s)</b>` : ''} — bouton « ${BTN_INCIDENTS} ».`,
  );
  return lines.join('\n');
}

/** Boutons du menu Santé (et le bouton du menu principal). Renvoie true si le texte a été traité. */
export async function handleHealthButton(text: string, chatId: string): Promise<boolean> {
  if (text === HEALTH_BUTTON || text === BTN_FULL || text === '/sante' || text === '/santé' || text === '/health') {
    await send(chatId, '⏳ Vérification de tous les composants…');
    await send(chatId, formatHealth(await runSystemHealth(SITE)));
    return true;
  }
  if (text === BTN_SECURITY) {
    await send(chatId, await securityView());
    return true;
  }
  return false;
}

/** Incidents déjà traités (résolus ou fausses alertes), avec l'analyse de l'agent. */
async function handledView(): Promise<string> {
  const done = await listIncidents({ status: ['resolved', 'ignored'], limit: 50 });
  const recent = done.sort((a, b) => +new Date(b.last_seen) - +new Date(a.last_seen)).slice(0, 8);
  if (recent.length === 0) return '🗂️ <b>Incidents traités</b>\n\nAucun incident traité pour l’instant.';
  const lines = [`🗂️ <b>${recent.length} derniers incidents traités</b>`, ''];
  for (const i of recent) {
    const when = new Date(i.last_seen).toLocaleString('fr-FR', { timeZone: 'Africa/Abidjan', dateStyle: 'short', timeStyle: 'short' });
    lines.push(`${i.status === 'resolved' ? '✅' : '🙈'} <b>${e(i.title)}</b> · ${when} · ${e(i.ip || 'source inconnue')}${i.country ? ` (${e(i.country)})` : ''}`);
    lines.push(`   ${INCIDENT_STATUS_LABEL[i.status]}${i.handled_by ? ` par ${e(i.handled_by)}` : ''}${i.resolution ? ` — ${e(i.resolution.slice(0, 160))}` : ''}`);
  }
  return lines.join('\n');
}

/** Réglages sensibles et état de l'agent de sécurité (même contrôle que l'État du système). */
async function settingsView(): Promise<string> {
  const c = await checkSecurity();
  const lines = ['🔐 <b>Réglages de sécurité</b>', ''];
  for (const k of c.checks) lines.push(`${DOT[k.status]} <b>${e(k.label)}</b> : ${e(k.message)}`);
  lines.push('', `<i>Détail sur ${SITE}/platform/system</i>`);
  return lines.join('\n');
}

/** Menu « 🛡️ Sécurité » et ses boutons. Renvoie true si le texte a été traité. */
export async function handleSecurityButton(text: string, chatId: string): Promise<boolean> {
  const sendSec = (msg: string, markup: Record<string, unknown> = SECURITY_MENU.reply_markup) => send(chatId, msg, markup);
  if (text === SECURITY_BUTTON || text === SEC_RECAP || text === '/securite' || text === '/sécurité') {
    await sendSec(await securityView(24));
    return true;
  }
  if (text === SEC_WEEK) {
    await sendSec(await securityView(24 * 7));
    return true;
  }
  if (text === SEC_HANDLED) {
    await sendSec(await handledView());
    return true;
  }
  if (text === SEC_SETTINGS) {
    await sendSec(await settingsView());
    return true;
  }
  if (text === BTN_INCIDENTS) {
    const incidents = await listIncidents({ limit: 5 });
    if (incidents.length === 0) {
      await sendSec('📋 <b>Incidents de sécurité</b>\n\n✅ Aucun incident ouvert.');
      return true;
    }
    await sendSec(`📋 <b>${incidents.length} incident(s) ouvert(s)</b> (les plus graves d’abord)`);
    for (const i of incidents) await send(chatId, formatIncidentTelegram(i), incidentKeyboard(i));
    return true;
  }
  return false;
}

/** Boutons sous une alerte : sec:view|resolve|ignore:<id>. */
export async function handleSecurityCallback(action: string, id: string, chatId: string): Promise<void> {
  if (action === 'view') {
    const incident = await getIncident(id);
    if (!incident) return send(chatId, 'Incident introuvable.');
    const events = await incidentEvents(id, 5);
    const lines = [formatIncidentTelegram(incident), '', '<b>Derniers signaux :</b>'];
    for (const ev of events) {
      const t = new Date(ev.occurred_at).toLocaleTimeString('fr-FR', { timeZone: 'Africa/Abidjan' });
      lines.push(`• ${t} ${e(ev.method || '')} <code>${e(ev.route || '')}</code>${ev.user_agent ? ` — ${e(String(ev.user_agent).slice(0, 60))}` : ''}`);
    }
    if (incident.analysis) lines.push('', `🤖 <b>Analyse :</b> ${e(incident.analysis.slice(0, 1500))}`);
    if (incident.resolution) lines.push(`<b>Résolution :</b> ${e(incident.resolution.slice(0, 500))}`);
    return send(chatId, lines.join('\n'), incidentKeyboard(incident));
  }
  if (action === 'resolve' || action === 'ignore') {
    const incident = await updateIncident(id, {
      status: action === 'resolve' ? 'resolved' : 'ignored',
      handled_by: 'Super admin (Telegram)',
    });
    return send(
      chatId,
      incident
        ? `✅ Tâche <code>${incident.id.slice(0, 8)}</code> : <b>${INCIDENT_STATUS_LABEL[incident.status]}</b>. Les prochains signaux de cette source ouvriront un nouvel incident.`
        : 'Incident introuvable.',
    );
  }
}
