/**
 * Webhook du bot Telegram (super admin) : assistant OptiSpace.
 * Claude par défaut, modèles open source en relais, affichage direct des données sans IA.
 * Texte et notes vocales ; menus Business, IA (Claude Code), Paiement, Sécurité et Santé.
 */

import { NextRequest, NextResponse, after } from 'next/server';
import { isTelegramWebhookAuthorized } from '@/lib/telegram-auth';
import { reportSecurityEvent } from '@/lib/security-events';
import { handleHealthButton, handleSecurityButton, handleSecurityCallback } from '@/lib/telegram-health';
import { handleDevButton, handleDevCallback, handleDevContext } from '@/lib/telegram-dev';
import { handlePaymentButton, handlePaymentCallback } from '@/lib/telegram-payment';
import { collectionAnomalies, morningReport, riskClients, weeklyReport } from '@/lib/business-reports';
import { sendTelegramMessage } from '@/lib/telegram';
import { initConversationTables, getOrCreateSession, clearConversationHistory } from '@/lib/conversation-memory';
import {
  BUSINESS_BUTTON,
  HOME_MENU,
  HELP_TEXT,
  MENU_PROMPTS,
  handleActionCallback,
  runAssistant,
  sendBotMessage,
  sendTyping,
  setMiniAppMenuButton,
  toTelegramHtml,
} from '@/lib/bot/assistant';
import { MENU_VIEWS } from '@/lib/bot/fallback-views';
import { transcribeTelegramVoice } from '@/lib/bot/transcribe';
import { hydrateTelegramEnv } from '@/lib/integration-secrets';

type TelegramMessage = {
  chat: { id: number | string };
  from?: { first_name?: string; username?: string };
  text?: string;
  voice?: { file_id: string };
};

type TelegramCallbackQuery = {
  id: string;
  data?: string;
  message: { chat: { id: number | string }; message_id: number };
};

export async function POST(request: NextRequest) {
  // Jeton, secret et chat : interface du back-office, sinon variables Vercel
  await hydrateTelegramEnv();
  if (!isTelegramWebhookAuthorized(request)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }
  const update = await request.json().catch(() => null);
  if (!update) return NextResponse.json({ ok: true });

  // Réponse immédiate à Telegram (sinon il renvoie le message), traitement en arrière-plan
  after(async () => {
    try {
      await initConversationTables().catch((error) => console.warn('DB init warning:', error));
      if (update.message) await handleMessage(update.message);
      else if (update.callback_query) await handleCallbackQuery(update.callback_query);
    } catch (error) {
      console.error('Webhook error:', error);
    }
  });
  return NextResponse.json({ ok: true });
}

