// ============================================================
// OPTIWIFI - Assistant Telegram du super admin, propulsé par Claude.
// Lecture : outils métier en lecture seule (admin-data.ts).
// Écriture : l'assistant prépare l'action, le super admin la valide par un bouton
// « Confirmer » ; l'exécution passe par les mêmes fonctions que le back-office.
// ============================================================
import Anthropic from '@anthropic-ai/sdk';
import { query } from '@/lib/neon/db';
import { sendTelegramMessageDetailed } from '@/lib/telegram';
import {
  activateLicense,
  rejectLicenseRequest,
  setOrganizationStatus,
  ORGANIZATION_ACTIONS,
  UUID_RE,
  type ActionResult,
} from '@/lib/platform-actions';
import {
  getOrganizationDetails,
  getPlatformOverview,
  getRecentActivity,
  getRevenueReport,
  getTechnicalStatus,
  listExpiringLicences,
  listLicenseRequests,
  listOrganizations,
  listPlans,
  resolveOrganization,
  searchUsers,
} from '@/lib/bot/admin-data';
import { isOpenModelAvailable, openModelCompletion, type ChatMessage, type FunctionTool, type OpenModel } from '@/lib/bot/open-models';

export const CLAUDE_MODEL = 'claude-opus-5-5';
const MAX_TOOL_ROUNDS = 6;
const HISTORY_MESSAGES = 16;
const ACTION_TTL_MINUTES = 30;

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ maxRetries: 2, timeout: 120_000 });
  return client;
}

// ── Clavier principal (boutons sous la zone de saisie) ───────────────────────

export const ADMIN_MENU = {
  reply_markup: {
    keyboard: [
      [{ text: '📊 Vue d’ensemble' }, { text: '🧾 Demandes en attente' }],
      [{ text: '🏢 Clients' }, { text: '⏳ Licences à renouveler' }],
      [{ text: '💰 Encaissements du mois' }, { text: '🖥️ Statut technique' }],
      [{ text: '❓ Aide' }],
    ],
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: 'Posez une question ou demandez une action…',
  },
};

/** Boutons du menu → question posée à l'assistant. */
export const MENU_PROMPTS: Record<string, string> = {
  '📊 Vue d’ensemble': "Donne-moi la vue d'ensemble de la plateforme aujourd'hui.",
  '🧾 Demandes en attente': 'Quelles sont les demandes de licence en attente ? Détaille chacune.',
  '🏢 Clients': 'Liste les clients avec leur forfait, la fin de licence et leur activité.',
  '⏳ Licences à renouveler': 'Quelles licences expirent dans les 30 prochains jours, et lesquelles sont déjà expirées ?',
  '💰 Encaissements du mois': 'Donne le détail des encaissements de ce mois, par client et par point de vente.',
  '🖥️ Statut technique': 'Quel est le statut technique du projet (déploiements, base de données) ?',
  '📊 Statut Projet': 'Quel est le statut technique du projet (déploiements, base de données) ?',
};

// ── Envoi Telegram (HTML restreint, découpage, repli en texte brut) ──────────

