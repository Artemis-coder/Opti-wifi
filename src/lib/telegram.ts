interface TelegramMessage {
  chat_id?: string | number;
  text: string;
  parse_mode?: 'HTML' | 'MarkdownV2';
  disable_web_page_preview?: boolean;
  reply_markup?: Record<string, unknown>;
}

export interface TelegramSendResult {
  ok: boolean;
  /** Raison lisible de l'échec (jamais le token). */
  error?: string;
}

const TIMEOUT_MS = 8000;

function apiUrl(method: string): string | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  return token ? `https://api.telegram.org/bot${token}/${method}` : null;
}

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_CHAT_ID?.trim());
}

/** Envoi avec délai maximal et une nouvelle tentative (limite de débit Telegram ou erreur serveur). */
export async function sendTelegramMessageDetailed(message: TelegramMessage): Promise<TelegramSendResult> {
  const url = apiUrl('sendMessage');
  if (!url) return { ok: false, error: 'TELEGRAM_BOT_TOKEN manquant' };
  const chatId = message.chat_id || process.env.TELEGRAM_CHAT_ID?.trim();
  if (!chatId) return { ok: false, error: 'TELEGRAM_CHAT_ID manquant' };

  const body = JSON.stringify({ disable_web_page_preview: true, ...message, chat_id: chatId });
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const data = await response.json().catch(() => ({}));
      if (data.ok) return { ok: true };

      const retryAfter = Number(data.parameters?.retry_after) || 0;
      const retryable = response.status === 429 || response.status >= 500;
      if (attempt === 1 && retryable && retryAfter <= 5) {
        await new Promise((r) => setTimeout(r, Math.max(1, retryAfter) * 1000));
        continue;
      }
      const error = `${response.status} ${data.description || 'erreur Telegram'}`;
      console.error('Telegram API error:', error);
      return { ok: false, error };
    } catch (err) {
      if (attempt === 2) {
        const error = err instanceof Error && err.name === 'TimeoutError' ? 'délai dépassé' : 'réseau indisponible';
        console.error('Failed to send Telegram message:', error);
        return { ok: false, error };
      }
    }
  }
  return { ok: false, error: 'échec' };
}

export async function sendTelegramMessage(message: TelegramMessage): Promise<boolean> {
  return (await sendTelegramMessageDetailed(message)).ok;
}

/** Identité du bot (vérifie que le token est valide). */
export async function getTelegramBotInfo(): Promise<{ ok: boolean; username?: string; error?: string }> {
  const url = apiUrl('getMe');
  if (!url) return { ok: false, error: 'TELEGRAM_BOT_TOKEN manquant' };
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const data = await res.json().catch(() => ({}));
    return data.ok ? { ok: true, username: data.result?.username } : { ok: false, error: `${res.status} ${data.description || 'token refusé'}` };
  } catch {
    return { ok: false, error: 'réseau indisponible' };
  }
}

export function escapeTelegramHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function formatBuildNotification(data: {
  project: string;
  status: 'success' | 'failed' | 'building';
  url: string;
  commit?: string;
  branch?: string;
}): string {
  const emoji = data.status === 'success' ? '✅' : data.status === 'failed' ? '❌' : '🔄';
  const statusText = data.status === 'success' ? 'Réussi' : data.status === 'failed' ? 'Échoué' : 'En cours';

  let text = `${emoji} <b>Build ${statusText}</b>\n\n`;
  text += `📦 <b>Projet:</b> ${data.project}\n`;
  if (data.branch) text += `🌿 <b>Branche:</b> ${data.branch}\n`;
  if (data.commit) text += `📝 <b>Commit:</b> <code>${data.commit.substring(0, 7)}</code>\n`;
  text += `🔗 <a href="${data.url}">Voir sur Vercel</a>`;

  return text;
}

