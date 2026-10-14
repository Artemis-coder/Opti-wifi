/**
 * Function Definitions for OpenRouter Function Calling
 * These are passed to the LLM so it can call our tools
 */

export const FUNCTION_DEFINITIONS = [
  // Deployment
  {
    type: 'function',
    function: {
      name: 'trigger_deployment',
      description: 'Trigger a new Vercel deployment via deploy hook',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Reason for deployment' }
        },
        required: ['reason']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_deployment_status',
      description: 'Check the status of the latest Vercel deployment',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_deployments',
      description: 'List recent Vercel deployments',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 10 }
        }
      }
    }
  },

  // Database
  {
    type: 'function',
    function: {
      name: 'run_health_check',
      description: 'Run a comprehensive database health check',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_sql',
      description: 'Execute a SELECT SQL query on Neon database',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'SQL SELECT query' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_slow_queries',
      description: 'Check for slow queries in PostgreSQL',
      parameters: {
        type: 'object',
        properties: {
          thresholdMs: { type: 'number', description: 'Threshold in milliseconds', default: 1000 }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_connection_pool',
      description: 'Check PostgreSQL connection pool usage',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_space_stats',
      description: 'Get WiFi spaces statistics',
      parameters: { type: 'object', properties: {} }
    }
  },

  // Notifications & Validations
  {
    type: 'function',
    function: {
      name: 'send_notification',
      description: 'Send a formatted Telegram notification',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['build', 'database', 'error', 'custom'] },
          title: { type: 'string' },
          message: { type: 'string' },
          severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] }
        },
        required: ['type', 'title', 'message']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_validation_request',
      description: 'Create a validation request for the user',
      parameters: {
        type: 'object',
        properties: {
          step: { type: 'string', description: 'Validation step name' },
          message: { type: 'string', description: 'Detailed message' },
          context: { type: 'string', description: 'Technical context' }
        },
        required: ['step', 'message', 'context']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_pending_validations',
      description: 'Get all pending validation requests',
      parameters: { type: 'object', properties: {} }
    }
  },

  // Task Management
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a new development task',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
          assignee: { type: 'string', default: 'IA' }
        },
        required: ['title', 'description', 'priority']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_tasks',
      description: 'List tasks with optional status filter',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'in_progress', 'done', 'blocked'] }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_task_status',
      description: 'Update task status',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'in_progress', 'done', 'blocked'] }
        },
        required: ['taskId', 'status']
      }
    }
  },

  // Project Info
  {
    type: 'function',
    function: {
      name: 'get_project_status',
      description: 'Get complete project status',
      parameters: { type: 'object', properties: {} }
    }
  },

  // User Management
  {
    type: 'function',
    function: {
      name: 'list_users',
      description: 'List platform users',
      parameters: { type: 'object', properties: {} }
    }
  },

  // Context Management
  {
    type: 'function',
    function: {
      name: 'set_conversation_context',
      description: 'Set the conversation context for better responses',
      parameters: {
        type: 'object',
        properties: {
          context: { type: 'string', enum: ['project', 'general', 'new_project', 'database', 'deployment', 'tasks', 'notifications', 'users'] }
        },
        required: ['context']
      }
    }
  },

  // New Project Ideas
  {
    type: 'function',
    function: {
      name: 'suggest_project_features',
      description: 'Suggest features for a new project based on category',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: ['saas', 'ecommerce', 'mobile', 'analytics', 'ai', 'general'] },
          description: { type: 'string', description: 'Brief description of the project idea' }
        },
        required: ['category', 'description']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_project_spec',
      description: 'Create a project specification document',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          features: { type: 'array', items: { type: 'string' } },
          techStack: { type: 'array', items: { type: 'string' } },
          timeline: { type: 'string' }
        },
        required: ['name', 'description']
      }
    }
  }
];

