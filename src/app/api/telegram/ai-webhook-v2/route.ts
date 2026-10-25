import { isTelegramWebhookAuthorized } from '@/lib/telegram-auth';
/**
 * Advanced AI Telegram Webhook with OpenRouter LLM + Function Calling
 * Supports: Free models (DeepSeek, Llama, Mistral, etc.), Voice transcription, Menus, Memory
 */

import { NextRequest, NextResponse, after } from 'next/server';
import { freeLLMClient, selectBestAvailableModel, getModelInfo, FREE_MODELS, type ModelId, type ModelInfo } from '@/lib/free-llm';
import { 
  sendTelegramMessage 
} from '@/lib/telegram';
import { 
  sendMessageWithKeyboard, 
  getMenuForCommand,
  createConfirmationInlineKeyboard,
  createTaskActionInlineKeyboard,
  createValidationInlineKeyboard,
  createDeployInlineKeyboard,
  createModelSelectionInlineKeyboard,
  createElevenLabsVoicesInlineKeyboard,
  MAIN_MENU,
  PROJECT_MENU,
  DATABASE_MENU,
  TASKS_MENU,
  NOTIFICATIONS_MENU,
  USERS_MENU,
  NEW_PROJECT_MENU,
  SECURITY_MENU,
  ELEVENLABS_MENU,
  MODEL_MENU,
  getContextualSuggestions
} from '@/lib/telegram-menus';
import { 
  initConversationTables,
  getOrCreateSession,
  addMessage,
  getConversationHistory,
  updateSessionContext,
  updateSessionModel,
  updateSessionTranscriptionModel,
  clearConversationHistory,
  getConversationStats
} from '@/lib/conversation-memory';
import { executeFunction } from '@/lib/bot-functions';
import { PROJECT_KNOWLEDGE, BOT_CAPABILITIES } from '@/lib/bot-knowledge';
import {
  ADMIN_MENU,
  HELP_TEXT,
  MENU_PROMPTS,
  handleActionCallback,
  isClaudeConfigured,
  runClaudeAssistant,
  sendBotMessage,
  toTelegramHtml,
} from '@/lib/bot/assistant';
import { getTechnicalStatus } from '@/lib/bot/admin-data';

const SYSTEM_PROMPT = `Tu es l'assistant IA expert d'OptiWifi, une plateforme SaaS de gestion WiFi.

PERSONNALITÉ :
- Ton professionnel, accessible, proactif
- Tu parles français naturellement
- Tu proposes des actions concrètes via les outils
- Tu demandes confirmation avant actions destructives
- Tu gardes le contexte du projet OptiWifi

CONNAISSANCES PROJET :
${PROJECT_KNOWLEDGE}

CAPACITÉS OUTILS :
${BOT_CAPABILITIES}

RÈGLES :
1. Utilise SEMPRE les outils pour les actions réelles (déploiement, DB, notifications, tâches)
2. Pour les questions générales, réponds directement sans outils
3. Propose le menu contextuel approprié après chaque réponse
4. Mémoire : tu as accès à l'historique récent
5. Si incertain, dis-le et propose d'investiguer avec les outils
6. Max 5 appels d'outils par tour`;

async function initializeDB() {
  try {
    await initConversationTables();
  } catch (error) {
    console.warn('DB init warning:', error);
  }
}

export async function POST(request: NextRequest) {
  if (!isTelegramWebhookAuthorized(request)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }
  const update = await request.json().catch(() => null);
  if (!update) return NextResponse.json({ ok: true });

  // Réponse immédiate à Telegram (sinon il renvoie le message), traitement en arrière-plan
  after(async () => {
    try {
      await initializeDB();
      if (update.message) {
        await handleMessage(update.message);
      } else if (update.callback_query) {
        await handleCallbackQuery(update.callback_query);
      } else if (update.edited_message && !isClaudeConfigured()) {
        await handleMessage(update.edited_message);
      }
    } catch (error) {
      console.error('Webhook error:', error);
    }
  });
  return NextResponse.json({ ok: true });
}

async function handleMessage(message: any) {
  const chatId = message.chat.id.toString();
  const userName = message.from?.first_name || 'Utilisateur';
  const authorizedChatId = process.env.TELEGRAM_CHAT_ID;

  if (chatId !== authorizedChatId) {
    await sendTelegramMessage({ chat_id: chatId, text: '❌ Non autorisé. Ce bot est privé.' });
    return;
  }

  // Get or create session
  const session = await getOrCreateSession(chatId);

  // Assistant Claude (modèle par défaut) ; l'ancien moteur reste en secours sans clé Anthropic
  if (isClaudeConfigured()) {
    await handleClaudeMessage(message, chatId, session);
    return;
  }
  
  // Handle different message types
  if (message.voice) {
    await handleVoiceMessage(message, chatId, session);
    return;
  }

  if (message.text) {
    const text = message.text.trim();
    await handleTextMessage(text, chatId, userName, session);
  }
}

/** Télécharge un message vocal Telegram et le transcrit (Whisper via OpenRouter ou Groq). */
async function transcribeVoice(message: any, session: any): Promise<{ text: string; model: string }> {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${message.voice.file_id}`);
  const fileData = await fileRes.json();
  if (!fileData.ok) throw new Error('Fichier audio introuvable');
  const audioRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.result.file_path}`);
  const audioBuffer = Buffer.from(await audioRes.arrayBuffer());

  const transcriptionModelKey = session.transcription_model || 'openrouter/whisper';
  const modelInfo = getModelInfo(transcriptionModelKey as ModelId);
  const text = await freeLLMClient.transcribeAudio(audioBuffer, 'fr', modelInfo?.model || 'openai/whisper-large-v3');
  return { text: text.trim(), model: modelInfo?.name || 'Whisper' };
}

async function handleVoiceMessage(message: any, chatId: string, session: any) {
  const contextMenu = getContextualMenu(session.context);
  try {
    await sendMessageWithKeyboard(chatId, '🎙️ Transcription en cours...', contextMenu, 'HTML');
    const { text, model } = await transcribeVoice(message, session);
    await sendMessageWithKeyboard(chatId, `🎙️ <b>Transcription (${model}) :</b>\n\n${toTelegramHtml(text)}`, contextMenu, 'HTML');
    await handleTextMessage(text, chatId, message.from?.first_name || 'Utilisateur', session);
  } catch (error) {
    console.error('Transcription error:', error);
    await sendMessageWithKeyboard(chatId, '❌ La transcription a échoué. Réessayez ou écrivez votre message.', contextMenu);
  }
}

