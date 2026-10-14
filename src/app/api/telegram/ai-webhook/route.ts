import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramMessage } from '@/lib/telegram';
import { query } from '@/lib/neon/db';
import { PROJECT_KNOWLEDGE, BOT_CAPABILITIES, AVAILABLE_TOOLS } from '@/lib/bot-knowledge';

// Conversation memory (in production, use Redis or database)
const conversationHistory = new Map<string, Array<{ role: string; content: string }>>();
const pendingValidations = new Map<string, any>();

// System prompt for the AI
const SYSTEM_PROMPT = `Tu es l'assistant IA d'OptiWifi, une plateforme SaaS de gestion WiFi.
Tu as accès aux outils ci-dessous pour exécuter des actions réelles.

RÈGLES :
1. Réponds en français, ton professionnel mais accessible
2. Utilise les outils pour les actions concrètes (déploiement, DB, notifications, etc.)
3. Demande confirmation avant actions destructives
4. Garde le contexte du projet OptiWifi
5. Si tu ne sais pas, dis-le et propose d'investiguer avec les outils
6. Maximum 3 appels d'outils par réponse

CONNAISSANCES PROJET :
${PROJECT_KNOWLEDGE}

CAPACITÉS :
${BOT_CAPABILITIES}

OUTILS DISPONIBLES : ${JSON.stringify(AVAILABLE_TOOLS, null, 2)}`;

// Simple tool executor
async function executeTool(name: string, args: any): Promise<any> {
  switch (name) {
    case 'trigger_deployment':
      const deployRes = await fetch('https://api.vercel.com/v1/integrations/deploy/prj_sYLBGlV8d7PBEEiDbwJbq9qm9fdy/xsZKyhGwr2', {
        method: 'POST',
      });
      return { success: deployRes.ok, message: 'Déploiement déclenché' };

    case 'check_deployment_status':
      const listRes = await fetch('https://api.vercel.com/v6/deployments?projectId=prj_sYLBGlV8d7PBEEiDbwJbq9qm9fdy&limit=1', {
        headers: { 'Authorization': `Bearer ${process.env.VERCEL_TOKEN || ''}` }
      });
      const deployments = await listRes.json();
      return deployments.deployments?.[0] || { message: 'Aucun déploiement trouvé' };

    case 'run_health_check':
      const healthRes = await fetch('https://www.optiwifi.site/api/cron/health-check', {
        headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET}` }
      });
      return await healthRes.json();

    case 'run_sql':
      if (!args.query.trim().toUpperCase().startsWith('SELECT')) {
        return { error: 'Seules les requêtes SELECT sont autorisées' };
      }
      const result = await query(args.query);
      return result;

    case 'check_slow_queries':
      const slowResult = await query(`
        SELECT query, mean_exec_time, calls, total_exec_time
        FROM pg_stat_statements
        WHERE mean_exec_time > ${args.thresholdMs || 1000}
        ORDER BY mean_exec_time DESC
        LIMIT 10
      `);
      return slowResult;

    case 'check_connection_pool':
      const poolResult = await query(`
        SELECT 
          count(*) as total_connections,
          count(*) filter (where state = 'active') as active_connections,
          count(*) filter (where state = 'idle') as idle_connections,
          setting::int as max_connections
        FROM pg_stat_activity, pg_settings
        WHERE pg_settings.name = 'max_connections'
      `);
      return poolResult;

    case 'send_notification':
      const notifTypes = {
        build: { type: 'build', project: 'OptiWifi', status: 'success', url: 'https://vercel.com/optiwifi' },
        database: { type: 'database', alertType: 'connection', database: 'neondb', message: args.message },
        error: { type: 'error', source: 'Bot IA', error: args.message, severity: args.severity || 'medium' },
        custom: { type: 'custom', title: args.title, message: args.message, emoji: '🤖' }
      };
      await fetch('https://www.optiwifi.site/api/telegram/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notifTypes[args.type as keyof typeof notifTypes] || notifTypes.custom)
      });
      return { success: true, message: 'Notification envoyée' };

    case 'create_validation_request':
      const valId = `val_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const validation = {
        id: valId,
        step: args.step,
        message: args.message,
        context: args.context,
        timestamp: Date.now(),
        status: 'pending'
      };
      pendingValidations.set(valId, validation);
      
      await fetch('https://www.optiwifi.site/api/ai/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'validation_needed',
          project: 'OptiWifi',
          step: args.step,
          message: args.message,
          context: args.context
        })
      });
      return { success: true, validationId: valId, message: 'Demande de validation créée' };

    case 'get_pending_validations':
      const pending = Array.from(pendingValidations.values()).filter(v => v.status === 'pending');
      return { validations: pending };

    case 'create_task':
      const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const task = {
        id: taskId,
        title: args.title,
        description: args.description,
        priority: args.priority,
        assignee: args.assignee || 'IA',
        status: 'pending',
        createdAt: Date.now()
      };
      // Store in memory (use DB in production)
      return { success: true, task };

    case 'list_tasks':
      // Return mock tasks for now
      return { tasks: [
        { id: 'task_1', title: 'Configurer email SMTP', status: 'pending', priority: 'high' },
        { id: 'task_2', title: 'Tests E2E Playwright', status: 'pending', priority: 'medium' },
        { id: 'task_3', title: 'Analytics avancés', status: 'pending', priority: 'low' }
      ]};

    case 'get_project_status':
      return {
        project: 'OptiWifi',
        status: 'active',
        lastDeploy: '2026-10-14',
        env: 'production',
        url: 'https://www.optiwifi.site',
        db: 'Neon (opti-wifi-db)',
        issues: ['SMTP credentials pending', 'No automated tests']
      };

    case 'create_user':
      // Would use Neon Auth API
      return { success: false, message: 'Nécessite implémentation Neon Auth' };

    case 'list_users':
      const usersResult = await query('SELECT id, email, role, created_at FROM users LIMIT 20');
      return usersResult;

    case 'get_space_stats':
      const spacesResult = await query('SELECT COUNT(*) as total, COUNT(*) filter (where is_active) as active FROM wifi_spaces');
      return spacesResult;

    default:
      return { error: `Outil inconnu: ${name}` };
  }
}

