import { env } from 'process';

const BOT_TOKEN = env.TELEGRAM_BOT_TOKEN;
const DEFAULT_CHAT_ID = env.TELEGRAM_CHAT_ID;
const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

interface TelegramMessage {
  chat_id?: string | number;
  text: string;
  parse_mode?: 'HTML' | 'MarkdownV2';
  disable_web_page_preview?: boolean;
  reply_markup?: any;
}

export async function sendTelegramMessage(message: TelegramMessage): Promise<boolean> {
  if (!BOT_TOKEN) {
    console.warn('Telegram not configured: missing TELEGRAM_BOT_TOKEN');
    return false;
  }

  const chatId = message.chat_id || DEFAULT_CHAT_ID;
  if (!chatId) {
    console.warn('Telegram not configured: missing TELEGRAM_CHAT_ID');
    return false;
  }

  try {
    const response = await fetch(`${API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        ...message,
        disable_web_page_preview: true,
      }),
    });

    const data = await response.json();
    if (!data.ok) {
      console.error('Telegram API error:', data.description);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Failed to send Telegram message:', error);
    return false;
  }
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
    chat_id: CHAT_ID!,
    text: formatBuildNotification(data),
    parse_mode: 'HTML',
  });
}

export async function notifyDatabaseAlert(data: Parameters<typeof formatDatabaseAlert>[0]) {
  return sendTelegramMessage({
    chat_id: CHAT_ID!,
    text: formatDatabaseAlert(data),
    parse_mode: 'HTML',
  });
}

export async function notifyError(data: Parameters<typeof formatErrorNotification>[0]) {
  return sendTelegramMessage({
    chat_id: CHAT_ID!,
    text: formatErrorNotification(data),
    parse_mode: 'HTML',
  });
}

export async function notifyCustom(data: Parameters<typeof formatCustomNotification>[0]) {
  return sendTelegramMessage({
    chat_id: CHAT_ID!,
    text: formatCustomNotification(data),
    parse_mode: 'HTML',
  });
}

export function testTelegramConnection(): Promise<boolean> {
  return sendTelegramMessage({
    chat_id: CHAT_ID!,
    text: '🤖 <b>Test de connexion OptiWifi</b>\n\nBot Telegram configuré avec succès !',
    parse_mode: 'HTML',
  });
}