const ALLOWED_TAGS = /&lt;(\/?)(b|strong|i|em|u|s|code|pre|blockquote)&gt;/g;
const ALLOWED_LINK = /&lt;a href=&quot;(https?:\/\/[^"<>\s]+?)&quot;&gt;/g;

/** Échappe tout, puis réactive uniquement les balises acceptées par Telegram. */
export function toTelegramHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(ALLOWED_TAGS, '<$1$2>')
    .replace(ALLOWED_LINK, '<a href="$1">')
    .replace(/&lt;\/a&gt;/g, '</a>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); // gras Markdown éventuel
}

function chunks(text: string, size = 3800): string[] {
  const parts: string[] = [];
  let rest = text;
  while (rest.length > size) {
    const cut = rest.lastIndexOf('\n', size) > size / 2 ? rest.lastIndexOf('\n', size) : size;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  parts.push(rest);
  return parts.filter((p) => p.trim());
}

export async function sendBotMessage(chatId: string, html: string, replyMarkup: Record<string, unknown> = ADMIN_MENU.reply_markup) {
  const parts = chunks(html);
  for (let i = 0; i < parts.length; i++) {
    const markup = i === parts.length - 1 ? replyMarkup : undefined;
    const res = await sendTelegramMessageDetailed({ chat_id: chatId, text: parts[i], parse_mode: 'HTML', reply_markup: markup });
    if (!res.ok && /parse entities|can't find end tag|unsupported start tag/i.test(res.error || '')) {
      // Balises mal formées : on renvoie le même texte sans mise en forme
      await sendTelegramMessageDetailed({ chat_id: chatId, text: parts[i].replace(/<[^>]+>/g, ''), reply_markup: markup });
    }
  }
}

export async function sendTyping(chatId: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => {});
}

// ── Actions à confirmer ─────────────────────────────────────────────────────

type PendingAction =
  | { kind: 'activate_license'; organizationId: string; planId: string; durationMonths: number; requestId?: string | null; note?: string | null }
  | { kind: 'reject_license_request'; requestId: string; note?: string | null }
  | { kind: 'organization_status'; organizationId: string; action: string; reason?: string | null };

async function getBotPlatformUserId(): Promise<string | null> {
  const email = process.env.TELEGRAM_ADMIN_EMAIL?.trim().toLowerCase();
  const { rows } = await query(
    `SELECT id FROM platform_users WHERE role = 'super_admin' AND is_active = true
      ORDER BY ($1::text IS NOT NULL AND lower(email) = $1) DESC, created_at LIMIT 1`,
    [email || null]
  );
  return rows[0]?.id ?? null;
}

async function proposeAction(chatId: string, summary: string, action: PendingAction) {
  const { rows } = await query(
    `INSERT INTO conversation_messages (chat_id, role, content, metadata)
     VALUES ($1, 'pending_action', $2, $3) RETURNING id`,
    [chatId, summary, JSON.stringify({ status: 'pending', action })]
  );
  const id = rows[0].id;
  await sendBotMessage(chatId, `⚠️ <b>Action à confirmer</b>\n\n${toTelegramHtml(summary)}`, {
    inline_keyboard: [[
      { text: '✅ Confirmer', callback_data: `act:ok:${id}` },
      { text: '❌ Annuler', callback_data: `act:no:${id}` },
    ]],
  });
  return {
    statut: 'en_attente_de_confirmation',
    message: "Les boutons Confirmer / Annuler ont été envoyés à l'utilisateur. L'action n'est PAS encore faite.",
  };
}

/** Clic sur Confirmer / Annuler (callback « act:ok:<id> » / « act:no:<id> »). */
export async function handleActionCallback(chatId: string, decision: string, id: string): Promise<string> {
  if (!/^\d+$/.test(id)) return 'Action invalide.';
  const newStatus = decision === 'ok' ? 'executing' : 'cancelled';
  // Passage atomique « pending » → statut suivant : un double clic n'exécute rien deux fois
  const { rows } = await query(
    `UPDATE conversation_messages
        SET metadata = jsonb_set(metadata, '{status}', to_jsonb($3::text))
      WHERE id = $1 AND chat_id = $2 AND role = 'pending_action'
        AND metadata->>'status' = 'pending' AND created_at > NOW() - make_interval(mins => $4)
      RETURNING content, metadata`,
    [id, chatId, newStatus, ACTION_TTL_MINUTES]
  );
  if (!rows[0]) return 'Cette action a déjà été traitée ou a expiré : redemandez-la si besoin.';
  if (decision !== 'ok') return `❌ Annulé : ${toTelegramHtml(rows[0].content)}`;

  const platformUserId = await getBotPlatformUserId();
  if (!platformUserId) return '❌ Aucun compte super admin actif pour signer cette action.';
  const action = rows[0].metadata.action as PendingAction;
  let result: ActionResult;
  try {
    if (action.kind === 'activate_license') {
      result = await activateLicense({ ...action, platformUserId, note: action.note ?? 'Via Telegram' });
    } else if (action.kind === 'reject_license_request') {
      result = await rejectLicenseRequest({ requestId: action.requestId, note: action.note, platformUserId });
    } else {
      result = await setOrganizationStatus({ ...action, platformUserId });
    }
  } catch (err) {
    console.error('Bot action error:', err);
    result = { ok: false, status: 500, error: "Erreur technique pendant l'exécution." };
  }
  await query(`UPDATE conversation_messages SET metadata = jsonb_set(metadata, '{status}', to_jsonb($2::text)) WHERE id = $1`, [
    id,
    result.ok ? 'done' : 'failed',
  ]);
  const text = result.ok ? `✅ ${result.message}` : `❌ ${result.error}`;
  await query(`INSERT INTO conversation_messages (chat_id, role, content) VALUES ($1, 'assistant', $2)`, [chatId, `[Action] ${text}`]);
  return toTelegramHtml(text);
}

async function resolvePlan(ref: string) {
  const value = (ref || '').trim();
  const { rows } = await query(
    `SELECT id, name, trial_days FROM subscription_plans
      WHERE status = 'active' AND (id::text = $1 OR lower(name) = lower($1) OR name ILIKE $2)
      ORDER BY (lower(name) = lower($1)) DESC LIMIT 2`,
    [value, `%${value.replace(/[%_\\]/g, '\\$&')}%`]
  );
  return rows.length === 1 || (rows[0] && rows[0].name.toLowerCase() === value.toLowerCase()) ? rows[0] : null;
}

const STATUS_LABELS: Record<string, string> = {
  approve: "valider l'inscription de",
  activate: 'activer',
  reactivate: 'réactiver',
  suspend: 'suspendre (accès coupé pour tous ses membres)',
  cancel: "refuser l'inscription de",
  archive: 'supprimer (accès coupé, données conservées)',
};

// ── Outils ───────────────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'platform_overview',
    description: "Vue d'ensemble de la plateforme : organisations par statut, licences actives et à renouveler, demandes de licence, encaissements du mois et du mois dernier, activité, dernières inscriptions.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'list_organizations',
    description: 'Liste les organisations clientes avec forfait en cours, fin de licence, nombre d’utilisateurs et de points de vente, dernière collecte.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['trial', 'active', 'expiring', 'expired', 'suspended', 'cancelled', 'archived', 'pending_approval'], description: 'Filtrer par statut (pending_approval = inscription à valider).' },
        search: { type: 'string', description: 'Nom, e-mail ou contact (recherche partielle).' },
        limit: { type: 'integer', description: 'Nombre maximum (défaut 20, max 50).' },
      },
    },
  },
  {
    name: 'organization_details',
    description: "Fiche complète d'une organisation : coordonnées, historique des licences, membres et dernière connexion, points de vente, espaces WiFi, encaissements et tickets des 30 derniers jours, dernières collectes, demandes de licence.",
    input_schema: {
      type: 'object',
      properties: { organization: { type: 'string', description: "Nom (même partiel) ou identifiant de l'organisation." } },
      required: ['organization'],
    },
  },
  {
    name: 'list_license_requests',
    description: 'Demandes de licence (par défaut celles en attente) avec organisation, forfait demandé, durée, prix, licence actuelle. Renvoie request_id, nécessaire pour approuver ou refuser.',
    input_schema: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['pending', 'approved', 'rejected', 'cancelled', 'all'] } },
    },
  },
  {
    name: 'list_expiring_licences',
    description: 'Licences qui expirent dans les N prochains jours (sans renouvellement prévu) et organisations dont la licence est déjà expirée.',
    input_schema: { type: 'object', properties: { days: { type: 'integer', description: 'Fenêtre en jours (défaut 30).' } } },
  },
  {
    name: 'revenue_report',
    description: 'Encaissements (montants collectés, attendus, commissions) sur une période, au total, par organisation et par point de vente. Optionnellement pour une seule organisation.',
    input_schema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['today', 'week', 'month', 'last_month', 'year', 'last_30_days'] },
        organization: { type: 'string', description: 'Nom ou identifiant pour limiter à une organisation.' },
      },
    },
  },
  {
    name: 'search_users',
    description: 'Recherche un utilisateur (nom, e-mail, téléphone) dans toutes les organisations : rôle, statut, organisation, dernière connexion.',
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
  {
    name: 'list_plans',
    description: 'Forfaits disponibles (prix, période, jours d’essai, limites).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'recent_activity',
    description: 'Dernières actions faites dans le back-office (activations, refus, suspensions…).',
    input_schema: { type: 'object', properties: { limit: { type: 'integer' } } },
  },
  {
    name: 'technical_status',
    description: 'Statut technique : version en cours, derniers déploiements production et preview (Vercel), état et latence de la base de données.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'approve_license_request',
    description: "Prépare l'approbation d'une demande de licence en attente (active le forfait demandé). Envoie des boutons de confirmation : l'action n'est exécutée qu'après le clic de l'utilisateur.",
    input_schema: {
      type: 'object',
      properties: {
        request_id: { type: 'string', description: 'request_id obtenu via list_license_requests.' },
        duration_months: { type: 'integer', description: 'Durée en mois si différente de celle demandée (1 à 36).' },
      },
      required: ['request_id'],
    },
  },
  {
    name: 'reject_license_request',
    description: "Prépare le refus d'une demande de licence en attente, avec un motif transmis au client. Boutons de confirmation envoyés.",
    input_schema: {
      type: 'object',
      properties: { request_id: { type: 'string' }, reason: { type: 'string', description: 'Motif communiqué au client.' } },
      required: ['request_id'],
    },
  },
  {
    name: 'activate_license',
    description: "Prépare l'activation directe d'un forfait pour une organisation, sans demande préalable. Boutons de confirmation envoyés.",
    input_schema: {
      type: 'object',
      properties: {
        organization: { type: 'string', description: 'Nom ou identifiant.' },
        plan: { type: 'string', description: 'Nom ou identifiant du forfait.' },
        duration_months: { type: 'integer', description: '1 à 36.' },
      },
      required: ['organization', 'plan', 'duration_months'],
    },
  },
  {
    name: 'change_organization_status',
    description: "Prépare un changement de statut d'organisation : approve (valider une inscription), cancel (refuser une inscription), suspend, reactivate, activate, archive (supprimer, données conservées). Boutons de confirmation envoyés.",
    input_schema: {
      type: 'object',
      properties: {
        organization: { type: 'string' },
        action: { type: 'string', enum: [...ORGANIZATION_ACTIONS] },
        reason: { type: 'string', description: 'Motif (communiqué au client pour un refus).' },
      },
      required: ['organization', 'action'],
    },
  },
];