// Function executor - maps function names to actual implementations
export async function executeFunction(name: string, args: any, chatId: string): Promise<any> {
  const { query } = await import('./neon/db');
  const { sendTelegramMessage } = await import('./telegram');
  const { sendMessageWithKeyboard, createConfirmationInlineKeyboard } = await import('./telegram-menus');
  const { addMessage } = await import('./conversation-memory');

  switch (name) {
    // Deployment
    case 'trigger_deployment': {
      const res = await fetch('https://api.vercel.com/v1/integrations/deploy/prj_sYLBGlV8d7PBEEiDbwJbq9qm9fdy/xsZKyhGwr2', {
        method: 'POST',
      });
      return { success: res.ok, message: res.ok ? 'Déploiement déclenché avec succès' : 'Erreur déploiement' };
    }

    case 'check_deployment_status': {
      const token = process.env.VERCEL_TOKEN;
      if (!token || token === 'your_vercel_token_here') return { error: 'VERCEL_TOKEN non configuré sur Vercel Dashboard' };
      
      const res = await fetch('https://api.vercel.com/v6/deployments?projectId=prj_sYLBGlV8d7PBEEiDbwJbq9qm9fdy&limit=5', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      return data.deployments?.[0] || { message: 'Aucun déploiement trouvé' };
    }

    case 'list_deployments': {
      const token = process.env.VERCEL_TOKEN;
      if (!token || token === 'your_vercel_token_here') return { error: 'VERCEL_TOKEN non configuré sur Vercel Dashboard' };
      
      const limit = args.limit || 10;
      const res = await fetch(`https://api.vercel.com/v6/deployments?projectId=prj_sYLBGlV8d7PBEEiDbwJbq9qm9fdy&limit=${limit}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      return data.deployments || [];
    }

    // Database
    case 'run_health_check': {
      const res = await fetch('https://www.optiwifi.site/api/cron/health-check', {
        headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET}` }
      });
      return await res.json();
    }

    case 'run_sql': {
      if (!args.query.trim().toUpperCase().startsWith('SELECT')) {
        return { error: 'Seules les requêtes SELECT sont autorisées pour des raisons de sécurité' };
      }
      const result = await query(args.query);
      return result;
    }

    case 'check_slow_queries': {
      const result = await query(`
        SELECT query, mean_exec_time, calls, total_exec_time
        FROM pg_stat_statements
        WHERE mean_exec_time > ${args.thresholdMs || 1000}
        ORDER BY mean_exec_time DESC
        LIMIT 10
      `);
      return result;
    }

    case 'check_connection_pool': {
      const result = await query(`
        SELECT 
          count(*) as total_connections,
          count(*) filter (where state = 'active') as active_connections,
          count(*) filter (where state = 'idle') as idle_connections,
          setting::int as max_connections,
          round(count(*)::numeric / setting::int * 100, 1) as usage_percent
        FROM pg_stat_activity, pg_settings
        WHERE pg_settings.name = 'max_connections'
      `);
      return result;
    }

    case 'get_space_stats': {
      const result = await query(`
        SELECT 
          COUNT(*) as total_spaces,
          COUNT(*) filter (where is_active) as active_spaces,
          COUNT(*) filter (where is_active = false) as inactive_spaces
        FROM wifi_spaces
      `);
      return result;
    }

    // Notifications
    case 'send_notification': {
      const notifTypes: Record<string, any> = {
        build: { type: 'build', project: 'OptiWifi', status: 'success', url: 'https://vercel.com/optiwifi' },
        database: { type: 'database', alertType: 'connection', database: 'neondb', message: args.message },
        error: { type: 'error', source: 'Bot IA', error: args.message, severity: args.severity || 'medium' },
        custom: { type: 'custom', title: args.title, message: args.message, emoji: '🤖' }
      };
      
      await fetch('https://www.optiwifi.site/api/telegram/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notifTypes[args.type] || notifTypes.custom)
      });
      return { success: true, message: 'Notification envoyée' };
    }

    case 'create_validation_request': {
      const valId = `val_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
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
      
      // Also send with inline keyboard for easy response
      await sendMessageWithKeyboard(
        chatId,
        `⏳ <b>Validation Requise</b>\n\n📋 <b>Étape :</b> ${args.step}\n💬 <b>Message :</b> ${args.message}\n📝 <b>Contexte :</b> ${args.context}`,
        createValidationInlineKeyboard(valId)
      );
      
      return { success: true, validationId: valId, message: 'Demande de validation créée et envoyée' };
    }

    case 'get_pending_validations': {
      // This would query a validations table - simplified for now
      return { validations: [], message: 'Aucune validation en attente' };
    }

    // Tasks
    case 'create_task': {
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
      // In production, save to DB
      return { success: true, task };
    }

    case 'list_tasks': {
      // Mock tasks - replace with DB query
      return { 
        tasks: [
          { id: 'task_1', title: 'Configurer email SMTP', status: 'pending', priority: 'high' },
          { id: 'task_2', title: 'Tests E2E Playwright', status: 'pending', priority: 'medium' },
          { id: 'task_3', title: 'Analytics avancés', status: 'pending', priority: 'low' }
        ].filter(t => !args.status || t.status === args.status)
      };
    }

    case 'update_task_status': {
      return { success: true, message: `Tâche ${args.taskId} mise à jour: ${args.status}` };
    }

    // Project
    case 'get_project_status': {
      return {
        project: 'OptiWifi',
        status: 'active',
        lastDeploy: '2026-10-14',
        env: 'production',
        url: 'https://www.optiwifi.site',
        db: 'Neon (opti-wifi-db)',
        issues: ['SMTP credentials pending', 'No automated tests']
      };
    }

    // Users
    case 'list_users': {
      const result = await query('SELECT id, email, role, created_at FROM users LIMIT 20');
      return result;
    }

    // Context
    case 'set_conversation_context': {
      const { updateSessionContext } = await import('./conversation-memory');
      await updateSessionContext(chatId, args.context);
      return { success: true, message: `Contexte défini sur: ${args.context}` };
    }

    // New Project
    case 'suggest_project_features': {
      const features = getProjectFeatureSuggestions(args.category, args.description);
      return { success: true, features };
    }

    case 'create_project_spec': {
      const specId = `spec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      // Save to DB in production
      return { success: true, specId, message: 'Spécification créée' };
    }

    default:
      return { error: `Function not implemented: ${name}` };
  }
}

