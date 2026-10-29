// ============================================================
// OPTIWIFI - Santé du bot Telegram, vérifiée par le serveur lui-même.
// Les clés restent dans les variables d'environnement du déploiement : le diagnostic ne
// renvoie que des statuts et des messages, jamais une clé ni un extrait de clé.
// ============================================================

export type HealthStatus = 'ok' | 'warning' | 'error' | 'missing';

export interface HealthCheck {
  id: string;
  label: string;
  status: HealthStatus;
  message: string;
}

const TIMEOUT_MS = 8000;
export const WEBHOOK_PATH = '/api/telegram/ai-webhook-v2';

async function call(url: string, init?: RequestInit): Promise<{ status: number; json: Record<string, unknown> | null }> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { status: res.status, json };
}

const env = (name: string) => process.env[name]?.trim() || '';

function networkError(label: string, id: string, err: unknown): HealthCheck {
  const timeout = err instanceof Error && err.name === 'TimeoutError';
  return { id, label, status: 'error', message: timeout ? 'Pas de réponse (délai dépassé)' : 'Service injoignable' };
}

async function checkTelegram(expectedWebhookUrl: string): Promise<HealthCheck[]> {
  const token = env('TELEGRAM_BOT_TOKEN');
  const checks: HealthCheck[] = [];
  if (!token) {
    return [{ id: 'telegram', label: 'Bot Telegram', status: 'missing', message: 'TELEGRAM_BOT_TOKEN non configuré sur ce déploiement' }];
  }
  try {
    const me = await call(`https://api.telegram.org/bot${token}/getMe`);
    const ok = me.status === 200 && me.json?.ok === true;
    const username = ok ? (me.json?.result as { username?: string })?.username : null;
    checks.push({
      id: 'telegram',
      label: 'Bot Telegram',
      status: ok ? 'ok' : 'error',
      message: ok ? `Connecté : @${username}` : 'Jeton refusé par Telegram : régénérez-le avec @BotFather',
    });
    if (!ok) return checks;
  } catch (err) {
    return [networkError('Bot Telegram', 'telegram', err)];
  }

  checks.push({
    id: 'telegram_secret',
    label: 'Secret du webhook',
    status: env('TELEGRAM_WEBHOOK_SECRET') ? 'ok' : 'missing',
    message: env('TELEGRAM_WEBHOOK_SECRET')
      ? 'Configuré (le webhook refuse les appels sans ce secret)'
      : 'TELEGRAM_WEBHOOK_SECRET manquant : le webhook refuse tous les messages',
  });
  checks.push({
    id: 'telegram_chat',
    label: 'Chat autorisé',
    status: env('TELEGRAM_CHAT_ID') ? 'ok' : 'missing',
    message: env('TELEGRAM_CHAT_ID') ? 'Configuré' : 'TELEGRAM_CHAT_ID manquant : personne ne peut utiliser le bot',
  });

  try {
    const info = await call(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const r = (info.json?.result || {}) as { url?: string; pending_update_count?: number; last_error_message?: string; last_error_date?: number };
    const recentError = r.last_error_date && Date.now() / 1000 - r.last_error_date < 24 * 3600 ? r.last_error_message : null;
    let status: HealthStatus = 'ok';
    let message = `Enregistré${r.pending_update_count ? ` · ${r.pending_update_count} message(s) en attente` : ''}`;
    if (!r.url) {
      status = 'error';
      message = "Aucun webhook enregistré : le bot ne reçoit pas les messages. Utilisez « Réenregistrer le webhook ».";
    } else if (r.url !== expectedWebhookUrl) {
      // Hors production (local, preview), le webhook doit rester sur le site de production
      const isProduction = process.env.VERCEL_ENV === 'production';
      status = isProduction ? 'warning' : 'ok';
      message = isProduction
        ? `Pointe vers une autre adresse (${new URL(r.url).host}). Réenregistrez-le pour ce site.`
        : `Pointe vers ${new URL(r.url).host} : normal, ce diagnostic tourne hors production`;
    } else if (recentError) {
      status = 'error';
      message = /401|403/.test(recentError)
        ? 'Telegram est refusé par le site (secret différent) : réenregistrez le webhook.'
        : `Dernière erreur de Telegram : ${recentError}`;
    }
    checks.push({ id: 'telegram_webhook', label: 'Webhook Telegram', status, message });
  } catch (err) {
    checks.push(networkError('Webhook Telegram', 'telegram_webhook', err));
  }
  return checks;
}

async function checkAnthropic(): Promise<HealthCheck> {
  const label = 'Claude (Anthropic)';
  const key = env('ANTHROPIC_API_KEY');
  if (!key) return { id: 'anthropic', label, status: 'missing', message: 'ANTHROPIC_API_KEY non configurée (le bot passe par les modèles open source)' };
  try {
    // Message d'un seul jeton : seul moyen de détecter un crédit épuisé (coût négligeable)
    const r = await call('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 1, messages: [{ role: 'user', content: 'ok' }] }),
    });
    if (r.status === 200) return { id: 'anthropic', label, status: 'ok', message: 'Clé valide, crédit disponible' };
    const msg = String((r.json?.error as { message?: string })?.message || '');
    if (r.status === 401) return { id: 'anthropic', label, status: 'error', message: 'Clé refusée : remplacez ANTHROPIC_API_KEY' };
    if (/credit|billing/i.test(msg)) return { id: 'anthropic', label, status: 'warning', message: 'Crédit épuisé : rechargez-le sur console.anthropic.com (relais open source actif)' };
    if (r.status === 429) return { id: 'anthropic', label, status: 'warning', message: 'Limite de requêtes atteinte, réessayez plus tard' };
    return { id: 'anthropic', label, status: 'error', message: `Réponse inattendue (${r.status})` };
  } catch (err) {
    return networkError(label, 'anthropic', err);
  }
}

