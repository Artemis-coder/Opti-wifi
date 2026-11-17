// ============================================================
// OPTIWIFI - Menu Telegram « 🤖 IA — Claude Code » : demandes de développement confiées à la
// routine Claude Code (cloud), plan à valider, développement, intégration dans develop et mise en
// production, toujours sur validation du propriétaire.
// ============================================================
import { updateSessionContext } from '@/lib/conversation-memory';
import { escapeTelegramHtml } from '@/lib/telegram';
import { ADMIN_MENU, HOME_MENU, sendBotMessage, toTelegramHtml } from '@/lib/bot/assistant';
import { fireDevRoutine, isDevRoutineConfigured, type RoutineAction } from '@/lib/claude-routine';
import {
  appendFeedback,
  createDevRequest,
  DEV_STATUS_LABEL,
  getDevRequest,
  listDevRequests,
  OPEN_STATUSES,
  updateDevRequest,
  WAITING_OWNER,
  type DevRequest,
} from '@/lib/dev-requests';
import {
  compareBranches,
  GitHubError,
  isGitHubConfigured,
  mergePullRequest,
  openPullRequest,
  REPO_URL,
} from '@/lib/github';

export const AI_BUTTON = '🤖 IA — Claude Code';
const BTN_NEW = '✍️ Nouvelle demande';
const BTN_OPEN = '⏳ En cours';
const BTN_WAITING = '✅ À valider';
const BTN_HISTORY = '🗂️ Historique';
const BTN_PROD = '🚀 Mise en production';
const BTN_CANCEL = '❌ Annuler la saisie';

export const AI_MENU = {
  reply_markup: {
    keyboard: [
      [{ text: BTN_NEW }],
      [{ text: BTN_OPEN }, { text: BTN_WAITING }],
      [{ text: BTN_HISTORY }, { text: BTN_PROD }],
      [{ text: '🔙 Menu Principal' }],
    ],
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: 'Décrivez une fonctionnalité ou une correction…',
  },
};

function isMenuButton(text: string): boolean {
  return [AI_MENU, HOME_MENU, ADMIN_MENU].some((m) => m.reply_markup.keyboard.some((row) => row.some((b) => b.text === text)));
}

const CANCEL_MENU = { reply_markup: { keyboard: [[{ text: BTN_CANCEL }]], resize_keyboard: true } };

const e = escapeTelegramHtml;
const send = (chatId: string, html: string, markup: Record<string, unknown> = AI_MENU.reply_markup) => sendBotMessage(chatId, html, markup);

type Button = { text: string; callback_data?: string; url?: string };

function prUrl(n: number) {
  return `${REPO_URL}/pull/${n}`;
}

/** Fiche d'une demande + boutons selon son statut. */
function card(r: DevRequest, opts: { full?: boolean } = {}): { html: string; markup: Record<string, unknown> } {
  const lines = [`<b>Demande #${r.id}</b> · ${DEV_STATUS_LABEL[r.status]}`, `<i>${e(r.title)}</i>`];
  if (r.status === 'plan_ready' && r.plan) lines.push('', '<b>📋 Plan proposé par Claude</b>', toTelegramHtml(r.plan.slice(0, opts.full ? 9000 : 3000)));
  if ((r.status === 'review' || r.status === 'integrated' || r.status === 'in_production') && r.summary) {
    lines.push('', '<b>🧾 Récapitulatif</b>', toTelegramHtml(r.summary.slice(0, opts.full ? 9000 : 3000)));
  }
  if (r.status === 'failed' && r.summary) lines.push('', `⚠️ ${toTelegramHtml(r.summary.slice(0, 1500))}`);

  const rows: Button[][] = [];
  if (r.status === 'plan_ready') {
    rows.push([{ text: '✅ Valider le plan', callback_data: `dev:approve:${r.id}` }]);
    rows.push([
      { text: '✏️ Modifier', callback_data: `dev:edit:${r.id}` },
      { text: '❌ Abandonner', callback_data: `dev:abandon:${r.id}` },
    ]);
  } else if (r.status === 'review') {
    if (r.pr_number) rows.push([{ text: '🔍 Voir la PR et la préproduction', url: prUrl(r.pr_number) }]);
    rows.push([{ text: '✅ Intégrer dans develop', callback_data: `dev:merge:${r.id}` }]);
    rows.push([
      { text: '✏️ Corriger', callback_data: `dev:edit:${r.id}` },
      { text: '❌ Abandonner', callback_data: `dev:abandon:${r.id}` },
    ]);
  } else if (r.status === 'integrated') {
    rows.push([{ text: '🚀 Mettre en production', callback_data: 'dev:prod:0' }]);
  } else if (r.status === 'failed') {
    rows.push([
      { text: '🔄 Relancer', callback_data: `dev:retry:${r.id}` },
      { text: '✏️ Préciser', callback_data: `dev:edit:${r.id}` },
    ]);
  }
  if (r.session_url?.startsWith('https://claude.ai/')) rows.push([{ text: '👀 Suivre Claude en direct', url: r.session_url }]);
  return { html: lines.join('\n'), markup: rows.length ? { inline_keyboard: rows } : AI_MENU.reply_markup };
}

