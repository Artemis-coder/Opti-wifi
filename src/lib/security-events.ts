// ============================================================
// OPTIWIFI - Détection des tentatives d'intrusion et alertes de sécurité.
//
// Chaque signal suspect (force brute, requête /api/db trafiquée, jeton falsifié, scan de
// fichiers sensibles…) est enregistré dans security_events et rattaché à un incident
// (security_incidents) qui regroupe les signaux d'une même source : c'est la « tâche » de
// sécurité, alertée sur Telegram et reprise par l'agent de sécurité.
//
// Alertes sans inondation : un incident n'est signalé qu'une fois son seuil atteint (dès le
// premier signal s'il est grave), puis au plus une fois par heure tant que l'attaque continue.
// L'enregistrement ne ralentit jamais la réponse (after) et n'échoue jamais.
// ============================================================
import { after } from 'next/server';
import { query } from '@/lib/neon/db';
import { escapeTelegramHtml, sendTelegramMessageDetailed } from '@/lib/telegram';
import { getSuperAdminUserIds, notifyUsers, telegramNotificationsEnabled } from '@/lib/notifications';
import { clientIp } from '@/lib/rate-limit';

export type SecuritySeverity = 1 | 2 | 3;

export type SecurityEventType =
  | 'login_rate_limited'
  | 'account_locked'
  | 'reset_flood'
  | 'register_flood'
  | 'db_tampering'
  | 'db_forbidden'
  | 'forged_token'
  | 'csrf_blocked'
  | 'path_scan'
  | 'admin_probe'
  | 'webhook_bad_secret'
  | 'legacy_route'
  | 'malformed_auth'
  | 'bot_stranger';

interface EventDefinition {
  severity: SecuritySeverity;
  title: string;
  /** Ce que cela signifie, en clair, pour l'alerte. */
  meaning: string;
  /** Regroupement : par adresse IP (défaut) ou par compte visé. */
  groupBy?: 'ip' | 'identifier';
}

export const SECURITY_EVENTS: Record<SecurityEventType, EventDefinition> = {
  login_rate_limited: {
    severity: 2,
    title: 'Force brute sur la connexion',
    meaning: 'Des mots de passe sont essayés en série. Les essais sont freinés automatiquement (429).',
  },
  account_locked: {
    severity: 3,
    title: 'Compte verrouillé après 10 échecs',
    meaning: 'Quelqu’un a essayé 10 mauvais mots de passe sur ce compte : il est bloqué 15 min.',
    groupBy: 'identifier',
  },
  reset_flood: {
    severity: 1,
    title: 'Demandes de réinitialisation en série',
    meaning: 'Envoi massif de « mot de passe oublié » (spam d’e-mails), freiné automatiquement.',
  },
  register_flood: {
    severity: 1,
    title: 'Inscriptions en série',
    meaning: 'Création de comptes en masse depuis la même adresse, freinée automatiquement.',
  },
  db_tampering: {
    severity: 3,
    title: 'Requête trafiquée vers la base',
    meaning:
      'Requête impossible depuis l’interface (table interdite, jointure, référence vers un autre client…) : quelqu’un manipule l’API à la main. Bloquée.',
  },
  db_forbidden: {
    severity: 2,
    title: 'Action refusée sur la base',
    meaning: 'Un compte tente une action que son rôle n’autorise pas. Bloquée.',
  },
  forged_token: {
    severity: 3,
    title: 'Jeton de session falsifié',
    meaning: 'Un cookie de session à la signature invalide a été présenté (tentative d’usurpation). Refusé.',
  },
  csrf_blocked: {
    severity: 2,
    title: 'Requête venant d’un autre site (CSRF)',
    meaning: 'Un site extérieur tente d’agir au nom d’un utilisateur connecté. Bloquée.',
  },
  path_scan: {
    severity: 2,
    title: 'Recherche de fichiers sensibles',
    meaning: 'Un robot cherche des fichiers secrets ou des failles connues (.env, .git, wp-admin…). Rien n’est exposé.',
  },
  admin_probe: {
    severity: 2,
    title: 'Accès au back-office refusé',
    meaning: 'Un compte qui n’est pas super admin appelle les API du back-office. Refusé.',
  },
  webhook_bad_secret: {
    severity: 2,
    title: 'Webhook ou cron appelé sans le bon secret',
    meaning: 'Quelqu’un appelle une route interne (bot, cron) sans le secret. Refusé.',
  },
  legacy_route: {
    severity: 2,
    title: 'Ancienne route de mot de passe appelée',
    meaning: 'Appel de la route désactivée qui changeait un mot de passe sans l’ancien (faille corrigée). Refusé.',
  },
  bot_stranger: {
    severity: 2,
    title: 'Un inconnu écrit au bot Telegram',
    meaning: 'Un compte Telegram autre que le vôtre a trouvé le bot et lui envoie des messages. Ignoré.',
    groupBy: 'identifier',
  },
  malformed_auth: {
    severity: 2,
    title: 'Connexion avec des données piégées',
    meaning: 'Identifiants envoyés dans un format anormal (objet, tableau…), typique d’un outil d’attaque. Refusé.',
  },
};