async function checkOpenProvider(id: string, label: string, keyName: string, url: string): Promise<HealthCheck> {
  const key = env(keyName);
  if (!key) return { id, label, status: 'missing', message: `${keyName} non configurée` };
  try {
    const r = await call(url, { headers: { Authorization: `Bearer ${key}` } });
    if (r.status === 200) return { id, label, status: 'ok', message: 'Clé valide' };
    if (r.status === 401 || r.status === 403) return { id, label, status: 'error', message: `Clé refusée : remplacez ${keyName}` };
    if (r.status === 429) return { id, label, status: 'warning', message: 'Quota atteint, réessayez plus tard' };
    return { id, label, status: 'error', message: `Réponse inattendue (${r.status})` };
  } catch (err) {
    return networkError(label, id, err);
  }
}

async function checkVercel(): Promise<HealthCheck> {
  const label = 'Jeton Vercel (statut technique)';
  const key = env('VERCEL_TOKEN');
  if (!key) return { id: 'vercel', label, status: 'missing', message: 'VERCEL_TOKEN non configuré : le bot n’affiche pas les déploiements' };
  try {
    const r = await call('https://api.vercel.com/v2/user', { headers: { Authorization: `Bearer ${key}` } });
    if (r.status === 200) return { id: 'vercel', label, status: 'ok', message: 'Jeton valide' };
    return {
      id: 'vercel',
      label,
      status: 'error',
      message: 'Jeton refusé (expiré ou révoqué) : créez-en un sur vercel.com/account/tokens et remplacez VERCEL_TOKEN',
    };
  } catch (err) {
    return networkError(label, 'vercel', err);
  }
}

/** Diagnostic complet, exécuté sur le déploiement (les clés ne quittent pas le serveur). */
export async function runBotHealth(siteOrigin: string): Promise<HealthCheck[]> {
  const [telegram, anthropic, groq, openrouter, together, vercel] = await Promise.all([
    checkTelegram(`${siteOrigin}${WEBHOOK_PATH}`),
    checkAnthropic(),
    checkOpenProvider('groq', 'Groq (relais open source)', 'GROQ_API_KEY', 'https://api.groq.com/openai/v1/models'),
    checkOpenProvider('openrouter', 'OpenRouter (relais open source)', 'OPENROUTER_API_KEY', 'https://openrouter.ai/api/v1/auth/key'),
    checkOpenProvider('together', 'Together (relais open source)', 'TOGETHER_API_KEY', 'https://api.together.xyz/v1/models'),
    checkVercel(),
  ]);
  return [...telegram, anthropic, groq, openrouter, together, vercel];
}

/**
 * Enregistre le webhook auprès de Telegram avec le secret du déploiement. Le secret est transmis
 * directement du serveur à Telegram : il n'est jamais affiché ni renvoyé au navigateur.
 */
export async function registerTelegramWebhook(siteOrigin: string): Promise<{ ok: boolean; message: string }> {
  const token = env('TELEGRAM_BOT_TOKEN');
  const secret = env('TELEGRAM_WEBHOOK_SECRET');
  if (!token || !secret) return { ok: false, message: 'TELEGRAM_BOT_TOKEN et TELEGRAM_WEBHOOK_SECRET doivent être configurés.' };
  // Uniquement depuis la production : un clic en preview ne doit jamais détourner le bot de production
  if (process.env.VERCEL_ENV !== 'production') return { ok: false, message: 'Réservé au site de production.' };
  if (!/^https:\/\//.test(siteOrigin)) return { ok: false, message: 'Le webhook doit pointer vers une adresse https.' };
  const r = await call(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      url: `${siteOrigin}${WEBHOOK_PATH}`,
      secret_token: secret,
      allowed_updates: ['message', 'callback_query'],
    }),
  });
  return r.json?.ok === true
    ? { ok: true, message: `Webhook enregistré sur ${new URL(siteOrigin).host}` }
    : { ok: false, message: `Telegram a refusé l'enregistrement : ${String(r.json?.description || r.status)}` };
}