export async function sendDevCard(chatId: string, r: DevRequest, header?: string) {
  const { html, markup } = card(r);
  await send(chatId, `${header ? `${header}\n\n` : ''}${html}`, markup);
}

/** Réveille la routine et mémorise la session ; prévient le propriétaire si l'appel échoue. */
async function wake(chatId: string, r: DevRequest, action: RoutineAction): Promise<boolean> {
  const res = await fireDevRoutine(r.id, action);
  if (res.ok) {
    if (res.sessionUrl) await updateDevRequest(r.id, { session_url: res.sessionUrl });
    return true;
  }
  await send(chatId, `⚠️ Claude n’a pas pu être réveillé pour la demande #${r.id} : ${e(res.error || 'erreur inconnue')}.\nLa demande est enregistrée : utilisez « 🔄 Relancer » quand ce sera réglé.`);
  await updateDevRequest(r.id, { status: 'failed', summary: `Réveil de Claude impossible : ${res.error}` });
  return false;
}

function listLine(r: DevRequest) {
  const date = new Date(r.updated_at).toLocaleString('fr-FR', { timeZone: 'Africa/Abidjan', dateStyle: 'short', timeStyle: 'short' });
  return `• <b>#${r.id}</b> ${e(r.title.slice(0, 60))}\n   ${DEV_STATUS_LABEL[r.status]} · ${date}${r.pr_number ? ` · <a href="${prUrl(r.pr_number)}">PR #${r.pr_number}</a>` : ''}`;
}

/** Messages saisis pendant une demande ou une correction. Renvoie true si traité. */
export async function handleDevContext(text: string, chatId: string, context: string | null | undefined): Promise<boolean> {
  if (!context || !(context === 'dev_new' || context.startsWith('dev_feedback:'))) return false;
  if (text === BTN_CANCEL || text === '🔙 Menu Principal' || text === '/menu') {
    await updateSessionContext(chatId, 'general');
    await send(chatId, 'Saisie annulée.');
    return true;
  }
  // Un bouton de menu pendant la saisie : on abandonne la saisie et le bouton est traité normalement
  if (text.startsWith('/') || text.length < 3 || isMenuButton(text)) {
    await updateSessionContext(chatId, 'general');
    return false;
  }
  await updateSessionContext(chatId, 'general');

  if (context === 'dev_new') {
    await submitDevRequest(chatId, text);
    return true;
  }

  const result = await submitDevFeedback(chatId, Number(context.split(':')[1]), text);
  if (!result.ok) await send(chatId, result.error);
  return true;
}

/** Nouvelle demande confiée à Claude (chat ou Mini App) : enregistrée puis Claude réveillé. */
export async function submitDevRequest(chatId: string, text: string): Promise<DevRequest> {
  const r = await createDevRequest(text);
  await send(chatId, `📨 <b>Demande #${r.id} enregistrée.</b>\nClaude étudie le code et vous envoie un plan de développement à valider (quelques minutes).`);
  await wake(chatId, r, 'plan');
  return r;
}

/** Remarque sur un plan ou correction d'un développement (chat ou Mini App). */
export async function submitDevFeedback(chatId: string, id: number, text: string): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const r = await getDevRequest(id);
  if (!r || !['plan_ready', 'review', 'failed'].includes(r.status)) return { ok: false, error: 'Cette demande n’attend plus de remarque.' };
  await appendFeedback(id, text);
  // Remarque sur un plan (ou une demande bloquée sans développement) : nouveau plan ; sinon correction du développement
  const replan = r.status === 'plan_ready' || (r.status === 'failed' && !r.branch);
  const updated = await updateDevRequest(id, { status: replan ? 'planning' : 'developing' });
  const message = replan ? `Remarque transmise. Claude revoit le plan de la demande #${id}.` : `Correction transmise. Claude reprend le développement de la demande #${id}.`;
  await send(chatId, `✏️ ${message}`);
  if (updated) await wake(chatId, updated, replan ? 'plan' : 'develop');
  return { ok: true, message };
}