/** Nombre de signaux d'un incident avant la première alerte, selon la gravité. */
const ALERT_THRESHOLD: Record<SecuritySeverity, number> = { 3: 1, 2: 3, 1: 10 };
/** Pendant une attaque qui dure : au plus une alerte de suivi par heure et par incident. */
const REALERT_MINUTES = 60;
/** Au-delà, les alertes Telegram sont suspendues (in-app seulement) pour ne pas noyer le canal. */
const MAX_TELEGRAM_ALERTS_PER_HOUR = 20;
/** Un même type de signal d'une même IP n'est pas écrit plus de N fois par minute (anti-amplification). */
const MAX_EVENTS_PER_MINUTE = 30;

export const SEVERITY_LABEL: Record<number, string> = { 1: 'Faible', 2: 'Moyenne', 3: 'Élevée' };
const SEVERITY_EMOJI: Record<number, string> = { 1: '🔵', 2: '🟠', 3: '🔴' };
export const INCIDENT_STATUS_LABEL: Record<string, string> = {
  open: 'Ouvert',
  in_progress: 'En cours d’analyse',
  resolved: 'Résolu',
  ignored: 'Fausse alerte',
};

export interface SecurityEventInput {
  type: SecurityEventType;
  request?: Request | null;
  userId?: string | null;
  identifier?: string | null;
  route?: string | null;
  detail?: string | null;
}

const recent = new Map<string, number[]>();

function throttled(key: string): boolean {
  const now = Date.now();
  const hits = (recent.get(key) || []).filter((t) => now - t < 60_000);
  if (recent.size > 5000) recent.clear();
  if (hits.length >= MAX_EVENTS_PER_MINUTE) {
    recent.set(key, hits);
    return true;
  }
  hits.push(now);
  recent.set(key, hits);
  return false;
}

const clip = (value: string | null | undefined, max: number) => (value ? String(value).slice(0, max) : null);

/**
 * Signale un événement suspect. Rend la main tout de suite : l'écriture et l'alerte se font
 * après la réponse. À appeler dans une route, le proxy ou une fonction serveur.
 */
export function reportSecurityEvent(input: SecurityEventInput): void {
  const req = input.request ?? null;
  // Les en-têtes sont lus maintenant (la requête n'est plus accessible après la réponse)
  const ip = req ? clientIp(req) : null;
  const ctx = {
    ip,
    country: clip(req?.headers.get('x-vercel-ip-country'), 2),
    userAgent: clip(req?.headers.get('user-agent'), 300),
    method: clip(req?.method, 10),
    route: clip(input.route ?? (req ? new URL(req.url).pathname : null), 300),
  };
  if (throttled(`${input.type}:${ip ?? input.identifier ?? '-'}`)) return;
  const task = () => recordSecurityEvent(input, ctx).catch((err) => console.error('security event error:', err));
  try {
    after(task);
  } catch {
    // Hors contexte de requête (script, test) : enregistrement direct
    void task();
  }
}