/** Messages traités par l'assistant Claude : commandes, boutons du menu, texte et vocal. */
async function handleClaudeMessage(message: any, chatId: string, session: any) {
  let text: string = (message.text || '').trim();

  if (message.voice) {
    try {
      const { text: transcript } = await transcribeVoice(message, session);
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

  const command = text.split(/\s+/)[0].toLowerCase().replace(/@.*$/, '');
  if (['/start', '/menu'].includes(command)) {
    await sendBotMessage(chatId, `👋 Bonjour ! Que voulez-vous savoir ou faire ?\n\n${HELP_TEXT}`);
    return;
  }
  if (['/aide', '/help', '❓ aide'].includes(command) || text === '❓ Aide') {
    await sendBotMessage(chatId, HELP_TEXT);
    return;
  }
  if (['/effacer', '/clear'].includes(command)) {
    await clearConversationHistory(chatId);
    await sendBotMessage(chatId, '🧹 Conversation effacée : je repars de zéro.');
    return;
  }

  await runClaudeAssistant(chatId, MENU_PROMPTS[text] || text);
}

async function handleTextMessage(text: string, chatId: string, userName: string, session: any) {
  // Use free LLM client with auto model selection
  const client = freeLLMClient;
  
  // Determine best model based on context and message
  const selectedModel = session.auto_model 
    ? selectBestAvailableModel(text, false, false, session.context)
    : (session.model as ModelId);
  
  // Handle commands
  if (text.startsWith('/')) {
    await handleCommand(text, chatId, userName, session);
    return;
  }

  // Handle menu button texts (reply keyboard buttons)
  if (await handleMenuButton(text, chatId, userName, session)) {
    return;
  }

  // Add user message to history
  await addMessage({ chat_id: chatId, role: 'user', content: text });

  // Get conversation history
  const history = await getConversationHistory(chatId, 15);
  
  // Build messages for LLM
  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    ...history.map(m => ({ role: m.role as any, content: m.content, tool_calls: m.tool_calls, tool_call_id: m.tool_call_id })),
    { role: 'user' as const, content: text }
  ];

  try {
    // Call LLM with function calling using auto-selected model
    const response = await client.chatCompletion({
      model: selectedModel,
      messages,
      tools: (await import('@/lib/bot-functions')).FUNCTION_DEFINITIONS as any,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 4000,
    });

    const choice = response.choices[0];
    const assistantMessage = choice.message;

    // Handle tool calls
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      await handleToolCalls(assistantMessage.tool_calls, chatId, messages, client, session);
      return;
    }

    // Regular response
    const responseText = assistantMessage.content || "Je n'ai pas de réponse.";
    
    // Add to history
    await addMessage({ 
      chat_id: chatId, 
      role: 'assistant', 
      content: responseText,
      metadata: { model: selectedModel, tokens: response.usage?.total_tokens }
    });

    // Send with appropriate menu
    const contextMenu = getContextualMenu(session.context);
    await sendMessageWithKeyboard(chatId, responseText, contextMenu);

  } catch (error: any) {
    console.error('LLM error:', error);
    const contextMenu = getContextualMenu(session.context);
    await sendMessageWithKeyboard(chatId, `❌ Erreur IA : ${error?.message || 'Erreur inconnue'}. Réessaie ou tape /menu.`, contextMenu);
  }
}

async function handleToolCalls(toolCalls: any[], chatId: string, messages: any[], client: any, session: any) {
  // Add assistant message with tool calls to history
  await addMessage({ 
    chat_id: chatId, 
    role: 'assistant', 
    content: '', // Empty string for tool calls
    tool_calls: toolCalls 
  });

  // Execute each tool
  const toolResults = [];
  for (const toolCall of toolCalls.slice(0, 5)) {
    try {
      const result = await executeFunction(toolCall.function.name, JSON.parse(toolCall.function.arguments), chatId);
      toolResults.push({
        tool_call_id: toolCall.id,
        role: 'tool' as const,
        content: JSON.stringify(result),
      });
      
      // Add tool result to history
      await addMessage({ 
        chat_id: chatId, 
        role: 'tool', 
        content: JSON.stringify(result),
        tool_call_id: toolCall.id 
      });
    } catch (error: any) {
      toolResults.push({
        tool_call_id: toolCall.id,
        role: 'tool' as const,
        content: JSON.stringify({ error: error?.message || 'Erreur inconnue' }),
      });
    }
  }

  // Get final response from LLM with tool results using freeLLMClient
  const freeClient = freeLLMClient;
  const selectedModel = session.auto_model 
    ? selectBestAvailableModel('Tool results processing', false, false, session.context)
    : (session.model as ModelId);
  
  const finalMessages = [...messages, { role: 'assistant' as const, content: null, tool_calls: toolCalls }, ...toolResults];
  
  const finalResponse = await freeClient.chatCompletion({
    model: selectedModel,
    messages: finalMessages,
    temperature: 0.7,
    max_tokens: 4000,
  });

  const finalText = finalResponse.choices[0].message.content || 'Action terminée.';
  
  await addMessage({ 
    chat_id: chatId, 
    role: 'assistant', 
    content: finalText,
    metadata: { model: selectedModel, tokens: finalResponse.usage?.total_tokens }
  });

  const contextMenu = getContextualMenu(session.context);
  await sendMessageWithKeyboard(chatId, finalText, contextMenu);
}