/** État de la mise en production : commits de develop qui partiraient en production. */
export async function productionPreview(): Promise<{ configured: boolean; aheadBy: number; commits: string[] }> {
  if (!isGitHubConfigured()) return { configured: false, aheadBy: 0, commits: [] };
  const diff = await compareBranches('main', 'develop');
  const commits = diff.commits
    .map((c) => c.commit.message.split('\n')[0])
    .filter((m) => !m.startsWith('Merge '))
    .slice(-30)
    .reverse();
  return { configured: true, aheadBy: diff.ahead_by, commits };
}

export function devConfiguration() {
  return { routine: isDevRoutineConfigured(), github: isGitHubConfigured(), repoUrl: REPO_URL };
}

/** Boutons du menu IA. Renvoie true si traité. */
export async function handleDevButton(text: string, chatId: string): Promise<boolean> {
  if (text === AI_BUTTON || text === '/ia') {
    const warnings = [
      isDevRoutineConfigured() ? null : '⚠️ Routine Claude non configurée : les demandes seront enregistrées mais Claude ne sera pas réveillé.',
      isGitHubConfigured() ? null : '⚠️ Accès GitHub non configuré : pas d’ouverture ni de fusion de PR depuis Telegram.',
    ].filter(Boolean);
    await send(
      chatId,
      [
        '🤖 <b>IA — Claude Code</b>',
        '',
        'Confiez une fonctionnalité ou une correction à Claude : il propose un plan, le développe après votre accord, puis vous le soumet. Rien n’est intégré ni mis en production sans votre validation.',
        ...(warnings.length ? ['', ...warnings] : []),
      ].join('\n'),
    );
    return true;
  }
  if (text === BTN_NEW) {
    await updateSessionContext(chatId, 'dev_new');
    await send(chatId, '✍️ Décrivez ce que vous voulez, par écrit ou en message vocal : la fonctionnalité, à qui elle sert, et ce qui compte pour vous.', CANCEL_MENU.reply_markup);
    return true;
  }
  if (text === BTN_OPEN || text === BTN_HISTORY) {
    const list = await listDevRequests(text === BTN_OPEN ? OPEN_STATUSES : null, 10);
    await send(
      chatId,
      list.length
        ? `${text === BTN_OPEN ? '⏳ <b>Demandes en cours</b>' : '🗂️ <b>Dernières demandes</b>'}\n\n${list.map(listLine).join('\n')}`
        : text === BTN_OPEN ? '⏳ Aucune demande en cours.' : '🗂️ Aucune demande pour l’instant.',
    );
    return true;
  }
  if (text === BTN_WAITING) {
    const list = await listDevRequests(WAITING_OWNER, 5);
    if (!list.length) {
      await send(chatId, '✅ Rien à valider pour le moment.');
      return true;
    }
    await send(chatId, `✅ <b>${list.length} demande(s) attendent votre validation</b>`);
    for (const r of list) await sendDevCard(chatId, r);
    return true;
  }
  if (text === BTN_PROD) {
    await showProductionPreview(chatId);
    return true;
  }
  return false;
}

async function showProductionPreview(chatId: string) {
  if (!isGitHubConfigured()) {
    await send(chatId, `⚠️ Accès GitHub non configuré. Ouvrez la PR à la main : ${REPO_URL}/compare/main...develop?expand=1`);
    return;
  }
  const diff = await compareBranches('main', 'develop');
  if (diff.ahead_by === 0) {
    await send(chatId, '🚀 La production est déjà à jour : rien à mettre en production.');
    return;
  }
  const commits = diff.commits
    .map((c) => c.commit.message.split('\n')[0])
    .filter((m) => !m.startsWith('Merge '))
    .slice(-15)
    .map((m) => `• ${e(m.slice(0, 110))}`);
  await send(
    chatId,
    [
      `🚀 <b>Mise en production</b> : ${diff.ahead_by} commit(s) de <code>develop</code> partiront en production.`,
      '',
      ...commits,
      '',
      'Vérifiez d’abord la préproduction (https://dev.optiwifi.site). En cas de problème après coup : Instant Rollback sur Vercel.',
    ].join('\n'),
    {
      inline_keyboard: [
        [{ text: '🧪 Ouvrir la préproduction', url: 'https://dev.optiwifi.site' }],
        [{ text: '✅ Confirmer la mise en production', callback_data: 'dev:prodok:0' }],
        [{ text: '❌ Annuler', callback_data: 'dev:cancel:0' }],
      ],
    },
  );
}

function githubReason(err: unknown): string {
  if (err instanceof GitHubError) {
    if (err.status === 405 || err.status === 409) return `GitHub refuse la fusion (conflit ou vérifications en échec) : ${err.message}`;
    if (err.status === 401 || err.status === 403) return 'jeton GitHub refusé ou sans les droits nécessaires';
    return err.message;
  }
  return 'erreur inattendue';
}

