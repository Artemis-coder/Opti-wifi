/**
 * Telegram Keyboard Menus - Inline & Reply Keyboards
 * Provides interactive menus for the bot
 */

import { sendTelegramMessage } from './telegram';

// Menu structure
export const MAIN_MENU = {
  reply_markup: {
    keyboard: [
      [{ text: '📊 Statut Projet' }, { text: '🚀 Déployer' }],
      [{ text: '🗄️ Base de Données' }, { text: '🔔 Notifications' }],
      [{ text: '📝 Tâches' }, { text: '👥 Utilisateurs' }],
      [{ text: '🔒 Sécurité & Audit' }, { text: '💡 Nouveau Projet' }],
      [{ text: '🗣️ ElevenLabs TTS' }, { text: '❓ Aide' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
    input_field_placeholder: 'Choisissez une action ou écrivez-moi...',
  },
};

export const PROJECT_MENU = {
  reply_markup: {
    keyboard: [
      [{ text: '📈 Statut Complet' }, { text: '🔄 Redéployer' }],
      [{ text: '📋 Voir Logs Déploiement' }, { text: '⚙️ Variables Env' }],
      [{ text: '🔙 Menu Principal' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  },
};

export const DATABASE_MENU = {
  reply_markup: {
    keyboard: [
      [{ text: '🏥 Health Check' }, { text: '🐌 Requêtes Lentes' }],
      [{ text: '🔌 Pool Connexions' }, { text: '📊 Stats Espaces' }],
      [{ text: '🔍 Requête SQL Personnalisée' }],
      [{ text: '🔙 Menu Principal' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  },
};

export const TASKS_MENU = {
  reply_markup: {
    keyboard: [
      [{ text: '📝 Créer Tâche' }, { text: '📋 Lister Tâches' }],
      [{ text: '✅ Terminer Tâche' }, { text: '🚫 Bloquer Tâche' }],
      [{ text: '🔙 Menu Principal' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  },
};

export const NOTIFICATIONS_MENU = {
  reply_markup: {
    keyboard: [
      [{ text: '🔔 Envoyer Notification' }, { text: '⏳ Demander Validation' }],
      [{ text: '⏳ Validations En Attente' }, { text: '🧪 Test Notification' }],
      [{ text: '🔙 Menu Principal' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  },
};

export const USERS_MENU = {
  reply_markup: {
    keyboard: [
      [{ text: '👥 Lister Utilisateurs' }, { text: '➕ Créer Utilisateur' }],
      [{ text: '📊 Stats Espaces WiFi' }],
      [{ text: '🔙 Menu Principal' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  },
};

export const NEW_PROJECT_MENU = {
  reply_markup: {
    keyboard: [
      [{ text: '💡 Idées Fonctionnalités' }, { text: '📋 Créer Spec Projet' }],
      [{ text: '🎯 Roadmap Court Terme' }, { text: '🚀 Roadmap Long Terme' }],
      [{ text: '💰 Estimation Coûts' }, { text: '🛠️ Stack Technique' }],
      [{ text: '🔙 Menu Principal' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  },
};

export const SECURITY_MENU = {
  reply_markup: {
    keyboard: [
      [{ text: '🔒 Audit Sécurité Complet' }, { text: '📦 Vulnérabilités Dépendances' }],
      [{ text: '🛡️ Politiques RLS' }, { text: '🔐 Secrets Exposés' }],
      [{ text: '📋 Headers Sécurité' }, { text: '👥 Permissions DB' }],
      [{ text: '🔧 Corriger Issue' }],
      [{ text: '🔙 Menu Principal' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  },
};

export const ELEVENLABS_MENU = {
  reply_markup: {
    keyboard: [
      [{ text: '🗣️ Générer Audio (TTS)' }, { text: '🎭 Lister Voix Disponibles' }],
      [{ text: '🎤 Test Voix (Rachel)' }, { text: '🎤 Test Voix (Adam)' }],
      [{ text: '🔙 Menu Principal' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  },
};

// Inline keyboards for confirmations and actions
export function createConfirmationInlineKeyboard(action: string, itemId: string) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Confirmer', callback_data: `confirm:${action}:${itemId}` },
          { text: '❌ Annuler', callback_data: `cancel:${action}:${itemId}` },
        ],
      ],
    },
  };
}

export function createTaskActionInlineKeyboard(taskId: string) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '▶️ Commencer', callback_data: `task:start:${taskId}` },
          { text: '✅ Terminer', callback_data: `task:done:${taskId}` },
        ],
        [
          { text: '🚫 Bloquer', callback_data: `task:block:${taskId}` },
          { text: '🗑️ Supprimer', callback_data: `task:delete:${taskId}` },
        ],
        [
          { text: '📝 Modifier', callback_data: `task:edit:${taskId}` },
        ],
      ],
    },
  };
}

export function createValidationInlineKeyboard(validationId: string) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Approuver', callback_data: `val:approve:${validationId}` },
          { text: '❌ Refuser', callback_data: `val:reject:${validationId}` },
        ],
        [
          { text: '💬 Répondre', callback_data: `val:reply:${validationId}` },
        ],
      ],
    },
  };
}

export function createDeployInlineKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🚀 Déployer Maintenant', callback_data: 'deploy:now' },
          { text: '📋 Voir Statut', callback_data: 'deploy:status' },
        ],
      ],
    },
  };
}

export function createModelSelectionInlineKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🤖 DeepSeek Chat (défaut)', callback_data: 'model:deepseek/deepseek-chat' }],
        [{ text: '🧠 DeepSeek R1 (reasoning)', callback_data: 'model:deepseek/deepseek-r1' }],
        [{ text: '🦙 Llama 3.1 8B', callback_data: 'model:meta-llama/llama-3.1-8b-instruct' }],
        [{ text: '🦙 Llama 3.1 70B', callback_data: 'model:meta-llama/llama-3.1-70b-instruct' }],
        [{ text: '🦙 Llama 3.2 3B', callback_data: 'model:meta-llama/llama-3.2-3b-instruct' }],
        [{ text: '🌪️ Mistral 7B', callback_data: 'model:mistralai/mistral-7b-instruct' }],
        [{ text: '🌪️ Mixtral 8x7B', callback_data: 'model:mistralai/mixtral-8x7b-instruct' }],
        [{ text: '🐉 Qwen 2.5 7B', callback_data: 'model:qwen/qwen-2.5-7b-instruct' }],
        [{ text: '🐉 Qwen 2.5 72B', callback_data: 'model:qwen/qwen-2.5-72b-instruct' }],
        [{ text: '💎 Gemma 2 9B', callback_data: 'model:google/gemma-2-9b-it' }],
        [{ text: '🔮 Phi-3 Mini', callback_data: 'model:microsoft/phi-3-mini-128k-instruct' }],
        [{ text: '🔮 Phi-3 Medium', callback_data: 'model:microsoft/phi-3-medium-128k-instruct' }],
        [{ text: '👁️ Phi-3 Vision', callback_data: 'model:microsoft/phi-3-vision-128k-instruct' }],
        [{ text: '👁️ Qwen 2.5 VL 7B', callback_data: 'model:qwen/qwen-2.5-vl-7b-instruct' }],
        [{ text: '👁️ Llama 3.2 11B Vision', callback_data: 'model:meta-llama/llama-3.2-11b-vision-instruct' }],
        [{ text: '🎙️ Whisper Large v3 (transcription)', callback_data: 'model:openai/whisper-large-v3' }],
        [{ text: '🎙️ Whisper Turbo (transcription)', callback_data: 'model:openai/whisper-large-v3-turbo' }],
      ],
    },
  };
}

export function createElevenLabsVoicesInlineKeyboard(voices: any[]) {
  const voiceButtons = voices.slice(0, 10).map(v => 
    [{ text: `🗣️ ${v.name} (${v.category || 'custom'})`, callback_data: `elevenlabs_voice:${v.id}` }]
  );
  voiceButtons.push([{ text: '🔙 Modèles IA', callback_data: 'model_menu' }]);
  return {
    reply_markup: {
      inline_keyboard: voiceButtons,
    },
  };
}

// Helper to send message with keyboard
export async function sendMessageWithKeyboard(
  chatId: string | number,
  text: string,
  keyboard: any = MAIN_MENU,
  parseMode: 'HTML' | 'MarkdownV2' = 'HTML'
) {
  return sendTelegramMessage({
    chat_id: chatId,
    text,
    parse_mode: parseMode,
    reply_markup: keyboard.reply_markup,
  });
}

// Helper to edit message with inline keyboard
export async function editMessageWithInlineKeyboard(
  chatId: string | number,
  messageId: number,
  text: string,
  inlineKeyboard: any,
  parseMode: 'HTML' | 'MarkdownV2' = 'HTML'
) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;
  
  const response = await fetch(`${API_URL}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: parseMode,
      reply_markup: inlineKeyboard.reply_markup,
    }),
  });
  
  return response.json();
}

// Menu navigation handler
export function getMenuForCommand(command: string) {
  const menus: Record<string, any> = {
    '/menu': MAIN_MENU,
    '/projet': PROJECT_MENU,
    '/database': DATABASE_MENU,
    '/db': DATABASE_MENU,
    '/tâches': TASKS_MENU,
    '/tasks': TASKS_MENU,
    '/notifications': NOTIFICATIONS_MENU,
    '/notifs': NOTIFICATIONS_MENU,
    '/utilisateurs': USERS_MENU,
    '/users': USERS_MENU,
    '/nouveau': NEW_PROJECT_MENU,
    '/newproject': NEW_PROJECT_MENU,
    '/securite': SECURITY_MENU,
    '/security': SECURITY_MENU,
  };
  
  return menus[command.toLowerCase()] || MAIN_MENU;
}

// Quick reply suggestions based on context
export function getContextualSuggestions(context: string): string[] {
  const suggestions: Record<string, string[]> = {
    project: ['Statut complet', 'Redéployer', 'Voir logs', 'Variables env'],
    database: ['Health check', 'Requêtes lentes', 'Pool connexions', 'Stats espaces'],
    tasks: ['Créer tâche', 'Lister tâches', 'Terminer tâche', 'Bloquer tâche'],
    notifications: ['Envoyer notif', 'Demander validation', 'Validations en attente'],
    users: ['Lister users', 'Créer user', 'Stats espaces'],
    newproject: ['Idées features', 'Créer spec', 'Roadmap court', 'Roadmap long'],
    security: ['Audit complet', 'Vulnérabilités', 'RLS', 'Secrets', 'Headers', 'Permissions DB'],
    general: ['Menu principal', 'Aide', 'Statut projet', 'Nouveau projet', 'Sécurité'],
  };
  
  return suggestions[context] || suggestions.general;
}