export function formatDatabaseAlert(data: {
  type: 'connection' | 'slow_query' | 'high_load' | 'error';
  database: string;
  message: string;
  details?: Record<string, unknown>;
}): string {
  const emojiMap = {
    connection: '🔌',
    slow_query: '🐌',
    high_load: '📈',
    error: '💥',
  };

  let text = `${emojiMap[data.type]} <b>Alerte Base de Données</b>\n\n`;
  text += `🗄️ <b>Base:</b> ${data.database}\n`;
  text += `📋 <b>Type:</b> ${data.type}\n`;
  text += `💬 <b>Message:</b> ${data.message}\n`;

  if (data.details) {
    text += `\n📊 <b>Détails:</b>\n`;
    for (const [key, value] of Object.entries(data.details)) {
      text += `  • ${key}: <code>${JSON.stringify(value)}</code>\n`;
    }
  }

  return text;
}

export function formatErrorNotification(data: {
  source: string;
  error: string;
  stack?: string;
  context?: Record<string, unknown>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}): string {
  const emojiMap = {
    low: '⚠️',
    medium: '🟠',
    high: '🔴',
    critical: '🚨',
  };

  let text = `${emojiMap[data.severity]} <b>Erreur ${data.severity.toUpperCase()}</b>\n\n`;
  text += `📍 <b>Source:</b> ${data.source}\n`;
  text += `💥 <b>Erreur:</b> <code>${data.error}</code>\n`;

  if (data.context) {
    text += `\n📋 <b>Contexte:</b>\n`;
    for (const [key, value] of Object.entries(data.context)) {
      text += `  • ${key}: <code>${JSON.stringify(value)}</code>\n`;
    }
  }

  if (data.stack) {
    text += `\n📜 <b>Stack:</b>\n<code>${data.stack.substring(0, 500)}</code>`;
  }

  return text;
}

export function formatCustomNotification(data: {
  title: string;
  message: string;
  emoji?: string;
  fields?: Record<string, string | number>;
  url?: string;
  urlText?: string;
}): string {
  let text = `${data.emoji || '📢'} <b>${data.title}</b>\n\n`;
  text += `${data.message}\n`;

  if (data.fields) {
    text += '\n';
    for (const [key, value] of Object.entries(data.fields)) {
      text += `  • <b>${key}:</b> <code>${value}</code>\n`;
    }
  }

  if (data.url && data.urlText) {
    text += `\n🔗 <a href="${data.url}">${data.urlText}</a>`;
  }

  return text;
}

export async function notifyBuild(data: Parameters<typeof formatBuildNotification>[0]) {
  return sendTelegramMessage({
        text: formatBuildNotification(data),
    parse_mode: 'HTML',
  });
}

export async function notifyDatabaseAlert(data: Parameters<typeof formatDatabaseAlert>[0]) {
  return sendTelegramMessage({
        text: formatDatabaseAlert(data),
    parse_mode: 'HTML',
  });
}

export async function notifyError(data: Parameters<typeof formatErrorNotification>[0]) {
  return sendTelegramMessage({
        text: formatErrorNotification(data),
    parse_mode: 'HTML',
  });
}

export async function notifyCustom(data: Parameters<typeof formatCustomNotification>[0]) {
  return sendTelegramMessage({
        text: formatCustomNotification(data),
    parse_mode: 'HTML',
  });
}

export function testTelegramConnection(): Promise<boolean> {
  return sendTelegramMessage({
        text: '🤖 <b>Test de connexion OptiWifi</b>\n\nBot Telegram configuré avec succès !',
    parse_mode: 'HTML',
  });
}
/** Notification typée (build, base de données, erreur, message libre). */
export async function sendTelegramNotificationByType(type: string, data: Record<string, unknown>): Promise<boolean> {
  switch (type) {
    case 'build':
      return notifyBuild(data as Parameters<typeof notifyBuild>[0]);
    case 'database':
      return notifyDatabaseAlert(data as Parameters<typeof notifyDatabaseAlert>[0]);
    case 'error':
      return notifyError(data as Parameters<typeof notifyError>[0]);
    case 'custom':
      return notifyCustom(data as Parameters<typeof notifyCustom>[0]);
    default:
      return false;
  }
}