interface EventContext {
  ip: string | null;
  country: string | null;
  userAgent: string | null;
  method: string | null;
  route: string | null;
}

async function recordSecurityEvent(input: SecurityEventInput, ctx: EventContext): Promise<void> {
  const def = SECURITY_EVENTS[input.type];
  const identifier = clip(input.identifier?.trim().toLowerCase(), 254);
  const detail = clip(input.detail, 1000);
  const source = def.groupBy === 'identifier' && identifier ? identifier : ctx.ip || identifier || 'inconnu';
  const fingerprint = `${input.type}:${source}`.slice(0, 200);

  // Incident actif de cette source (créé au besoin) : compteur et dernière trace mis à jour
  const { rows } = await query(
    `INSERT INTO security_incidents
       (fingerprint, type, severity, title, ip, country, user_id, identifier, last_route, last_detail, event_count)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1)
     ON CONFLICT (fingerprint) WHERE status IN ('open', 'in_progress') DO UPDATE SET
       event_count = security_incidents.event_count + 1,
       severity    = GREATEST(security_incidents.severity, EXCLUDED.severity),
       last_seen   = NOW(),
       updated_at  = NOW(),
       last_route  = EXCLUDED.last_route,
       last_detail = EXCLUDED.last_detail,
       user_id     = COALESCE(EXCLUDED.user_id, security_incidents.user_id),
       identifier  = COALESCE(EXCLUDED.identifier, security_incidents.identifier),
       country     = COALESCE(EXCLUDED.country, security_incidents.country)
     RETURNING id, event_count, severity, alerted_count, last_alert_at`,
    [fingerprint, input.type, def.severity, def.title, ctx.ip, ctx.country, input.userId ?? null, identifier,
     ctx.route, detail],
  );
  const incident = rows[0] as { id: string; event_count: number; severity: SecuritySeverity };

  await query(
    `INSERT INTO security_events (type, severity, ip, country, user_id, identifier, method, route, user_agent, detail, incident_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [input.type, def.severity, ctx.ip, ctx.country, input.userId ?? null, identifier, ctx.method, ctx.route,
     ctx.userAgent, detail, incident.id],
  );

  if (incident.event_count < ALERT_THRESHOLD[incident.severity]) return;

  // Prise atomique du droit d'alerter (une seule alerte même si plusieurs signaux arrivent ensemble)
  const claim = await query(
    `UPDATE security_incidents s
        SET last_alert_at = NOW(), alerted_count = s.event_count
       FROM (SELECT id, last_alert_at AS previous FROM security_incidents WHERE id = $1) p
      WHERE s.id = p.id
        AND s.event_count > s.alerted_count
        AND (s.last_alert_at IS NULL OR s.last_alert_at < NOW() - make_interval(mins => $2))
      RETURNING p.previous`,
    [incident.id, REALERT_MINUTES],
  );
  if (claim.rows.length === 0) return;
  await alertIncident(incident.id, claim.rows[0].previous !== null);
}

// ── Incidents (« tâches » de sécurité) ────────────────────────────────────────

export interface SecurityIncident {
  id: string;
  type: SecurityEventType;
  severity: SecuritySeverity;
  status: 'open' | 'in_progress' | 'resolved' | 'ignored';
  title: string;
  ip: string | null;
  country: string | null;
  user_id: string | null;
  user_email: string | null;
  identifier: string | null;
  last_route: string | null;
  last_detail: string | null;
  event_count: number;
  alerted_count: number;
  first_seen: string;
  last_seen: string;
  last_alert_at: string | null;
  analysis: string | null;
  resolution: string | null;
  handled_by: string | null;
}

const INCIDENT_COLUMNS = `i.id, i.type, i.severity, i.status, i.title, i.ip, i.country, i.user_id, u.email AS user_email,
  i.identifier, i.last_route, i.last_detail, i.event_count, i.alerted_count, i.first_seen, i.last_seen,
  i.last_alert_at, i.analysis, i.resolution, i.handled_by`;

export async function getIncident(id: string): Promise<SecurityIncident | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { rows } = await query(
    `SELECT ${INCIDENT_COLUMNS} FROM security_incidents i LEFT JOIN users u ON u.id = i.user_id WHERE i.id = $1`,
    [id],
  );
  return (rows[0] as SecurityIncident) ?? null;
}

export async function listIncidents(opts: { status?: string[]; limit?: number } = {}): Promise<SecurityIncident[]> {
  const status = opts.status?.length ? opts.status : ['open', 'in_progress'];
  const { rows } = await query(
    `SELECT ${INCIDENT_COLUMNS} FROM security_incidents i LEFT JOIN users u ON u.id = i.user_id
      WHERE i.status = ANY($1::text[])
      ORDER BY i.severity DESC, i.last_seen DESC LIMIT $2`,
    [status, Math.min(Math.max(opts.limit ?? 50, 1), 200)],
  );
  return rows as SecurityIncident[];
}

/** Derniers signaux d'un incident (pour l'analyse). */
export async function incidentEvents(id: string, limit = 50) {
  const { rows } = await query(
    `SELECT occurred_at, type, severity, ip, country, identifier, method, route, user_agent, detail
       FROM security_events WHERE incident_id = $1 ORDER BY occurred_at DESC LIMIT $2`,
    [id, Math.min(limit, 200)],
  );
  return rows;
}

export async function updateIncident(
  id: string,
  patch: { status?: SecurityIncident['status']; analysis?: string | null; resolution?: string | null; handled_by?: string | null },
): Promise<SecurityIncident | null> {
  if (patch.status && !['open', 'in_progress', 'resolved', 'ignored'].includes(patch.status)) return null;
  const { rows } = await query(
    `UPDATE security_incidents SET
        status     = COALESCE($2, status),
        analysis   = COALESCE($3, analysis),
        resolution = COALESCE($4, resolution),
        handled_by = COALESCE($5, handled_by),
        updated_at = NOW()
      WHERE id = $1 RETURNING id`,
    [id, patch.status ?? null, clip(patch.analysis, 8000), clip(patch.resolution, 4000), clip(patch.handled_by, 80)],
  );
  return rows[0] ? getIncident(id) : null;
}

/** Résumé des dernières 24 h (menu Telegram, État du système). */
export async function securitySummary(hours = 24) {
  const { rows } = await query(
    `SELECT
        (SELECT COUNT(*)::int FROM security_events WHERE occurred_at > NOW() - make_interval(hours => $1)) AS events,
        (SELECT COUNT(DISTINCT ip)::int FROM security_events WHERE occurred_at > NOW() - make_interval(hours => $1)) AS sources,
        (SELECT COUNT(*)::int FROM security_incidents WHERE status IN ('open', 'in_progress')) AS open_incidents,
        (SELECT COUNT(*)::int FROM security_incidents WHERE status IN ('open', 'in_progress') AND severity = 3) AS open_high`,
    [hours],
  );
  const byType = await query(
    `SELECT type, COUNT(*)::int AS n FROM security_events
      WHERE occurred_at > NOW() - make_interval(hours => $1) GROUP BY type ORDER BY n DESC`,
    [hours],
  );
  return {
    ...(rows[0] as { events: number; sources: number; open_incidents: number; open_high: number }),
    byType: byType.rows as { type: SecurityEventType; n: number }[],
  };
}

/** Conservation : signaux 90 jours, incidents clos 180 jours. */
export async function purgeSecurityEvents(): Promise<void> {
  await query(`DELETE FROM security_events WHERE occurred_at < NOW() - interval '90 days'`);
  await query(`DELETE FROM security_incidents WHERE status IN ('resolved', 'ignored') AND updated_at < NOW() - interval '180 days'`);
}

// ── Alerte ─────────────────────────────────────────────────────────────────

const fmtTime = (d: string | Date) =>
  new Date(d).toLocaleString('fr-FR', { timeZone: 'Africa/Abidjan', dateStyle: 'short', timeStyle: 'short' });

/** Texte Telegram (HTML) d'un incident. */
export function formatIncidentTelegram(i: SecurityIncident, opts: { followUp?: boolean } = {}): string {
  const def = SECURITY_EVENTS[i.type];
  const e = escapeTelegramHtml;
  const lines = [
    `🚨 <b>${opts.followUp ? 'Attaque toujours en cours' : 'Tentative d’intrusion détectée'}</b>`,
    `${SEVERITY_EMOJI[i.severity]} Gravité : <b>${SEVERITY_LABEL[i.severity]}</b>`,
    '',
    `<b>Type :</b> ${e(i.title)}`,
    `<b>Source :</b> ${e(i.ip || 'inconnue')}${i.country ? ` (${e(i.country)})` : ''}`,
  ];
  if (i.user_email || i.identifier) lines.push(`<b>Compte :</b> ${e(i.user_email || i.identifier || '')}`);
  if (i.last_route) lines.push(`<b>Route :</b> <code>${e(i.last_route)}</code>`);
  lines.push(`<b>Tentatives :</b> ${i.event_count} depuis ${fmtTime(i.first_seen)}`);
  if (i.last_detail) lines.push(`<b>Détail :</b> ${e(i.last_detail.slice(0, 300))}`);
  lines.push('', `ℹ️ ${e(def?.meaning || '')}`);
  lines.push('', `📋 Tâche <code>${i.id.slice(0, 8)}</code> : ${INCIDENT_STATUS_LABEL[i.status]} — l’agent de sécurité va l’analyser.`);
  return lines.join('\n');
}

export function incidentKeyboard(i: SecurityIncident) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.optiwifi.site').replace(/\/$/, '');
  const rows: { text: string; callback_data?: string; url?: string }[][] = [
    [{ text: '🔍 Détails', callback_data: `sec:view:${i.id}` }],
    [
      { text: '✅ Résolu', callback_data: `sec:resolve:${i.id}` },
      { text: '🙈 Fausse alerte', callback_data: `sec:ignore:${i.id}` },
    ],
  ];
  if (base.startsWith('https://')) rows.push([{ text: 'Ouvrir l’État du système', url: `${base}/platform/system` }]);
  return { inline_keyboard: rows };
}

async function alertIncident(id: string, followUp: boolean): Promise<void> {
  const incident = await getIncident(id);
  if (!incident) return;

  // Notification dans l'application (cloche + push) pour les super admins
  await notifyUsers(await getSuperAdminUserIds(), {
    type: 'security.alert',
    title: `${followUp ? 'Attaque en cours' : 'Tentative d’intrusion'} : ${incident.title}`,
    body: `${incident.event_count} tentative(s) depuis ${incident.ip || 'une source inconnue'}. ${SECURITY_EVENTS[incident.type]?.meaning || ''}`,
    link: '/platform/system',
    dedupeKey: `security:${incident.id}:${incident.event_count}`,
    ring: incident.severity === 3,
  });

  await sendIncidentTelegram(incident, followUp);
  // Premier signalement : analyse automatique (diagnostic sur Telegram, enregistré sur la tâche)
  if (!followUp) {
    const { triageIncident } = await import('@/lib/security-triage');
    await triageIncident(incident.id);
  }
}

async function sendIncidentTelegram(incident: SecurityIncident, followUp: boolean): Promise<void> {
  if (!telegramNotificationsEnabled()) return;
  const { rows } = await query(
    `SELECT COUNT(*)::int AS n FROM security_incidents WHERE last_alert_at > NOW() - interval '1 hour'`,
  );
  if (Number(rows[0]?.n) > MAX_TELEGRAM_ALERTS_PER_HOUR) return;
  await sendTelegramMessageDetailed({
    text: formatIncidentTelegram(incident, { followUp }),
    parse_mode: 'HTML',
    reply_markup: incidentKeyboard(incident),
  });
}