function getProjectFeatureSuggestions(category: string, description: string): string[] {
  const baseFeatures: Record<string, string[]> = {
    saas: [
      'Authentification multi-tenant (organisations, équipes)',
      'Facturation abonnements (Stripe/Paddle)',
      'Dashboard admin avec analytics',
      'Gestion des rôles et permissions (RBAC)',
      'API publique avec clés API',
      'Webhooks pour intégrations',
      'Emails transactionnels + marketing',
      'Page de prix publique',
      'Onboarding utilisateur guidé',
      'Support multi-devise'
    ],
    ecommerce: [
      'Catalogue produits avec variants',
      'Panier + checkout (Stripe/PayPal)',
      'Gestion stocks temps réel',
      'Commandes + suivi livraison',
      'Avis clients + notes',
      'Codes promo + réductions',
      'Wishlist + comparaison',
      'Recommandations IA',
      'Multi-langue + multi-devise',
      'Back-office admin complet'
    ],
    mobile: [
      'React Native / Flutter app',
      'Auth biométrique (FaceID/TouchID)',
      'Mode hors-ligne + sync',
      'Notifications push (FCM/APNs)',
      'App Store / Play Store deploy',
      'Deep linking + universal links',
      'Analytics in-app (Mixpanel/Amplitude)',
      'Achats in-app + abonnements',
      'Mode sombre/clair',
      'Accessibilité (VoiceOver/TalkBack)'
    ],
    analytics: [
      'Tracking événements temps réel',
      'Funnels de conversion',
      'Cohortes + rétention',
      'Dashboards personnalisables',
      'Alertes seuils automatiques',
      'Export CSV/PDF/Excel',
      'API pour données brutes',
      'Segmentation utilisateurs',
      'Attribution marketing (UTM)',
      'RGPD/CCPA compliant'
    ],
    ai: [
      'Chatbot RAG sur docs internes',
      'Génération contenu (texte/images)',
      'Classification + tagging auto',
      'Recommandations personnalisées',
      'Détection anomalies (fraude)',
      'NLP pour support client',
      'Fine-tuning modèles spécialisés',
      'Vector DB (Pinecone/Weaviate)',
      'Prompt engineering + eval',
      'Coûts + monitoring tokens'
    ],
    general: [
      'Auth sécurisée (OAuth2, MFA)',
      'Base de données (PostgreSQL/MySQL)',
      'Cache Redis + CDN',
      'CI/CD (GitHub Actions/GitLab)',
      'Monitoring (Sentry, Datadog)',
      'Logs centralisés (ELK/Loki)',
      'Tests (unit, integration, e2e)',
      'Documentation (OpenAPI/Swagger)',
      'Infrastructure as Code (Terraform)',
      'Backup + disaster recovery'
    ]
  };

  return baseFeatures[category] || baseFeatures.general;
}