/** Boutons sous une fiche : dev:<action>:<id>. */
export async function handleDevCallback(action: string, idParam: string, chatId: string): Promise<void> {
  const id = Number(idParam);

  if (action === 'prod') return showProductionPreview(chatId);
  if (action === 'cancel') return send(chatId, 'Mise en production annulée.');
  if (action === 'prodok') {
    if (!isGitHubConfigured()) return send(chatId, '⚠️ Accès GitHub non configuré.');
    try {
      const diff = await compareBranches('main', 'develop');
      if (diff.ahead_by === 0) return send(chatId, '🚀 La production est déjà à jour.');
      const pr = await openPullRequest('develop', 'main', 'Mise en production (validée depuis Telegram)', 'Mise en production validée par le propriétaire depuis le bot Telegram.\n\n🤖 OptiSpace');
      await mergePullRequest(pr.number, `Merge pull request #${pr.number} from develop (validée depuis Telegram)`);
      const integrated = await listDevRequests(['integrated'], 50);
      for (const r of integrated) await updateDevRequest(r.id, { status: 'in_production' });
      await send(chatId, `🚀 <b>Mise en production lancée</b> (<a href="${prUrl(pr.number)}">PR #${pr.number}</a> fusionnée). Vercel déploie en 1 à 2 minutes.\nClaude prépare les notes de version ; la release vous sera confirmée ici.`);
      const res = await fireDevRoutine(null, 'release');
      if (!res.ok) await send(chatId, `⚠️ Notes de version non lancées : ${e(res.error || '')}. Créez la release à la main.`);
    } catch (err) {
      await send(chatId, `❌ Mise en production impossible : ${e(githubReason(err))}`);
    }
    return;
  }

  const r = await getDevRequest(id);
  if (!r) return send(chatId, 'Demande introuvable.');

  if (action === 'view') return sendDevCard(chatId, r);

  if (action === 'approve') {
    if (r.status !== 'plan_ready') return send(chatId, `La demande #${id} n’attend plus de validation (${DEV_STATUS_LABEL[r.status]}).`);
    const updated = await updateDevRequest(id, { status: 'developing' });
    await send(chatId, `✅ Plan validé. Claude développe la demande #${id} et vous enverra le récapitulatif.`);
    if (updated) await wake(chatId, updated, 'develop');
    return;
  }
  if (action === 'retry') {
    if (r.status !== 'failed') return send(chatId, `La demande #${id} n’est pas bloquée.`);
    const replan = !r.branch;
    const updated = await updateDevRequest(id, { status: replan ? 'planning' : 'developing' });
    await send(chatId, `🔄 Claude reprend la demande #${id}.`);
    if (updated) await wake(chatId, updated, replan ? 'plan' : 'develop');
    return;
  }
  if (action === 'edit') {
    if (!['plan_ready', 'review', 'failed'].includes(r.status)) return send(chatId, `La demande #${id} n’attend pas de remarque.`);
    await updateSessionContext(chatId, `dev_feedback:${id}`);
    return send(chatId, `✏️ Écrivez ou dictez vos remarques pour la demande #${id}.`, CANCEL_MENU.reply_markup);
  }
  if (action === 'abandon') {
    if (['integrated', 'in_production', 'abandoned'].includes(r.status)) return send(chatId, `La demande #${id} ne peut plus être abandonnée.`);
    await updateDevRequest(id, { status: 'abandoned' });
    return send(chatId, `❌ Demande #${id} abandonnée.${r.pr_number ? ' La PR reste ouverte sur GitHub : fermez-la si besoin.' : ''}`);
  }
  if (action === 'merge') {
    if (r.status !== 'review' || !r.pr_number) return send(chatId, `La demande #${id} n’a pas de PR à intégrer.`);
    if (!isGitHubConfigured()) return send(chatId, `⚠️ Accès GitHub non configuré : fusionnez la PR à la main : ${prUrl(r.pr_number)}`);
    try {
      await mergePullRequest(r.pr_number, `Merge pull request #${r.pr_number} : demande #${id} (validée depuis Telegram)`);
      const updated = await updateDevRequest(id, { status: 'integrated' });
      if (updated) await sendDevCard(chatId, updated, `🧪 <b>Intégrée dans develop.</b> La préproduction (https://dev.optiwifi.site) se met à jour en 1 à 2 minutes.`);
    } catch (err) {
      await send(chatId, `❌ Intégration impossible : ${e(githubReason(err))}`);
    }
  }
}