async function handleMessage(message: TelegramMessage) {
  const chatId = message.chat.id.toString();
  if (chatId !== process.env.TELEGRAM_CHAT_ID) {
    const userName = message.from?.first_name || 'Utilisateur';
    reportSecurityEvent({
      type: 'bot_stranger',
      identifier: `telegram:${chatId}`,
      detail: `${message.from?.username ? '@' + message.from.username + ' ' : ''}${userName} : ${String(message.text || '').slice(0, 200)}`,
    });
    await sendTelegramMessage({ chat_id: chatId, text: '❌ Non autorisé. Ce bot est privé.' });
    return;
  }

  let text = (message.text || '').trim();

  if (message.voice) {
    try {
      const transcript = await transcribeTelegramVoice(message.voice.file_id);
      if (!transcript) {
        await sendBotMessage(chatId, "🎙️ Je n'ai rien entendu dans ce message vocal.");
        return;
      }
      await sendBotMessage(chatId, `🎙️ <i>${toTelegramHtml(transcript)}</i>`);
      text = transcript;
    } catch (error) {
      console.error('Transcription error:', error);
      await sendBotMessage(chatId, '❌ La transcription a échoué. Réessayez ou écrivez votre message.');
      return;
    }
  }
  if (!text) return;

  // Saisie d'une demande ou d'une remarque pour Claude Code (menu IA), écrite ou dictée
  const session = await getOrCreateSession(chatId);
  if (await handleDevContext(text, chatId, session?.context)) return;

  const command = text.split(/\s+/)[0].toLowerCase().replace(/@.*$/, '');
  if (['/start', '/menu'].includes(command)) {
    await setMiniAppMenuButton(chatId);
    await sendBotMessage(chatId, `👋 Bonjour ! Que voulez-vous savoir ou faire ?\n\n${HELP_TEXT}`, HOME_MENU.reply_markup);
    return;
  }
  if (text === BUSINESS_BUTTON) {
    await sendBotMessage(chatId, '📊 <b>Business OptiSpace</b>\nChoisissez une rubrique ou posez votre question, par écrit ou en vocal.');
    return;
  }
  if (await handleDevButton(text, chatId)) return;
  if (['/aide', '/help'].includes(command) || text === '❓ Aide') {
    await sendBotMessage(chatId, HELP_TEXT);
    return;
  }
  if (['/effacer', '/clear'].includes(command)) {
    await clearConversationHistory(chatId);
    await sendBotMessage(chatId, '🧹 Conversation effacée : je repars de zéro.');
    return;
  }
  // Menus Paiement, Sécurité et Santé : réponses directes, sans passer par l'IA
  if (await handlePaymentButton(text, chatId)) return;
  if (await handleSecurityButton(text, chatId)) return;
  if (await handleHealthButton(text, chatId)) return;
  if (text === '🔙 Menu Principal') {
    await setMiniAppMenuButton(chatId);
    await sendBotMessage(chatId, '🏠 <b>Menu principal</b>', HOME_MENU.reply_markup);
    return;
  }
  // Rapports business à la demande (mêmes rapports que le cron du matin et du lundi)
  if (text === '🌅 Rapport du jour' || text === '📈 Bilan de la semaine') {
    await sendTyping(chatId);
    const daily = text === '🌅 Rapport du jour';
    await sendBotMessage(chatId, daily ? await morningReport() : await weeklyReport());
    const extra = daily ? await collectionAnomalies() : await riskClients();
    await sendBotMessage(chatId, extra ?? (daily ? '✅ Aucune anomalie d’encaissement hier.' : '✅ Aucun client à risque : tous ont eu de l’activité ces 14 derniers jours.'));
    return;
  }

  // Question libre ou bouton du menu Business. Sans IA disponible, les boutons affichent les données directement.
  // Question posée en note vocale : réponse écrite + note vocale (si ElevenLabs est configuré)
  await runAssistant(chatId, MENU_PROMPTS[text] || text, { fallbackView: MENU_VIEWS[text], voice: Boolean(message.voice) });
}

async function telegramApi(method: string, body: Record<string, unknown>) {
  return fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => null);
}

async function handleCallbackQuery(callbackQuery: TelegramCallbackQuery) {
  const chatId = callbackQuery.message.chat.id.toString();
  if (chatId !== process.env.TELEGRAM_CHAT_ID) return;

  await telegramApi('answerCallbackQuery', { callback_query_id: callbackQuery.id });
  const [action, ...params] = (callbackQuery.data || '').split(':');
  // Retire les boutons du message une fois cliqués (évite un double clic)
  const clearButtons = () =>
    telegramApi('editMessageReplyMarkup', {
      chat_id: chatId,
      message_id: callbackQuery.message.message_id,
      reply_markup: { inline_keyboard: [] },
    });

  switch (action) {
    // Confirmation / annulation d'une action préparée par l'assistant
    case 'act':
      await clearButtons();
      await sendBotMessage(chatId, await handleActionCallback(chatId, params[0], params[1] || ''));
      return;
    // Statut du paiement en ligne : bascule SasPay / manuel, actualisation
    case 'pay':
      await clearButtons();
      await handlePaymentCallback(params[0] || 'refresh', chatId);
      return;
    // Boutons sous une alerte de sécurité
    case 'sec':
      await handleSecurityCallback(params[0], params[1] || '', chatId);
      return;
    // Boutons des demandes confiées à Claude Code (plan, intégration, mise en production)
    case 'dev':
      await clearButtons();
      await handleDevCallback(params[0], params[1] || '', chatId);
      return;
  }
}