async function handleMenuButton(text: string, chatId: string, userName: string, session: any): Promise<boolean> {
  // Main Menu Buttons
  if (text === '📊 Statut Projet') {
    await updateSessionContext(chatId, 'project');
    await sendMessageWithKeyboard(chatId, formatTechnicalStatus(await getTechnicalStatus()), PROJECT_MENU);
    return true;
  }

  if (text === '🚀 Déployer') {
    await updateSessionContext(chatId, 'project');
    await sendMessageWithKeyboard(chatId, 
      `🚀 <b>Déploiement</b>\n\n` +
      `Clique pour déclencher un nouveau déploiement :`,
      createDeployInlineKeyboard()
    );
    return true;
  }
  
  if (text === '🗄️ Base de Données') {
    await updateSessionContext(chatId, 'database');
    await sendMessageWithKeyboard(chatId, '🗄️ <b>Menu Base de Données</b>', DATABASE_MENU);
    return true;
  }
  
  if (text === '🔔 Notifications') {
    await updateSessionContext(chatId, 'notifications');
    await sendMessageWithKeyboard(chatId, '🔔 <b>Menu Notifications</b>', NOTIFICATIONS_MENU);
    return true;
  }
  
  if (text === '📝 Tâches') {
    await updateSessionContext(chatId, 'tasks');
    await sendMessageWithKeyboard(chatId, '📝 <b>Menu Tâches</b>', TASKS_MENU);
    return true;
  }
  
  if (text === '👥 Utilisateurs') {
    await updateSessionContext(chatId, 'users');
    const stats = await executeFunction('get_space_stats', {}, chatId);
    const data = stats[0] || { total_spaces: 0, active_spaces: 0 };
    await sendMessageWithKeyboard(chatId, 
      `👥 <b>Utilisateurs & Espaces WiFi</b>\n\n` +
      `📊 <b>Total espaces :</b> ${data.total_spaces}\n` +
      `✅ <b>Actifs :</b> ${data.active_spaces}\n` +
      `❌ <b>Inactifs :</b> ${data.inactive_spaces || 0}`,
      USERS_MENU
    );
    return true;
  }
  
  if (text === '💡 Nouveau Projet') {
    await updateSessionContext(chatId, 'new_project');
    await sendMessageWithKeyboard(chatId, '💡 <b>Nouveau Projet - Idées & Planification</b>', NEW_PROJECT_MENU);
    return true;
  }
  
  if (text === '❓ Aide') {
    await sendTelegramMessage({
      chat_id: chatId,
      text: `🤖 <b>OptiWifi Bot IA - Aide</b>\n\n` +
        `<b>Menus Principaux :</b>\n` +
        `• <code>/menu</code> - Menu principal\n` +
        `• <code>/projet</code> - Gestion projet\n` +
        `• <code>/database</code> - Base de données\n` +
        `• <code>/tâches</code> - Gestion tâches\n` +
        `• <code>/notifications</code> - Alertes & validations\n` +
        `• <code>/utilisateurs</code> - Users & espaces\n` +
        `• <code>/nouveau</code> - Nouveau projet\n\n` +
        `<b>Configuration :</b>\n` +
        `• <code>/model</code> - Changer modèle IA\n` +
        `• <code>/historique</code> - Stats conversation\n` +
        `• <code>/effacer</code> - Reset conversation\n\n` +
        `<b>Fonctionnalités :</b>\n` +
        `• 🎙️ Messages vocaux → transcription auto\n` +
        `• 💬 Conversation naturelle + outils\n` +
        `• 🔧 Function calling (déploiement, DB, tâches...)\n` +
        `• 🧠 Mémoire persistante (DB)\n` +
        `• 📋 Menus interactifs\n\n` +
        `<b>Exemples :</b>\n` +
        `• "Déploie le projet"\n` +
        `• "SELECT * FROM users LIMIT 5"\n` +
        `• "Crée une tâche : tests E2E"\n` +
        `• "Quelles features pour un SaaS ?"`,
      parse_mode: 'HTML',
    });
    return true;
  }
  
  // Project Menu Buttons
  if (text === '📈 Statut Complet') {
    const result = await executeFunction('check_deployment_status', {}, chatId);
    await sendMessageWithKeyboard(chatId,
      `📈 <b>Statut Complet</b>\n\n` +
      `🌐 <b>Production :</b> https://www.optiwifi.site\n` +
      `📦 <b>État :</b> ${result?.state || 'Inconnu'}\n` +
      `🕐 <b>Déployé :</b> ${result?.createdAt ? new Date(result.createdAt).toLocaleString('fr-FR') : 'N/A'}\n` +
      `🔗 <a href="${result?.url || 'https://vercel.com/optiwifi'}">Voir déploiement</a>\n\n` +
      `📋 <b>Projet :</b> OptiWifi (Next.js 16)\n` +
      `🗄️ <b>DB :</b> Neon PostgreSQL\n` +
      `🤖 <b>Auth :</b> Better Auth\n` +
      `📱 <b>Mobile :</b> Flutter app`,
      PROJECT_MENU
    );
    return true;
  }
  
  if (text === '🔄 Redéployer') {
    const res = await fetch('https://api.vercel.com/v1/integrations/deploy/prj_sYLBGlV8d7PBEEiDbwJbq9qm9fdy/xsZKyhGwr2', { method: 'POST' });
    await sendMessageWithKeyboard(chatId, 
      res.ok ? '🚀 <b>Redéploiement déclenché !</b>' : '❌ <b>Erreur redéploiement</b>',
      PROJECT_MENU
    );
    return true;
  }
  
  if (text === '📋 Voir Logs Déploiement') {
    const token = process.env.VERCEL_TOKEN;
    if (token) {
      const res = await fetch('https://api.vercel.com/v6/deployments?projectId=prj_sYLBGlV8d7PBEEiDbwJbq9qm9fdy&limit=3', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      const deployments = data.deployments || [];
      let text = `📋 <b>Derniers Déploiements</b>\n\n`;
      for (const dep of deployments) {
        text += `🆔 ${dep.uid} - ${dep.state}\n`;
        text += `🕐 ${new Date(dep.createdAt).toLocaleString('fr-FR')}\n`;
        text += `🔗 <a href="${dep.url}">Voir</a>\n\n`;
      }
      await sendMessageWithKeyboard(chatId, text || 'Aucun déploiement', PROJECT_MENU);
    } else {
      await sendMessageWithKeyboard(chatId, '❌ VERCEL_TOKEN non configuré', PROJECT_MENU);
    }
    return true;
  }
  
  if (text === '⚙️ Variables Env') {
    await sendMessageWithKeyboard(chatId,
      `⚙️ <b>Variables d'Environnement Vercel</b>\n\n` +
      `Variables configurées :\n` +
      `• NEXT_PUBLIC_SUPABASE_URL\n` +
      `• NEXT_PUBLIC_SUPABASE_ANON_KEY\n` +
      `• SUPABASE_SERVICE_ROLE_KEY\n` +
      `• TELEGRAM_BOT_TOKEN\n` +
      `• TELEGRAM_CHAT_ID\n` +
      `• CRON_SECRET\n` +
      `• OPENROUTER_API_KEY (⚠️ placeholder)\n` +
      `• VERCEL_TOKEN (⚠️ placeholder)\n\n` +
      `⚠️ <b>Action requise :</b> Remplacer OPENROUTER_API_KEY et VERCEL_TOKEN sur Vercel Dashboard`,
      PROJECT_MENU
    );
    return true;
  }
  
  // Database Menu Buttons
  if (text === '🏥 Health Check') {
    const result = await executeFunction('run_health_check', {}, chatId);
    await sendMessageWithKeyboard(chatId,
      `🏥 <b>Health Check Base de Données</b>\n\n` +
      `✅ <b>Connexion :</b> ${result.connected ? 'OK' : 'ÉCHEC'}\n` +
      `⚡ <b>Latence :</b> ${result.latency_ms || 'N/A'}ms\n` +
      `🔌 <b>Pool :</b> ${result.pool_usage || 'N/A'}%\n` +
      `🐌 <b>Requêtes lentes :</b> ${result.slow_queries_count || 0}\n` +
      `📊 <b>Taille DB :</b> ${result.database_size || 'N/A'}`,
      DATABASE_MENU
    );
    return true;
  }
  
  if (text === '🐌 Requêtes Lentes') {
    const result = await executeFunction('check_slow_queries', { thresholdMs: 1000 }, chatId);
    let text = `🐌 <b>Requêtes Lentes (>1s)</b>\n\n`;
    if (result && result.length > 0) {
      for (const q of result.slice(0, 5)) {
        text += `⏱️ ${q.mean_exec_time?.toFixed(2)}ms - ${q.calls} appels\n`;
        text += `<code>${q.query?.substring(0, 80)}...</code>\n\n`;
      }
    } else {
      text += '✅ Aucune requête lente détectée';
    }
    await sendMessageWithKeyboard(chatId, text, DATABASE_MENU);
    return true;
  }
  
  if (text === '🔌 Pool Connexions') {
    const result = await executeFunction('check_connection_pool', {}, chatId);
    const data = result[0] || {};
    await sendMessageWithKeyboard(chatId,
      `🔌 <b>Pool de Connexions PostgreSQL</b>\n\n` +
      `🔗 <b>Total :</b> ${data.total_connections || 0}\n` +
      `⚡ <b>Actives :</b> ${data.active_connections || 0}\n` +
      `💤 <b>Inactives :</b> ${data.idle_connections || 0}\n` +
      `📊 <b>Max :</b> ${data.max_connections || 'N/A'}\n` +
      `📈 <b>Usage :</b> ${data.usage_percent || 0}%`,
      DATABASE_MENU
    );
    return true;
  }
  
  if (text === '📊 Stats Espaces') {
    const result = await executeFunction('get_space_stats', {}, chatId);
    const data = result[0] || {};
    await sendMessageWithKeyboard(chatId,
      `📊 <b>Statistiques Espaces WiFi</b>\n\n` +
      `🏢 <b>Total :</b> ${data.total_spaces || 0}\n` +
      `✅ <b>Actifs :</b> ${data.active_spaces || 0}\n` +
      `❌ <b>Inactifs :</b> ${data.inactive_spaces || 0}`,
      DATABASE_MENU
    );
    return true;
  }
  
  if (text === '🔍 Requête SQL Personnalisée') {
    await sendMessageWithKeyboard(chatId,
      `🔍 <b>Requête SQL Personnalisée</b>\n\n` +
      `Envoie ta requête SELECT directement, exemple :\n` +
      `<code>SELECT * FROM wifi_spaces WHERE is_active = true LIMIT 10</code>\n\n` +
      `⚠️ Seules les requêtes SELECT sont autorisées.`,
      DATABASE_MENU
    );
    return true;
  }
  
  // Tasks Menu Buttons
  if (text === '📝 Créer Tâche') {
    await sendMessageWithKeyboard(chatId,
      `📝 <b>Créer une Tâche</b>\n\n` +
      `Dis-moi : "Crée une tâche : [titre] - [description] - [priorité: high/medium/low]"\n\n` +
      `Exemple : "Crée une tâche : Tests E2E - Configurer Playwright pour les tests d'intégration - high"`,
      TASKS_MENU
    );
    return true;
  }
  
  if (text === '📋 Lister Tâches') {
    const result = await executeFunction('list_tasks', {}, chatId);
    let text = `📋 <b>Liste des Tâches</b>\n\n`;
    for (const task of result.tasks || []) {
      const emoji = task.status === 'done' ? '✅' : task.status === 'blocked' ? '🚫' : '⏳';
      text += `${emoji} <b>${task.title}</b> [${task.priority}]\n`;
      text += `   ${task.description}\n\n`;
    }
    if (!result.tasks?.length) text += 'Aucune tâche pour le moment.';
    await sendMessageWithKeyboard(chatId, text, TASKS_MENU);
    return true;
  }
  
  if (text === '✅ Terminer Tâche') {
    await sendMessageWithKeyboard(chatId,
      `✅ <b>Terminer une Tâche</b>\n\n` +
      `Dis-moi : "Termine la tâche [ID]"\n\n` +
      `Ou utilise /tasks pour voir la liste puis clique sur une action.`,
      TASKS_MENU
    );
    return true;
  }
  
  if (text === '🚫 Bloquer Tâche') {
    await sendMessageWithKeyboard(chatId,
      `🚫 <b>Bloquer une Tâche</b>\n\n` +
      `Dis-moi : "Bloque la tâche [ID] - [raison]"\n\n` +
      `Exemple : "Bloque la tâche task_123 - Attente validation design"`,
      TASKS_MENU
    );
    return true;
  }
  
  // Notifications Menu Buttons
  if (text === '🔔 Envoyer Notification') {
    await sendMessageWithKeyboard(chatId,
      `🔔 <b>Envoyer Notification</b>\n\n` +
      `Dis-moi : "Envoie une notification : [titre] - [message] - [type: build/database/error/custom]"\n\n` +
      `Exemple : "Envoie une notification : Build OK - Le build #42 a réussi - build"`,
      NOTIFICATIONS_MENU
    );
    return true;
  }
  
  if (text === '⏳ Demander Validation') {
    await sendMessageWithKeyboard(chatId,
      `⏳ <b>Demander Validation</b>\n\n` +
      `Dis-moi : "Demande validation : [étape] - [message] - [contexte]"\n\n` +
      `Exemple : "Demande validation : Déploiement prod - Peux-tu valider le déploiement ? - Build #42 prêt"`,
      NOTIFICATIONS_MENU
    );
    return true;
  }
  
  if (text === '⏳ Validations En Attente') {
    const result = await executeFunction('get_pending_validations', {}, chatId);
    await sendMessageWithKeyboard(chatId,
      `⏳ <b>Validations En Attente</b>\n\n` +
      `${result.message || 'Aucune validation en attente'}`,
      NOTIFICATIONS_MENU
    );
    return true;
  }
  
  if (text === '🧪 Test Notification') {
    await executeFunction('send_notification', { 
      type: 'custom', 
      title: 'Test Bot', 
      message: 'Ceci est un test de notification depuis le bot IA !', 
      severity: 'low' 
    }, chatId);
    await sendMessageWithKeyboard(chatId, '✅ <b>Notification de test envoyée !</b>', NOTIFICATIONS_MENU);
    return true;
  }
  
  // Users Menu Buttons
  if (text === '👥 Lister Utilisateurs') {
    const result = await executeFunction('run_sql', { 
      query: 'SELECT id, email, created_at FROM users ORDER BY created_at DESC LIMIT 20' 
    }, chatId);
    let text = `👥 <b>Utilisateurs (20 derniers)</b>\n\n`;
    for (const u of result || []) {
      text += `🆔 ${u.id?.substring(0,8)} | ${u.email} | ${new Date(u.created_at).toLocaleDateString('fr-FR')}\n`;
    }
    await sendMessageWithKeyboard(chatId, text || 'Aucun utilisateur', USERS_MENU);
    return true;
  }
  
  if (text === '➕ Créer Utilisateur') {
    await sendMessageWithKeyboard(chatId,
      `➕ <b>Créer Utilisateur</b>\n\n` +
      `Cette fonction nécessite l'API Better Auth.\n` +
      `Pour l'instant, utilise le dashboard Supabase ou l'inscription web.\n\n` +
      `💡 Fonctionnalité à implémenter via API Better Auth.`,
      USERS_MENU
    );
    return true;
  }
  
  if (text === '📊 Stats Espaces WiFi') {
    const result = await executeFunction('get_space_stats', {}, chatId);
    const data = result[0] || {};
    await sendMessageWithKeyboard(chatId,
      `📊 <b>Stats Espaces WiFi</b>\n\n` +
      `🏢 <b>Total :</b> ${data.total_spaces || 0}\n` +
      `✅ <b>Actifs :</b> ${data.active_spaces || 0}\n` +
      `❌ <b>Inactifs :</b> ${data.inactive_spaces || 0}`,
      USERS_MENU
    );
    return true;
  }
  
  // New Project Menu Buttons
  if (text === '💡 Idées Fonctionnalités') {
    await sendMessageWithKeyboard(chatId,
      `💡 <b>Idées Fonctionnalités SaaS WiFi</b>\n\n` +
      `1. <b>Analytics temps réel</b> - Dashboard clients connectés, bande passante\n` +
      `2. <b>Captive portal</b> - Page d'accueil personnalisée par lieu\n` +
      `3. <b>Gestion multi-sites</b> - Hiérarchie organisations/sites\n` +
      `4. <b>Facturation automatique</b> - Stripe integration par usage\n` +
      `5. <b>Alertes proactives</b> - Seuil bande passante, déconnexions\n` +
      `6. <b>API publique</b> - Intégrations tierces (PMS, CRM)\n` +
      `7. <b>White-label</b> - Marque personnalisée par client\n` +
      `8. <b>Rapports PDF</b> - Export hebdo/mensuel automatisé`,
      NEW_PROJECT_MENU
    );
    return true;
  }
  
  if (text === '📋 Créer Spec Projet') {
    await sendMessageWithKeyboard(chatId,
      `📋 <b>Créer Spécification Projet</b>\n\n` +
      `Dis-moi ton idée et je génère une spec complète :\n` +
      `• Architecture technique\n` +
      `• Modèle de données\n` +
      `• API endpoints\n` +
      `• Stack recommandée\n` +
      `• Estimation coûts/délais\n\n` +
      `Exemple : "Crée une spec pour un SaaS de gestion de parkings"`,
      NEW_PROJECT_MENU
    );
    return true;
  }
  
  if (text === '🎯 Roadmap Court Terme') {
    await sendMessageWithKeyboard(chatId,
      `🎯 <b>Roadmap Court Terme (1-3 mois)</b>\n\n` +
      `✅ <b>Fait :</b> Auth, Dashboard, WiFi spaces, Mobile Flutter\n` +
      `🔄 <b>En cours :</b> Email SMTP, Bot Telegram IA\n` +
      `📋 <b>Prochain :</b>\n` +
      `1. Tests E2E Playwright (2 sem)\n` +
      `2. Analytics temps réel (3 sem)\n` +
      `3. Captive portal basique (4 sem)\n` +
      `4. Facturation Stripe (6 sem)\n` +
      `5. Documentation API (2 sem)`,
      NEW_PROJECT_MENU
    );
    return true;
  }
  
  if (text === '🚀 Roadmap Long Terme') {
    await sendMessageWithKeyboard(chatId,
      `🚀 <b>Roadmap Long Terme (6-12 mois)</b>\n\n` +
      `📦 <b>Produit :</b>\n` +
      `• Multi-tenant SaaS complet\n` +
      `• Marketplace intégrations\n` +
      `• App mobile native (iOS/Android)\n` +
      `• White-label total\n\n` +
      `🏗️ <b>Technique :</b>\n` +
      `• Migration microservices\n` +
      `• Event-driven architecture\n` +
      `• Multi-région (CDN global)\n` +
      `• ML pour optimisation WiFi\n\n` +
      `💰 <b>Business :</b>\n` +
      `• Modèle freemium\n` +
      `• Partenaires revendeurs\n` +
      `• Expansion Afrique/Europe`,
      NEW_PROJECT_MENU
    );
    return true;
  }
  
  if (text === '💰 Estimation Coûts') {
    await sendMessageWithKeyboard(chatId,
      `💰 <b>Estimation Coûts Mensuels</b>\n\n` +
      `🏗️ <b>Infrastructure actuelle :</b>\n` +
      `• Vercel Pro : $20/mois\n` +
      `• Neon Postgres : $19/mois (plan Scale)\n` +
      `• Supabase Auth : Gratuit (jusqu'à 50k MAU)\n` +
      `• OpenRouter API : ~$5-15/mois (usage modéré)\n` +
      `• Domaine : ~$1/mois\n\n` +
      `📈 <b>Projection croissance (10x users) :</b>\n` +
      `• Vercel : $20-150/mois\n` +
      `• Neon : $19-199/mois\n` +
      `• Supabase : $25-599/mois\n` +
      `• OpenRouter : $15-50/mois\n\n` +
      `💡 <b>Total actuel :</b> ~$45/mois\n` +
      `💡 <b>À 10x :</b> ~$200-800/mois`,
      NEW_PROJECT_MENU
    );
    return true;
  }
  
  if (text === '🛠️ Stack Technique') {
    await sendMessageWithKeyboard(chatId,
      `🛠️ <b>Stack Technique OptiWifi</b>\n\n` +
      `<b>Frontend :</b> Next.js 16, React 19, Tailwind CSS, TypeScript\n` +
      `<b>Backend :</b> Next.js API Routes, Server Actions\n` +
      `<b>Database :</b> Neon PostgreSQL (serverless)\n` +
      `<b>Auth :</b> Better Auth (email/password, OAuth)\n` +
      `<b>ORM :</b> Drizzle ORM + Supabase client\n` +
      `<b>Mobile :</b> Flutter 3.x, Material Design 3\n` +
      `<b>Deployment :</b> Vercel (Edge + Serverless)\n` +
      `<b>Monitoring :</b> Custom health checks, Cron jobs\n` +
      `<b>AI :</b> OpenRouter (DeepSeek, Llama, Mistral, etc.)\n` +
      `<b>Bot :</b> Telegram Bot API + Webhooks\n` +
      `<b>Email :</b> Nodemailer + Gmail SMTP (pending)`,
      NEW_PROJECT_MENU
    );
    return true;
  }
  
  // Security Menu Buttons
  if (text === '🔒 Sécurité & Audit') {
    await updateSessionContext(chatId, 'security');
    await sendMessageWithKeyboard(chatId, '🔒 <b>Sécurité & Audit</b>', SECURITY_MENU);
    return true;
  }
  
  if (text === '🔒 Audit Sécurité Complet') {
    const result = await executeFunction('run_security_audit', { scope: 'full' }, chatId);
    let text = `🔒 <b>Audit Sécurité Complet</b>\n\n`;
    text += `📋 <b>Portée :</b> ${result.scope}\n`;
    text += `🕐 <b>Date :</b> ${new Date(result.timestamp).toLocaleString('fr-FR')}\n`;
    text += `📊 <b>Résumé :</b> ${result.summary}\n\n`;
    for (const r of result.results) {
      text += `• <b>${r.category}</b>: ${r.issues?.length || 0} issues\n`;
      if (r.findings) text += `  🔍 ${r.findings} trouvailles\n`;
      if (r.tablesWithoutRls) text += `  ⚠️ ${r.tablesWithoutRls} tables sans RLS\n`;
      if (r.critical) text += `  🚨 ${r.critical} critiques\n`;
    }
    await sendMessageWithKeyboard(chatId, text, SECURITY_MENU);
    return true;
  }
  
  if (text === '📦 Vulnérabilités Dépendances') {
    const result = await executeFunction('check_vulnerabilities', { fix: false }, chatId);
    let text = `📦 <b>Vulnérabilités Dépendances</b>\n\n`;
    if (result.error) {
      text += `❌ ${result.error}`;
    } else {
      text += `📊 <b>Total :</b> ${result.total}\n`;
      text += `🚨 <b>Critiques :</b> ${result.critical}\n`;
      text += `🔴 <b>Hautes :</b> ${result.high}\n`;
      text += `🟡 <b>Modérées :</b> ${result.moderate}\n`;
      text += `🟢 <b>Faibles :</b> ${result.low}\n\n`;
      if (result.vulnerabilities && result.vulnerabilities.length > 0) {
        text += `<b>Top 10 :</b>\n`;
        for (const v of result.vulnerabilities) {
          text += `• ${v.package} [${v.severity.toUpperCase()}] - ${v.title}\n`;
        }
        text += `\n💡 Utilise "Corriger Issue" → "dependencies" pour tenter un fix auto`;
      } else {
        text += `✅ Aucune vulnérabilité critique détectée`;
      }
    }
    await sendMessageWithKeyboard(chatId, text, SECURITY_MENU);
    return true;
  }
  
  if (text === '🛡️ Politiques RLS') {
    const result = await executeFunction('check_rls_policies', {}, chatId);
    let text = `🛡️ <b>Politiques RLS (Row Level Security)</b>\n\n`;
    if (result.error) {
      text += `❌ ${result.error}`;
    } else {
      text += `📊 <b>Tables sans RLS :</b> ${result.tablesWithoutRls}\n`;
      if (result.tablesWithoutRlsList.length > 0) {
        text += `⚠️ ${result.tablesWithoutRlsList.join(', ')}\n`;
      }
      text += `📋 <b>Total politiques :</b> ${result.totalPolicies}\n`;
      text += `🔄 <b>Politiques récursives :</b> ${result.recursivePoliciesFound ? 'OUI ⚠️' : 'Non'}\n`;
      if (result.recursivePoliciesFound) {
        text += `\n🚨 <b>Politiques récursives détectées :</b>\n`;
        for (const p of result.recursivePolicies) {
          text += `• ${p.table}.${p.policy}\n`;
        }
        text += `\n💡 Exécutez supabase/fix_missing_columns.sql dans Supabase Dashboard`;
      }
      text += `\n\n📋 <b>Politiques par table :</b>\n`;
      for (const [table, policies] of Object.entries(result.policiesByTable)) {
        text += `• ${table}: ${(policies as any[]).length} politiques\n`;
      }
    }
    await sendMessageWithKeyboard(chatId, text, SECURITY_MENU);
    return true;
  }
  
  if (text === '🔐 Secrets Exposés') {
    const result = await executeFunction('check_env_secrets', {}, chatId);
    let text = `🔐 <b>Scan Secrets Exposés</b>\n\n`;
    if (result.error) {
      text += `❌ ${result.error}`;
    } else {
      text += `📁 <b>Scanné :</b> ${result.scanned.join(', ')}\n`;
      text += `🔍 <b>Trouvailles :</b> ${result.findings}\n`;
      text += `🚨 <b>Critiques :</b> ${result.critical}\n\n`;
      if (result.details && result.details.length > 0) {
        text += `<b>Détails :</b>\n`;
        for (const d of result.details) {
          text += `• ${d.file} - ${d.type} (${d.count})\n`;
          text += `  <code>${d.preview}</code>\n`;
        }
        text += `\n💡 <b>Action requise :</b> Rotation immédiate des clés exposées !`;
      } else {
        text += `✅ Aucun secret détecté dans le code`;
      }
    }
    await sendMessageWithKeyboard(chatId, text, SECURITY_MENU);
    return true;
  }
  
  if (text === '📋 Headers Sécurité') {
    const result = await executeFunction('get_security_headers', {}, chatId);
    let text = `📋 <b>Headers de Sécurité Recommandés</b>\n\n`;
    if (result.error) {
      text += `❌ ${result.error}`;
    } else {
      text += `<b>Headers à implémenter :</b>\n`;
      for (const [header, value] of Object.entries(result.recommended)) {
        text += `• <code>${header}</code>: ${value}\n`;
      }
      text += `\n${result.implementation}`;
    }
    await sendMessageWithKeyboard(chatId, text, SECURITY_MENU);
    return true;
  }
  
  if (text === '👥 Permissions DB') {
    const result = await executeFunction('audit_database_permissions', {}, chatId);
    let text = `👥 <b>Audit Permissions Base de Données</b>\n\n`;
    if (result.error) {
      text += `❌ ${result.error}`;
    } else {
      text += `<b>Rôles personnalisés :</b> ${result.customRoles.length}\n`;
      for (const role of result.customRoles) {
        text += `• ${role.rolname} (login: ${role.rolcanlogin}, super: ${role.rolsuper}, bypassrls: ${role.rolbypassrls})\n`;
      }
      text += `\n<b>Permissions tables :</b>\n`;
      for (const [grantee, perms] of Object.entries(result.tablePermissions)) {
        text += `• ${grantee}: ${(perms as any[]).map(p => `${p.table}.${p.privilege}`).join(', ')}\n`;
      }
      text += `\n<b>Recommandations :</b>\n`;
      for (const rec of result.recommendations) {
        text += `• ${rec}\n`;
      }
    }
    await sendMessageWithKeyboard(chatId, text, SECURITY_MENU);
    return true;
  }
  
  if (text === '🔧 Corriger Issue') {
    await sendMessageWithKeyboard(chatId,
      `🔧 <b>Corriger une Issue de Sécurité</b>\n\n` +
      `Dis-moi : "Corrige [type] : [détails]"\n\n` +
      `<b>Types disponibles :</b>\n` +
      `• <code>rls</code> - Politiques RLS récursives\n` +
      `• <code>secrets</code> - Secrets exposés (guide rotation)\n` +
      `• <code>dependencies</code> - Vulnérabilités npm (audit fix)\n` +
      `• <code>headers</code> - Headers sécurité manquants\n` +
      `• <code>auth</code> - Config auth (guide)\n\n` +
      `Exemple : "Corrige dependencies : fix auto"`,
      SECURITY_MENU
    );
    return true;
  }
  
  // ElevenLabs TTS Menu Buttons
  if (text === '🗣️ ElevenLabs TTS') {
    await updateSessionContext(chatId, 'elevenlabs');
    await sendMessageWithKeyboard(chatId, '🗣️ <b>ElevenLabs Text-to-Speech</b>\n\n⚠️ Note: ElevenLabs fait du TTS (texte→voix), PAS de transcription (voix→texte).\nPour la transcription, utilisez les modèles Whisper.', ELEVENLABS_MENU);
    return true;
  }
  
  if (text === '🗣️ Générer Audio (TTS)') {
    await sendMessageWithKeyboard(chatId,
      `🗣️ <b>Générer Audio avec ElevenLabs</b>\n\n` +
      `Dis-moi : "Parle : [ton texte]"\n\n` +
      `Exemple : "Parle : Bienvenue sur OptiWifi, votre plateforme de gestion WiFi"\n\n` +
      `Le bot répondra avec un message vocal généré par ElevenLabs.`,
      ELEVENLABS_MENU
    );
    return true;
  }
  
  if (text === '🎭 Lister Voix Disponibles') {
    const result = await executeFunction('elevenlabs_list_voices', {}, chatId);
    let text = `🎭 <b>Voix ElevenLabs Disponibles</b>\n\n`;
    if (result.error) {
      text += `❌ ${result.error}\n\n💡 Configure ELEVENLABS_API_KEY sur Vercel Dashboard`;
    } else if (result.voices && result.voices.length > 0) {
      for (const v of result.voices.slice(0, 15)) {
        text += `• <b>${v.name}</b> (<code>${v.id}</code>) - ${v.category || 'custom'}\n`;
      }
      text += `\n💡 Pour utiliser une voix : "Parle avec la voix [nom] : [texte]"`;
    } else {
      text += `Aucune voix trouvée. Vérifiez la clé API ElevenLabs.`;
    }
    await sendMessageWithKeyboard(chatId, text, ELEVENLABS_MENU);
    return true;
  }
  
  if (text === '🎤 Test Voix (Rachel)') {
    const result = await executeFunction('elevenlabs_tts', { 
      text: 'Bonjour ! Je suis Rachel, une voix ElevenLabs. Bienvenue sur OptiWifi !', 
      voiceId: '21m00Tcm4TlvDq8ikWAM' 
    }, chatId);
    if (result.success) {
      await sendMessageWithKeyboard(chatId, `🎤 <b>Test voix Rachel généré</b>\n\nLe fichier audio est prêt (base64). Dans Telegram, il serait envoyé comme message vocal.`, ELEVENLABS_MENU);
    } else {
      await sendMessageWithKeyboard(chatId, `❌ Erreur: ${result.error}`, ELEVENLABS_MENU);
    }
    return true;
  }
  
  if (text === '🎤 Test Voix (Adam)') {
    const result = await executeFunction('elevenlabs_tts', { 
      text: 'Salut ! Je suis Adam, une voix masculine ElevenLabs. OptiWifi gère vos espaces WiFi.', 
      voiceId: 'pNInz6obpgDQGcFmaJgB' 
    }, chatId);
    if (result.success) {
      await sendMessageWithKeyboard(chatId, `🎤 <b>Test voix Adam généré</b>\n\nLe fichier audio est prêt (base64). Dans Telegram, il serait envoyé comme message vocal.`, ELEVENLABS_MENU);
    } else {
      await sendMessageWithKeyboard(chatId, `❌ Erreur: ${result.error}`, ELEVENLABS_MENU);
    }
    return true;
  }
  
  // Model Menu Buttons
  if (text === '🤖 Modèles IA') {
    await updateSessionContext(chatId, 'models');
    const modelInfo = (FREE_MODELS[session.model as keyof typeof FREE_MODELS] as ModelInfo | undefined);
    await sendMessageWithKeyboard(chatId, 
      `🤖 <b>Gestion Modèles IA</b>\n\n` +
      `📌 <b>Modèle actuel :</b> ${modelInfo?.name || session.model}\n` +
      `🎯 <b>Mode :</b> ${session.auto_model ? 'Auto (choix intelligent)' : 'Manuel'}\n\n` +
      `Choisissez un modèle ou activez le mode Auto pour que le bot choisisse le meilleur selon la tâche :`,
      MODEL_MENU
    );
    return true;
  }
  
  if (text === '🤖 Modèle Actuel') {
    const modelInfo = (FREE_MODELS[session.model as keyof typeof FREE_MODELS] as ModelInfo | undefined);
    await sendMessageWithKeyboard(chatId,
      `🤖 <b>Modèle Actuel</b>\n\n` +
      `<b>Nom :</b> ${modelInfo?.name || session.model}\n` +
      `<b>ID :</b> <code>${session.model}</code>\n` +
      `<b>Contexte :</b> ${modelInfo?.context || 'N/A'} tokens\n` +
      `<b>Vision :</b> ${modelInfo?.vision ? '✅ Oui' : '❌ Non'}\n` +
      `<b>Audio/Transcription :</b> ${modelInfo?.audio ? '✅ Oui' : '❌ Non'}\n` +
      `<b>Provider :</b> ${modelInfo?.provider || 'N/A'}\n\n` +
      `Mode Auto : ${session.auto_model ? '✅ Activé' : '❌ Désactivé'}`,
      MODEL_MENU
    );
    return true;
  }
  
  if (text === '🔄 Mode Auto (Recommandé)') {
    const { query } = await import('@/lib/neon/db');
    await query(`
      UPDATE conversation_sessions 
      SET auto_model = true, updated_at = NOW() 
      WHERE chat_id = $1
    `, [chatId]);
    await sendMessageWithKeyboard(chatId,
      `✅ <b>Mode Auto activé</b>\n\n` +
      `Le bot choisira automatiquement le meilleur modèle selon :\n` +
      `• 🎙️ <b>Audio</b> → Whisper Large v3\n` +
      `• 👁️ <b>Images</b> → Phi-3 Vision\n` +
      `• 🧠 <b>Raisonnement complexe</b> → DeepSeek R1\n` +
      `• 💻 <b>Code/Technique</b> → DeepSeek Chat\n` +
      `• 📝 <b>Long contexte</b> → Llama 3.1 70B\n` +
      `• ⚡ <b>Réponses rapides</b> → Phi-3 Mini\n` +
      `• 💬 <b>Général</b> → DeepSeek Chat (défaut)\n\n` +
      `Vous pouvez toujours forcer un modèle via le menu ou en disant "utilise le modèle X"`,
      MODEL_MENU
    );
    return true;
  }
  
  if (text === '🧠 Reasoning (DeepSeek R1)') {
    await updateSessionModel(chatId, 'deepseek/deepseek-r1');
    await sendMessageWithKeyboard(chatId, '✅ Modèle changé pour <b>DeepSeek R1</b> (Reasoning complexe)', MODEL_MENU);
    return true;
  }
  
  if (text === '⚡ Rapide (Phi-3 Mini)') {
    await updateSessionModel(chatId, 'microsoft/phi-3-mini-128k-instruct');
    await sendMessageWithKeyboard(chatId, '✅ Modèle changé pour <b>Phi-3 Mini</b> (Rapide, 128k contexte)', MODEL_MENU);
    return true;
  }
  
  if (text === '💻 Code/Tech (DeepSeek Chat)') {
    await updateSessionModel(chatId, 'deepseek/deepseek-chat');
    await sendMessageWithKeyboard(chatId, '✅ Modèle changé pour <b>DeepSeek Chat</b> (Code, général)', MODEL_MENU);
    return true;
  }
  
  if (text === '📝 Long Contexte (Llama 70B)') {
    await updateSessionModel(chatId, 'meta-llama/llama-3.1-70b-instruct');
    await sendMessageWithKeyboard(chatId, '✅ Modèle changé pour <b>Llama 3.1 70B</b> (Qualité, 131k contexte)', MODEL_MENU);
    return true;
  }
  
  if (text === '👁️ Vision (Phi-3 Vision)') {
    await updateSessionModel(chatId, 'microsoft/phi-3-vision-128k-instruct');
    await sendMessageWithKeyboard(chatId, '✅ Modèle changé pour <b>Phi-3 Vision</b> (Analyse images, 128k contexte)', MODEL_MENU);
    return true;
  }
  
  if (text === '🎙️ Transcription (Whisper)') {
    await updateSessionTranscriptionModel(chatId, 'openai/whisper-large-v3');
    await sendMessageWithKeyboard(chatId, '✅ Modèle de transcription changé pour <b>Whisper Large v3</b>', MODEL_MENU);
    return true;
  }
  
  if (text === '📋 Voir Tous Modèles') {
    await sendMessageWithKeyboard(chatId, '📋 <b>Tous les modèles disponibles</b>\n\nCliquez pour sélectionner :', createModelSelectionInlineKeyboard());
    return true;
  }
  
  // Back to Main Menu
  if (text === '🔙 Menu Principal') {
    await updateSessionContext(chatId, 'general');
    await sendMessageWithKeyboard(chatId, '🏠 <b>Menu Principal</b>', MAIN_MENU);
    return true;
  }
  
  return false;
}

async function handleCommand(text: string, chatId: string, userName: string, session: any) {
  const command = text.split(' ')[0].toLowerCase();
  const args = text.split(' ').slice(1).join(' ');

  switch (command) {
    case '/start':
    case '/menu':
      await updateSessionContext(chatId, 'general');
      await sendMessageWithKeyboard(chatId, 
        `👋 Bonjour ${userName} ! Je suis ton assistant OptiWifi IA.\n\n` +
        `🤖 <b>Modèle actuel :</b> ${(FREE_MODELS[session.model as keyof typeof FREE_MODELS] as ModelInfo | undefined)?.name || session.model}\n\n` +
        `Choisis une action ci-dessous ou parle-moi naturellement !`,
        MAIN_MENU
      );
      break;

    case '/projet':
    case '/project':
      await updateSessionContext(chatId, 'project');
      await sendMessageWithKeyboard(chatId, '📁 <b>Menu Projet</b>', PROJECT_MENU);
      break;

    case '/database':
    case '/db':
    case '/base':
      await updateSessionContext(chatId, 'database');
      await sendMessageWithKeyboard(chatId, '🗄️ <b>Menu Base de Données</b>', DATABASE_MENU);
      break;

    case '/tâches':
    case '/tasks':
    case '/taches':
      await updateSessionContext(chatId, 'tasks');
      await sendMessageWithKeyboard(chatId, '📝 <b>Menu Tâches</b>', TASKS_MENU);
      break;

    case '/notifications':
    case '/notifs':
    case '/notif':
      await updateSessionContext(chatId, 'notifications');
      await sendMessageWithKeyboard(chatId, '🔔 <b>Menu Notifications</b>', NOTIFICATIONS_MENU);
      break;

    case '/utilisateurs':
    case '/users':
    case '/user':
      await updateSessionContext(chatId, 'users');
      await sendMessageWithKeyboard(chatId, '👥 <b>Menu Utilisateurs</b>', USERS_MENU);
      break;

    case '/nouveau':
    case '/newproject':
    case '/new':
      await updateSessionContext(chatId, 'new_project');
      await sendMessageWithKeyboard(chatId, '💡 <b>Nouveau Projet - Idées & Planification</b>', NEW_PROJECT_MENU);
      break;

    case '/securite':
    case '/security':
      await updateSessionContext(chatId, 'security');
      await sendMessageWithKeyboard(chatId, '🔒 <b>Sécurité & Audit</b>', SECURITY_MENU);
      break;

    case '/model':
    case '/modèle':
      await sendMessageWithKeyboard(chatId, '🤖 <b>Choisir le modèle IA :</b>', createModelSelectionInlineKeyboard());
      break;

    case '/historique':
    case '/history':
      const stats = await getConversationStats(chatId);
      await sendMessageWithKeyboard(chatId, 
        `📊 <b>Historique Conversation</b>\n\n` +
        `💬 Messages total : ${stats.total_messages}\n` +
        `👤 Tes messages : ${stats.user_messages}\n` +
        `🤖 Mes réponses : ${stats.assistant_messages}\n` +
        `🔧 Appels outils : ${stats.tool_messages}\n` +
        `📅 Premier msg : ${stats.first_message ? new Date(stats.first_message).toLocaleString('fr-FR') : 'N/A'}\n` +
        `📅 Dernier msg : ${stats.last_message ? new Date(stats.last_message).toLocaleString('fr-FR') : 'N/A'}`, MAIN_MENU, 'HTML');
      break;

    case '/effacer':
    case '/clear':
      await clearConversationHistory(chatId);
      await sendMessageWithKeyboard(chatId, '🗑️ Historique effacé. Nouvelle conversation !', MAIN_MENU);
      break;

    case '/aide':
    case '/help':
      await sendMessageWithKeyboard(chatId, 
        `🤖 <b>OptiWifi Bot IA - Commandes</b>\n\n` +
        `<b>Menus Principaux :</b>\n` +
        `• <code>/menu</code> - Menu principal\n` +
        `• <code>/projet</code> - Gestion projet\n` +
        `• <code>/database</code> - Base de données\n` +
        `• <code>/tâches</code> - Gestion tâches\n` +
        `• <code>/notifications</code> - Alertes & validations\n` +
        `• <code>/utilisateurs</code> - Users & espaces\n` +
        `• <code>/securite</code> - Sécurité & Audit\n` +
        `• <code>/nouveau</code> - Nouveau projet\n\n` +
        `<b>Configuration :</b>\n` +
        `• <code>/model</code> - Changer modèle IA\n` +
        `• <code>/historique</code> - Stats conversation\n` +
        `• <code>/effacer</code> - Reset conversation\n\n` +
        `<b>Fonctionnalités :</b>\n` +
        `• 🎙️ Messages vocaux → transcription auto\n` +
        `• 💬 Conversation naturelle + outils\n` +
        `• 🔧 Function calling (déploiement, DB, tâches, sécurité...)\n` +
        `• 🧠 Mémoire persistante (DB)\n` +
        `• 📋 Menus interactifs\n\n` +
        `<b>Exemples :</b>\n` +
        `• "Déploie le projet"\n` +
        `• "SELECT * FROM users LIMIT 5"\n` +
        `• "Crée une tâche : tests E2E"\n` +
        `• "Quelles features pour un SaaS ?"\n` +
        `• "Fais un audit sécurité complet"\n` +
        `• "Corrige les vulnérabilités npm"`, MAIN_MENU, 'HTML');
      break;

    default:
      await sendMessageWithKeyboard(chatId, `❓ Commande inconnue : <code>${command}</code>\n\nTape <code>/menu</code> pour le menu principal.`, MAIN_MENU);
  }
}

async function handleCallbackQuery(callbackQuery: any) {
  const chatId = callbackQuery.message.chat.id.toString();
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;
  const userName = callbackQuery.from?.first_name || 'Utilisateur';
  const authorizedChatId = process.env.TELEGRAM_CHAT_ID;

  if (chatId !== authorizedChatId) return;

  // Answer callback query
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQuery.id }),
  });

  const [action, ...params] = data.split(':');

  // Confirmation / annulation d'une action préparée par l'assistant
  if (action === 'act') {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }),
    }).catch(() => {});
    await sendBotMessage(chatId, await handleActionCallback(chatId, params[0], params[1] || ''));
    return;
  }

  switch (action) {
    case 'model': {
      const model = params.join(':');
      const modelInfo = FREE_MODELS[model as keyof typeof FREE_MODELS] as ModelInfo | undefined;
      const modelName = modelInfo?.name || model;
      
      // Check if it's a transcription model
      if (modelInfo?.audio) {
        await updateSessionTranscriptionModel(chatId, model);
        await sendTelegramMessage({
          chat_id: chatId,
          text: `✅ Modèle de transcription changé pour : <b>${modelName}</b>\n\nLes prochains messages vocaux utiliseront ce modèle.`,
          parse_mode: 'HTML',
        });
      } else {
        await updateSessionModel(chatId, model);
        await sendTelegramMessage({
          chat_id: chatId,
          text: `✅ Modèle de chat changé pour : <b>${modelName}</b>`,
          parse_mode: 'HTML',
        });
      }
      break;
    }

    case 'deploy': {
      if (params[0] === 'now') {
        const res = await fetch('https://api.vercel.com/v1/integrations/deploy/prj_sYLBGlV8d7PBEEiDbwJbq9qm9fdy/xsZKyhGwr2', { method: 'POST' });
        await sendMessageWithKeyboard(chatId, res.ok ? '🚀 Déploiement déclenché !' : '❌ Erreur déploiement', PROJECT_MENU);
      } else if (params[0] === 'status') {
        const token = process.env.VERCEL_TOKEN;
        if (token) {
          const res = await fetch('https://api.vercel.com/v6/deployments?projectId=prj_sYLBGlV8d7PBEEiDbwJbq9qm9fdy&limit=1', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          const dep = data.deployments?.[0];
          if (dep) {
            await sendMessageWithKeyboard(chatId,
              `📋 <b>Dernier Déploiement</b>\n\n` +
              `🆔 ${dep.uid}\n` +
              `📦 ${dep.name}\n` +
              `⚡ ${dep.state}\n` +
              `🕐 ${new Date(dep.createdAt).toLocaleString('fr-FR')}\n` +
              `🔗 <a href="${dep.url}">Voir</a>`, PROJECT_MENU, 'HTML');
          }
        } else {
          await sendMessageWithKeyboard(chatId, '❌ VERCEL_TOKEN non configuré', PROJECT_MENU);
        }
      }
      break;
    }

    case 'confirm': {
      const [actionType, itemId] = params;
      await sendMessageWithKeyboard(chatId, `✅ Confirmé : ${actionType} pour ${itemId}`, MAIN_MENU);
      break;
    }

    case 'cancel': {
      const [actionType, itemId] = params;
      await sendMessageWithKeyboard(chatId, `❌ Annulé : ${actionType} pour ${itemId}`, MAIN_MENU);
      break;
    }

    case 'task': {
      const [taskAction, taskId] = params;
      await sendMessageWithKeyboard(chatId, `📝 Tâche ${taskId} : ${taskAction}`, TASKS_MENU);
      break;
    }

    case 'val': {
      const [valAction, valId] = params;
      if (valAction === 'approve') {
        await sendMessageWithKeyboard(chatId, `✅ Validation ${valId} approuvée !`, NOTIFICATIONS_MENU);
      } else if (valAction === 'reject') {
        await sendMessageWithKeyboard(chatId, `❌ Validation ${valId} refusée.`, NOTIFICATIONS_MENU);
      } else if (valAction === 'reply') {
        await sendMessageWithKeyboard(chatId, `💬 Réponds à ce message pour donner ton avis sur ${valId}`, NOTIFICATIONS_MENU);
      }
      break;
    }
  }
}

