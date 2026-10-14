import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramMessage, formatCustomNotification } from '@/lib/telegram';
import { getValidation, updateValidation, getPendingValidations } from '@/app/api/ai/validation/route';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = body.message;
    
    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id.toString();
    const text = message.text.trim();
    const userName = message.from?.first_name || 'Utilisateur';

    // Only respond to authorized chat
    const authorizedChatId = process.env.TELEGRAM_CHAT_ID;
    if (chatId !== authorizedChatId) {
      await sendTelegramMessage({
        chat_id: chatId,
        text: '❌ Non autorisé. Ce bot est privé.',
      });
      return NextResponse.json({ ok: true });
    }

    // Handle commands
    if (text.startsWith('/')) {
      await handleCommand(chatId, text, userName);
      return NextResponse.json({ ok: true });
    }

    // Handle validation responses
    const pending = getPendingValidations();
    if (pending.length > 0) {
      // Match response to most recent pending validation
      const latest = pending[0];
      await handleValidationResponse(chatId, latest.id, text, userName);
      return NextResponse.json({ ok: true });
    }

    // Handle conversational messages
    await handleConversation(chatId, text, userName);
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ ok: true });
  }
}

async function handleCommand(chatId: string, text: string, userName: string) {
  const command = text.split(' ')[0].toLowerCase();

  switch (command) {
    case '/start':
    case '/aide':
    case '/help':
      await sendTelegramMessage({
        chat_id: chatId,
        text: `🤖 <b>OptiWifi Bot - Commandes</b>\n\n` +
          `<b>Validations :</b>\n` +
          `• Répondez simplement au message de validation\n` +
          `• <code>/valider</code> - Approuver la dernière demande\n` +
          `• <code>/refuser</code> - Refuser la dernière demande\n` +
          `• <code>/en_attente</code> - Voir les validations en attente\n\n` +
          `<b>Conversation :</b>\n` +
          `• Écrivez-moi naturellement, je réponds !\n` +
          `• Ex: "Quel est le statut du déploiement ?"\n\n` +
          `<b>Infos :</b>\n` +
          `• <code>/statut</code> - État du système\n` +
          `• <code>/test</code> - Test de notification\n\n` +
          `<b>Projet :</b> OptiWifi`,
        parse_mode: 'HTML',
      });
      break;

    case '/statut':
    case '/status':
      await sendTelegramMessage({
        chat_id: chatId,
        text: `📊 <b>Statut OptiWifi</b>\n\n` +
          `✅ Bot Telegram : Connecté\n` +
          `✅ API : En ligne\n` +
          `✅ Base de données : Neon (opti-wifi-db)\n` +
          `✅ Déploiement : Vercel (www.optiwifi.site)`,
        parse_mode: 'HTML',
      });
      break;

    case '/test':
      await sendTelegramMessage({
        chat_id: chatId,
        text: '🧪 <b>Test de notification</b>\n\nMessage de test reçu avec succès !',
        parse_mode: 'HTML',
      });
      break;

    case '/valider':
    case '/approuver':
      await handleQuickValidation(chatId, 'approved', userName);
      break;

    case '/refuser':
    case '/rejeter':
      await handleQuickValidation(chatId, 'rejected', userName);
      break;

    case '/en_attente':
    case '/pending':
      await showPendingValidations(chatId);
      break;

    default:
      await sendTelegramMessage({
        chat_id: chatId,
        text: `❓ Commande inconnue : <code>${command}</code>\n\nUtilisez <code>/aide</code> pour la liste.`,
        parse_mode: 'HTML',
      });
  }
}