type ToolInput = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : '');

async function runTool(chatId: string, name: string, input: ToolInput): Promise<unknown> {
  switch (name) {
    case 'platform_overview':
      return getPlatformOverview();
    case 'list_organizations':
      return listOrganizations(input as { status?: string; search?: string; limit?: number });
    case 'organization_details':
      return getOrganizationDetails({ organization: str(input.organization) });
    case 'list_license_requests':
      return listLicenseRequests({ status: str(input.status) });
    case 'list_expiring_licences':
      return listExpiringLicences({ days: Number(input.days) });
    case 'revenue_report':
      return getRevenueReport({ period: str(input.period), organization: str(input.organization) || undefined });
    case 'search_users':
      return searchUsers({ query: str(input.query) });
    case 'list_plans':
      return listPlans();
    case 'recent_activity':
      return getRecentActivity({ limit: Number(input.limit) });
    case 'technical_status':
      return getTechnicalStatus();

    case 'approve_license_request': {
      const requestId = str(input.request_id);
      if (!UUID_RE.test(requestId)) return { error: 'request_id invalide : utilisez list_license_requests.' };
      const { rows } = await query(
        `SELECT r.organization_id, r.plan_id, r.duration_months, r.status, o.name AS org, p.name AS plan, p.price, p.currency
           FROM license_requests r JOIN organizations o ON o.id = r.organization_id
           LEFT JOIN subscription_plans p ON p.id = r.plan_id WHERE r.id = $1`,
        [requestId]
      );
      const r = rows[0];
      if (!r) return { error: 'Demande introuvable.' };
      if (r.status !== 'pending') return { error: `Cette demande est déjà ${r.status}.` };
      if (!r.plan_id) return { error: 'La demande ne précise pas de forfait : utilisez activate_license.' };
      const months = Number(input.duration_months) || Number(r.duration_months) || 1;
      return proposeAction(chatId, `Approuver la demande de « ${r.org} » : forfait ${r.plan} pour ${months} mois${r.price ? ` (${Number(r.price).toLocaleString('fr-FR')} ${r.currency || 'FCFA'}/période)` : ''}.`, {
        kind: 'activate_license',
        organizationId: r.organization_id,
        planId: r.plan_id,
        durationMonths: months,
        requestId,
      });
    }
    case 'reject_license_request': {
      const requestId = str(input.request_id);
      if (!UUID_RE.test(requestId)) return { error: 'request_id invalide : utilisez list_license_requests.' };
      const { rows } = await query(
        `SELECT r.status, o.name AS org, p.name AS plan FROM license_requests r JOIN organizations o ON o.id = r.organization_id
           LEFT JOIN subscription_plans p ON p.id = r.plan_id WHERE r.id = $1`,
        [requestId]
      );
      if (!rows[0]) return { error: 'Demande introuvable.' };
      if (rows[0].status !== 'pending') return { error: `Cette demande est déjà ${rows[0].status}.` };
      const reason = str(input.reason).trim() || null;
      return proposeAction(chatId, `Refuser la demande de « ${rows[0].org} » (forfait ${rows[0].plan || '—'})${reason ? ` — motif : ${reason}` : ''}.`, {
        kind: 'reject_license_request',
        requestId,
        note: reason,
      });
    }
    case 'activate_license': {
      const org = await resolveOrganization(str(input.organization));
      if (!org.ok) return org;
      const plan = await resolvePlan(str(input.plan));
      if (!plan) return { error: 'Forfait introuvable ou ambigu : utilisez list_plans.' };
      const months = Number(input.duration_months);
      if (!Number.isInteger(months) || months < 1 || months > 36) return { error: 'Durée invalide (1 à 36 mois).' };
      return proposeAction(chatId, `Activer le forfait ${plan.name} pour « ${org.name} » pendant ${months} mois.`, {
        kind: 'activate_license',
        organizationId: org.id,
        planId: plan.id,
        durationMonths: months,
      });
    }
    case 'change_organization_status': {
      const action = str(input.action);
      if (!(ORGANIZATION_ACTIONS as readonly string[]).includes(action)) return { error: 'Action invalide.' };
      const org = await resolveOrganization(str(input.organization));
      if (!org.ok) return org;
      const reason = str(input.reason).trim() || null;
      return proposeAction(chatId, `${STATUS_LABELS[action][0].toUpperCase()}${STATUS_LABELS[action].slice(1)} « ${org.name} »${reason ? ` — motif : ${reason}` : ''}.`, {
        kind: 'organization_status',
        organizationId: org.id,
        action,
        reason,
      });
    }
    default:
      return { error: `Outil inconnu : ${name}` };
  }
}