function getContextualMenu(context: string) {
  const menus: Record<string, any> = {
    project: PROJECT_MENU,
    database: DATABASE_MENU,
    tasks: TASKS_MENU,
    notifications: NOTIFICATIONS_MENU,
    users: USERS_MENU,
    new_project: NEW_PROJECT_MENU,
  };
  return menus[context] || MAIN_MENU;
}
function formatTechnicalStatus(status: Awaited<ReturnType<typeof getTechnicalStatus>>): string {
  const fmt = (d: string) => new Date(d).toLocaleString('fr-FR', { timeZone: 'Africa/Abidjan', dateStyle: 'short', timeStyle: 'short' });
  const deployments = (list: unknown) =>
    Array.isArray(list)
      ? list.map((d) => `• ${d.etat === 'READY' ? '✅' : d.etat === 'ERROR' ? '❌' : '🔄'} ${fmt(d.date)} — ${toTelegramHtml(d.message || d.commit || '')} <code>${d.commit || ''}</code>`).join('\n') || '• aucun'
      : `• ⚠️ ${toTelegramHtml((list as { erreur?: string })?.erreur || 'indisponible')}`;
  const v = status.version_en_cours;
  const db = status.base_de_donnees as { ok?: boolean; latence_ms?: number };
  return (
    `📊 <b>Statut du projet OptiSpace</b>\n\n` +
    `🌐 https://www.optiwifi.site\n` +
    `🏷️ <b>Version en cours :</b> ${v.environnement} · <code>${v.commit || '—'}</code> ${toTelegramHtml(v.message || '')}\n` +
    `🗄️ <b>Base de données :</b> ${db.ok ? `✅ OK (${db.latence_ms} ms)` : '❌ injoignable'}\n\n` +
    `🚀 <b>Production</b>\n${deployments(status.deploiements_production)}\n\n` +
    `🧪 <b>Preview (develop)</b>\n${deployments(status.deploiements_preview)}`
  );
}