async function handleConversation(chatId: string, text: string, userName: string) {
  const lowerText = text.toLowerCase();
  
  // Intelligent responses based on keywords
  if (lowerText.includes('statut') || lowerText.includes('status') || lowerText.includes('ça va') || lowerText.includes('comment')) {
    await sendTelegramMessage({
      chat_id: chatId,
      text: `👋 Salut ${userName} ! Ça va bien, merci.\n\n` +
        `📊 <b>Statut rapide :</b>\n` +
        `✅ Bot : Opérationnel\n` +
        `✅ API : En ligne\n` +
        `✅ DB Neon : Connectée\n` +
        `✅ Vercel : Déployé\n\n` +
        `Besoin de plus de détails ? Tape <code>/statut</code>.`,
      parse_mode: 'HTML',
    });
    return;
  }

  if (lowerText.includes('déploi') || lowerText.includes('deploy') || lowerText.includes('build')) {
    await sendTelegramMessage({
      chat_id: chatId,
      text: `🚀 <b>Déploiement</b>\n\n` +
        `Dernier déploiement : <b>Production</b> ✅\n` +
        `URL : <a href="https://www.optiwifi.site">www.optiwifi.site</a>\n` +
        `Branche : main\n\n` +
        `Pour déclencher un redéploiement, poussez sur main ou utilisez le hook Vercel.`,
      parse_mode: 'HTML',
    });
    return;
  }

  if (lowerText.includes('base') || lowerText.includes('db') || lowerText.includes('database') || lowerText.includes('néon') || lowerText.includes('neon')) {
    await sendTelegramMessage({
      chat_id: chatId,
      text: `🗄️ <b>Base de données Neon</b>\n\n` +
        `Projet : <b>opti-wifi-db</b>\n` +
        `Endpoint : <code>ep-flat-term-aymd9rhb</code>\n` +
        `Région : us-east-2\n\n` +
        `Health check quotidien à 9h (cron).\n` +
        `Pour test manuel : <code>/test</code> puis vérifiez les logs.`,
      parse_mode: 'HTML',
    });
    return;
  }

  if (lowerText.includes('erreur') || lowerText.includes('error') || lowerText.includes('bug') || lowerText.includes('problème')) {
    await sendTelegramMessage({
      chat_id: chatId,
      text: `🔴 <b>Erreurs / Problèmes</b>\n\n` +
        `Le bot capture automatiquement :\n` +
        `• Erreurs client (React)\n` +
        `• Erreurs API (server-side)\n` +
        `• Alertes DB (connexions, requêtes lentes)\n\n` +
        `Pour voir les dernières alertes, je peux vous envoyer un résumé.\n` +
        `Voulez-vous que je lance un health check DB maintenant ?`,
      parse_mode: 'HTML',
    });
    return;
  }

  if (lowerText.includes('aide') || lowerText.includes('help') || lowerText.includes('commande') || lowerText.includes('quoi')) {
    await handleCommand(chatId, '/aide', userName);
    return;
  }

  // Default conversational response
  await sendTelegramMessage({
    chat_id: chatId,
    text: `💬 <b>Message reçu :</b> "${text}"\n\n` +
      `Je comprends les commandes (<code>/aide</code>) et certains mots-clés :\n` +
      `• <b>statut</b>, <b>déploiement</b>, <b>base</b>, <b>erreur</b>\n\n` +
      `Pour les validations IA, répondez simplement au message de validation.`,
    parse_mode: 'HTML',
  });
}

async function handleValidationResponse(chatId: string, validationId: string, response: string, userName: string) {
  const validation = updateValidation(validationId, 'instructions', response);
  
  if (validation) {
    await sendTelegramMessage({
      chat_id: chatId,
      text: `✅ <b>Réponse enregistrée</b>\n\n` +
        `📋 <b>Validation :</b> ${validation.step}\n` +
        `💬 <b>Votre réponse :</b> ${response}\n\n` +
        `L'IA a été notifiée et va continuer le travail.`,
      parse_mode: 'HTML',
    });
  }
}

async function handleQuickValidation(chatId: string, action: 'approved' | 'rejected', userName: string) {
  const pending = getPendingValidations();
  
  if (pending.length === 0) {
    await sendTelegramMessage({
      chat_id: chatId,
      text: 'ℹ️ Aucune validation en attente.',
    });
    return;
  }

  const latest = pending[0];
  const response = action === 'approved' ? '✅ Approuvé - Continue le travail' : '❌ Refusé - Arrête cette tâche';
  
  updateValidation(latest.id, action === 'approved' ? 'approved' : 'rejected', response);
  
  await sendTelegramMessage({
    chat_id: chatId,
    text: `${action === 'approved' ? '✅' : '❌'} <b>Validation ${action === 'approved' ? 'approuvée' : 'refusée'}</b>\n\n` +
      `📋 <b>Étape :</b> ${latest.step}\n` +
      `💬 <b>Action :</b> ${response}`,
    parse_mode: 'HTML',
  });
}

async function showPendingValidations(chatId: string) {
  const pending = getPendingValidations();
  
  if (pending.length === 0) {
    await sendTelegramMessage({
      chat_id: chatId,
      text: '✅ Aucune validation en attente.',
    });
    return;
  }

  let text = `⏳ <b>Validations en attente (${pending.length})</b>\n\n`;
  
  for (const v of pending) {
    const timeAgo = Math.round((Date.now() - v.timestamp) / 60000);
    text += `📋 <b>${v.step}</b> (${v.project})\n`;
    text += `💬 ${v.message}\n`;
    text += `⏱️ Il y a ${timeAgo} min\n\n`;
  }
  
  text += `Répondez à ce message ou utilisez <code>/valider</code> / <code>/refuser</code>.`;
  
  await sendTelegramMessage({
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  });
}