// ── Conversation ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es l'assistant du super administrateur d'OptiSpace (optiwifi.site), une plateforme SaaS de gestion de WiFi pour des clients en Afrique de l'Ouest (montants en FCFA). Tu échanges avec lui sur Telegram.

Ce que tu fais :
- Tu réponds à partir des données réelles de la plateforme, obtenues avec tes outils. N'invente jamais un chiffre, une date ou un nom : si un outil ne renvoie rien ou renvoie une erreur, dis-le clairement et explique la cause probable.
- Tu donnes des réponses détaillées et utiles : chiffres précis, dates, noms des clients concernés, et ce qu'il faudrait faire ensuite (relancer un client, valider une demande…).
- Quand on te demande d'agir (approuver ou refuser une demande, activer une licence, valider une inscription, suspendre, réactiver, supprimer un espace), utilise directement l'outil d'action correspondant. Il envoie des boutons « Confirmer / Annuler » : précise ensuite que l'action attend ce clic, sans jamais dire qu'elle est faite.
- Si une demande est ambiguë (plusieurs clients correspondent, forfait non précisé), demande la précision au lieu de deviner.

Format des réponses (Telegram) :
- Français, ton direct et professionnel.
- Mise en forme HTML Telegram uniquement : <b>gras</b>, <i>italique</i>, <code>code</code>, <a href="https://…">lien</a>. Pas de Markdown, pas de titres #, pas de tableaux.
- Listes avec des tirets ou des émojis sobres, une information par ligne. Dates au format JJ/MM/AAAA, montants avec séparateur de milliers (ex. 125 000 FCFA).
- N'affiche jamais d'identifiants techniques (UUID) sauf si on te les demande.`;

async function loadHistory(chatId: string): Promise<Anthropic.MessageParam[]> {
  const { rows } = await query(
    `SELECT role, content FROM conversation_messages
      WHERE chat_id = $1 AND role IN ('user', 'assistant') AND content <> ''
      ORDER BY created_at DESC LIMIT $2`,
    [chatId, HISTORY_MESSAGES]
  );
  const history: Anthropic.MessageParam[] = [];
  for (const r of rows.reverse()) {
    const role = r.role as 'user' | 'assistant';
    // L'API exige d'alterner et de commencer par l'utilisateur : on fusionne les messages consécutifs
    const last = history[history.length - 1];
    if (last && last.role === role) last.content = `${last.content}\n\n${r.content}`;
    else if (history.length > 0 || role === 'user') history.push({ role, content: r.content });
  }
  if (history.length && history[history.length - 1].role === 'user') history.pop();
  return history;
}

function textOf(content: Anthropic.ContentBlock[]): string {
  return content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n').trim();
}

/** Erreur Claude survenue avant ou après l'exécution d'outils (relais impossible si des outils ont tourné). */
class AssistantError extends Error {
  constructor(public cause: unknown, public toolsRan: boolean) {
    super('assistant error');
  }
}

async function executeTools(chatId: string, calls: { id: string; name: string; input: ToolInput }[]) {
  return Promise.all(
    calls.map(async (c) => {
      try {
        return { id: c.id, content: JSON.stringify(await runTool(chatId, c.name, c.input)), isError: false };
      } catch (err) {
        console.error(`Bot tool ${c.name} error:`, err);
        return { id: c.id, content: 'Erreur technique pendant la lecture des données.', isError: true };
      }
    })
  );
}

const TOO_MANY_STEPS = 'Je n’ai pas pu terminer : la demande nécessite trop d’étapes. Précisez-la un peu.';

async function runClaudeLoop(chatId: string, history: Anthropic.MessageParam[], userContent: string, deliver: boolean): Promise<string> {
  const messages: Anthropic.MessageParam[] = [...history, { role: 'user', content: userContent }];
  let toolsRan = false;
  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await getClient().beta.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 8000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium' },
        cache_control: { type: 'ephemeral' },
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages: messages as Anthropic.Beta.BetaMessageParam[],
      });

      if (response.stop_reason === 'refusal') return 'Je ne peux pas traiter cette demande. Reformulez-la ou utilisez le back-office.';
      const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
      if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
        const text = textOf(response.content as Anthropic.ContentBlock[]);
        return response.stop_reason === 'max_tokens' ? `${text}\n\n<i>(réponse tronquée)</i>` : text;
      }

      messages.push({ role: 'assistant', content: response.content as Anthropic.ContentBlockParam[] });
      if (round === 0 && deliver) await sendTyping(chatId);
      toolsRan = true;
      const results = await executeTools(chatId, toolUses.map((t) => ({ id: t.id, name: t.name, input: (t.input || {}) as ToolInput })));
      messages.push({
        role: 'user',
        content: results.map((r): Anthropic.ToolResultBlockParam => ({ type: 'tool_result', tool_use_id: r.id, content: r.content, ...(r.isError ? { is_error: true } : {}) })),
      });
    }
    return TOO_MANY_STEPS;
  } catch (err) {
    throw new AssistantError(err, toolsRan);
  }
}

const OPEN_TOOLS: FunctionTool[] = TOOLS.map((t) => ({
  type: 'function',
  function: { name: t.name, description: t.description || '', parameters: t.input_schema as Record<string, unknown> },
}));

/** Même conversation et mêmes outils avec un modèle open source (Groq, Together, OpenRouter). */
async function runOpenModelLoop(chatId: string, history: Anthropic.MessageParam[], userContent: string): Promise<{ text: string; label: string }> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map((m): ChatMessage => ({ role: m.role, content: typeof m.content === 'string' ? m.content : '' })),
    { role: 'user', content: userContent },
  ];
  let model: OpenModel | null = null;
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const completion = await openModelCompletion(messages, OPEN_TOOLS, model);
    model = completion.model;
    if (completion.toolCalls.length === 0) return { text: completion.content.trim(), label: model.label };

    messages.push({ role: 'assistant', content: completion.content || null, tool_calls: completion.toolCalls });
    const calls = completion.toolCalls.map((c) => {
      let input: ToolInput = {};
      try {
        const parsed = JSON.parse(c.function.arguments || '{}');
        if (parsed && typeof parsed === 'object') input = parsed;
      } catch {
        // arguments illisibles : l'outil répondra avec ses valeurs par défaut ou une erreur claire
      }
      return { id: c.id, name: c.function.name, input };
    });
    for (const r of await executeTools(chatId, calls)) messages.push({ role: 'tool', tool_call_id: r.id, content: r.content });
  }
  return { text: TOO_MANY_STEPS, label: model?.label || 'modèle open source' };
}

function claudeErrorMessage(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return '❌ Clé ANTHROPIC_API_KEY refusée : vérifiez-la dans Vercel.';
  if (err instanceof Anthropic.RateLimitError) return '⏳ Trop de demandes à Claude en ce moment, réessayez dans une minute.';
  if (err instanceof Anthropic.APIError && err.status === 400 && /credit|billing/i.test(err.message)) {
    return '❌ Crédit API Anthropic épuisé : rechargez-le sur console.anthropic.com.';
  }
  return '❌ Claude est momentanément indisponible. Les boutons du menu restent utilisables, réessayez dans un instant.';
}

export function isAssistantAvailable(): boolean {
  return isClaudeConfigured() || isOpenModelAvailable();
}

/**
 * Répond à un message du super admin (outils + confirmation des actions).
 * Claude d'abord ; s'il ne peut pas répondre (pas de clé, pas de crédit, panne) avant d'avoir
 * exécuté un outil, relais automatique sur les modèles open source configurés.
 * `deliver: false` : la réponse est seulement renvoyée (test depuis le back-office), pas envoyée sur Telegram.
 */
export async function runAssistant(
  chatId: string,
  userText: string,
  opts: { deliver?: boolean } = {}
): Promise<{ text: string; model: string; ok: boolean }> {
  const deliver = opts.deliver !== false;
  if (deliver) await sendTyping(chatId);
  const history = await loadHistory(chatId);
  await query(`INSERT INTO conversation_messages (chat_id, role, content) VALUES ($1, 'user', $2)`, [chatId, userText]);

  const now = new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Abidjan', dateStyle: 'full', timeStyle: 'short' });
  const userContent = `[${now}]\n${userText}`;

  let text = '';
  let model = CLAUDE_MODEL;
  let ok = false;
  let claudeError: unknown = null;

  if (isClaudeConfigured()) {
    try {
      text = await runClaudeLoop(chatId, history, userContent, deliver);
      ok = true;
    } catch (err) {
      const e = err as AssistantError;
      console.error('Claude assistant error:', e.cause);
      claudeError = e.cause;
      // Des outils ont déjà tourné (ex. boutons d'action envoyés) : pas de relais pour éviter les doublons
      if (e.toolsRan) text = claudeErrorMessage(e.cause);
    }
  }

  if (!ok && !text && isOpenModelAvailable()) {
    try {
      const result = await runOpenModelLoop(chatId, history, userContent);
      text = result.text ? `${result.text}\n\n<i>— ${result.label}${isClaudeConfigured() ? ', en relais de Claude' : ''}</i>` : '';
      model = result.label;
      ok = Boolean(result.text);
    } catch (err) {
      console.error('Open model assistant error:', err);
    }
  }

  if (!text) {
    text = claudeError
      ? claudeErrorMessage(claudeError)
      : '❌ Aucun modèle d’IA ne répond pour le moment. Les boutons du menu restent utilisables, réessayez dans un instant.';
  }

  await query(`INSERT INTO conversation_messages (chat_id, role, content, metadata) VALUES ($1, 'assistant', $2, $3)`, [
    chatId,
    text,
    JSON.stringify({ model }),
  ]);
  if (deliver) await sendBotMessage(chatId, toTelegramHtml(text));
  return { text, model, ok };
}

export const HELP_TEXT = `🤖 <b>Assistant OptiSpace</b>

Écrivez ou dictez (message vocal) ce que vous voulez savoir ou faire, par exemple :
• « Quelles demandes de licence sont en attente ? »
• « Donne-moi la fiche de Boris Wifi »
• « Combien a-t-on encaissé cette semaine, par point de vente ? »
• « Qui expire ce mois-ci ? »
• « Approuve la demande de Boris Wifi pour 3 mois »
• « Suspends l'espace Test Org »

Les actions (approuver, refuser, activer, suspendre…) demandent toujours votre confirmation par un bouton.

Commandes : /menu · /effacer (oublier la conversation) · /aide`;