// Simulated LLM response with tool calling
async function generateAIResponse(userMessage: string, history: Array<{ role: string; content: string }>): Promise<{ text: string; toolCalls?: Array<{ name: string; args: any }> }> {
  // This is a simplified version - in production, use OpenAI/Claude API with function calling
  // For now, we'll use keyword matching to determine tool calls
  
  const lowerMsg = userMessage.toLowerCase();
  const toolCalls: Array<{ name: string; args: any }> = [];
  
  // Deployment triggers
  if (lowerMsg.includes('déploie') || lowerMsg.includes('deploy') || lowerMsg.includes('redéploie')) {
    toolCalls.push({ name: 'trigger_deployment', args: { reason: 'Demandé via bot Telegram' } });
  }
  
  // Status checks
  if (lowerMsg.includes('statut déploiement') || lowerMsg.includes('dernier déploiement')) {
    toolCalls.push({ name: 'check_deployment_status', args: {} });
  }
  
  // Health checks
  if (lowerMsg.includes('health check') || lowerMsg.includes('santé base') || lowerMsg.includes('vérifie la base')) {
    toolCalls.push({ name: 'run_health_check', args: {} });
  }
  
  // SQL queries
  if (lowerMsg.startsWith('select ') || lowerMsg.startsWith('query:')) {
    const sqlQuery = lowerMsg.startsWith('query:') ? userMessage.slice(6).trim() : userMessage;
    toolCalls.push({ name: 'run_sql', args: { query: sqlQuery } });
  }
  
  // Slow queries
  if (lowerMsg.includes('requêtes lentes') || lowerMsg.includes('slow queries')) {
    toolCalls.push({ name: 'check_slow_queries', args: {} });
  }
  
  // Connection pool
  if (lowerMsg.includes('pool connexion') || lowerMsg.includes('connection pool')) {
    toolCalls.push({ name: 'check_connection_pool', args: {} });
  }
  
  // Notifications
  if (lowerMsg.includes('notifie') || lowerMsg.includes('envoie notification')) {
    toolCalls.push({ name: 'send_notification', args: { 
      type: 'custom', 
      title: 'Notification via Bot', 
      message: userMessage 
    }});
  }
  
  // Validation requests
  if (lowerMsg.includes('demande validation') || lowerMsg.includes('valider que')) {
    toolCalls.push({ name: 'create_validation_request', args: {
      step: 'Validation demandée par utilisateur',
      message: userMessage,
      context: 'Conversation bot Telegram'
    }});
  }
  
  // Pending validations
  if (lowerMsg.includes('validations en attente') || lowerMsg.includes('en attente')) {
    toolCalls.push({ name: 'get_pending_validations', args: {} });
  }
  
  // Task management
  if (lowerMsg.includes('créer tâche') || lowerMsg.includes('nouvelle tâche') || lowerMsg.includes('add task')) {
    toolCalls.push({ name: 'create_task', args: {
      title: 'Tâche depuis bot',
      description: userMessage,
      priority: 'medium'
    }});
  }
  
  if (lowerMsg.includes('liste tâches') || lowerMsg.includes('mes tâches')) {
    toolCalls.push({ name: 'list_tasks', args: {} });
  }
  
  // Project status
  if (lowerMsg.includes('statut projet') || lowerMsg.includes('état du projet')) {
    toolCalls.push({ name: 'get_project_status', args: {} });
  }
  
  // Users
  if (lowerMsg.includes('liste utilisateurs') || lowerMsg.includes('utilisateurs')) {
    toolCalls.push({ name: 'list_users', args: {} });
  }
  
  // Space stats
  if (lowerMsg.includes('stats espaces') || lowerMsg.includes('espaces wifi')) {
    toolCalls.push({ name: 'get_space_stats', args: {} });
  }

  // Generate response text based on tool calls
  let responseText = '';
  
  if (toolCalls.length === 0) {
    // Conversational response
    if (lowerMsg.includes('bonjour') || lowerMsg.includes('salut') || lowerMsg.includes('hello')) {
      responseText = `👋 Salut ! Je suis ton assistant OptiWifi. Je peux t'aider avec :\n\n• 📊 **Statut projet** : déploiement, DB, santé\n• 🚀 **Actions** : déployer, health check, SQL\n• 🔔 **Notifications** : alertes, validations\n• 📝 **Tâches** : créer, lister, suivre\n• 👥 **Utilisateurs** : lister, stats espaces\n\nQu'est-ce que tu veux faire ?`;
    } else if (lowerMsg.includes('aide') || lowerMsg.includes('help') || lowerMsg.includes('que peux')) {
      responseText = `🤖 **Capacités du Bot OptiWifi**\n\n**🔧 Infrastructure**\n• Déclencher déploiement Vercel\n• Vérifier statut déploiements\n• Health check DB complet\n\n**🗄️ Base de Données**\n• Exécuter requêtes SQL (SELECT)\n• Surveiller requêtes lentes\n• Vérifier pool connexions\n\n**🔔 Notifications & Validations**\n• Envoyer notifications formatées\n• Créer demandes de validation\n• Voir validations en attente\n\n**📝 Gestion Projet**\n• Créer/lister tâches\n• Statut complet projet\n• Lister utilisateurs\n• Stats espaces WiFi\n\n**Exemples** :\n• "Déploie le projet"\n• "SELECT * FROM wifi_spaces LIMIT 5"\n• "Vérifie les requêtes lentes"\n• "Crée une tâche : ajouter tests E2E"\n• "Quel est le statut du projet ?"`;
    } else if (lowerMsg.includes('nouveau projet') || lowerMsg.includes('new project')) {
      responseText = `💡 **Nouveau Projet - Idées pour OptiWifi**\n\nBasé sur l'existant, voici des pistes :\n\n**🎯 Court terme**\n1. Tests automatisés (Playwright + CI)\n2. Monitoring erreurs (Sentry)\n3. Email SMTP fonctionnel\n4. API publique avec clés\n\n**🚀 Moyen terme**\n5. Analytics avancés (cohortes, LTV)\n6. Notifications push (Web + FCM)\n7. Multi-devise complet (XOF/EUR/USD)\n8. Marketplace templates/plugins\n\n**🏗️ Long terme**\n9. Mobile app native (React Native)\n10. White-label pour revendeurs\n11. IA intégrée (recommandations pricing)\n12. Audit logs complets\n\nVeux-tu que je crée une tâche pour l'une de ces idées ?`;
    } else {
      responseText = `🤔 Je comprends : "${userMessage}"\n\nJe peux t'aider avec des actions concrètes sur OptiWifi. Essaie :\n• "Déploie le projet"\n• "Statut du projet"\n• "SELECT * FROM users LIMIT 5"\n• "Crée une tâche : configurer SMTP"\n• "Vérifie la santé de la base"\n\nOu dis-moi ce que tu veux accomplir !`;
    }
  } else {
    responseText = `🔧 J'exécute ${toolCalls.length} action(s)...`;
  }

  return { text: responseText, toolCalls };
}

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

    // Get conversation history
    const history = conversationHistory.get(chatId) || [];
    history.push({ role: 'user', content: text });
    
    // Keep last 20 messages
    if (history.length > 20) history.splice(0, history.length - 20);

    // Generate AI response with tool calls
    const { text: aiResponse, toolCalls } = await generateAIResponse(text, history);
    
    // Execute tool calls
    let toolResults = '';
    if (toolCalls && toolCalls.length > 0) {
      for (const toolCall of toolCalls.slice(0, 3)) {
        try {
          const result = await executeTool(toolCall.name, toolCall.args);
          toolResults += `\n\n🔧 **${toolCall.name}** : ${JSON.stringify(result, null, 2).substring(0, 500)}`;
        } catch (error) {
          toolResults += `\n\n❌ **${toolCall.name}** : Erreur - ${error}`;
        }
      }
    }

    const finalResponse = aiResponse + toolResults;
    
    // Send response
    await sendTelegramMessage({
      chat_id: chatId,
      text: finalResponse.length > 4000 ? finalResponse.substring(0, 4000) + '...' : finalResponse,
      parse_mode: 'HTML',
    });

    // Save to history
    history.push({ role: 'assistant', content: finalResponse });
    conversationHistory.set(chatId, history);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('AI Bot error:', error);
    await sendTelegramMessage({
      chat_id: process.env.TELEGRAM_CHAT_ID || '',
      text: `❌ Erreur bot IA : ${error}`,
    });
    return NextResponse.json({ ok: true });
  }
}