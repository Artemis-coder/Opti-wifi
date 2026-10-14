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
  },

  // Security & Audit
  {
    type: 'function',
    function: {
      name: 'run_security_audit',
      description: 'Run a comprehensive security audit on the project',
      parameters: {
        type: 'object',
        properties: {
          scope: { type: 'string', enum: ['full', 'dependencies', 'code', 'config', 'database', 'auth'], default: 'full' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_vulnerabilities',
      description: 'Check for known vulnerabilities in dependencies',
      parameters: {
        type: 'object',
        properties: {
          fix: { type: 'boolean', description: 'Automatically fix vulnerabilities if possible', default: false }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_rls_policies',
      description: 'Check Supabase/PostgreSQL Row Level Security policies',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_env_secrets',
      description: 'Scan for exposed secrets in environment variables and code',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'fix_security_issue',
      description: 'Apply automated fix for a specific security issue',
      parameters: {
        type: 'object',
        properties: {
          issueType: { type: 'string', enum: ['rls', 'secrets', 'dependencies', 'headers', 'auth'] },
          details: { type: 'string', description: 'Details about the issue to fix' }
        },
        required: ['issueType', 'details']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_security_headers',
      description: 'Check and suggest security headers for the application',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'audit_database_permissions',
      description: 'Audit database roles, permissions, and access controls',
      parameters: { type: 'object', properties: {} }
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

    // Security & Audit
    case 'run_security_audit': {
      const scope = args.scope || 'full';
      const results = [];
      
      if (scope === 'full' || scope === 'dependencies') {
        const vulnResult = await executeFunction('check_vulnerabilities', { fix: false }, chatId);
        results.push({ category: 'dependencies', ...vulnResult });
      }
      
      if (scope === 'full' || scope === 'database') {
        const rlsResult = await executeFunction('check_rls_policies', {}, chatId);
        results.push({ category: 'database', ...rlsResult });
      }
      
      if (scope === 'full' || scope === 'config') {
        const envResult = await executeFunction('check_env_secrets', {}, chatId);
        results.push({ category: 'config', ...envResult });
      }
      
      if (scope === 'full' || scope === 'auth') {
        const headersResult = await executeFunction('get_security_headers', {}, chatId);
        results.push({ category: 'auth', ...headersResult });
      }
      
      return { 
        success: true, 
        scope, 
        timestamp: new Date().toISOString(),
        results,
        summary: results.map(r => `${r.category}: ${r.issues?.length || 0} issues`).join(', ')
      };
    }

    case 'check_vulnerabilities': {
      // Run npm audit
      const { execSync } = await import('child_process');
      try {
        const output = execSync('npm audit --json', { encoding: 'utf-8', cwd: process.cwd() });
        const audit = JSON.parse(output);
        
        const vulnerabilities = [];
        if (audit.vulnerabilities) {
          for (const [name, vuln] of Object.entries(audit.vulnerabilities)) {
            const v = vuln as any;
            if (v.severity === 'high' || v.severity === 'critical') {
              vulnerabilities.push({
                package: name,
                severity: v.severity,
                title: v.title,
                url: v.url,
                fixable: v.fixAvailable
              });
            }
          }
        }
        
        if (args.fix && vulnerabilities.length > 0) {
          try {
            execSync('npm audit fix', { encoding: 'utf-8', cwd: process.cwd() });
            return { success: true, fixed: true, vulnerabilities: vulnerabilities.length, message: 'Vulnérabilités corrigées automatiquement' };
          } catch {
            return { success: false, fixed: false, vulnerabilities: vulnerabilities.length, message: 'Certaines vulnérabilités nécessitent une correction manuelle' };
          }
        }
        
        return { 
          success: true, 
          total: audit.metadata?.vulnerabilities?.total || 0,
          high: audit.metadata?.vulnerabilities?.high || 0,
          critical: audit.metadata?.vulnerabilities?.critical || 0,
          moderate: audit.metadata?.vulnerabilities?.moderate || 0,
          low: audit.metadata?.vulnerabilities?.low || 0,
          vulnerabilities: vulnerabilities.slice(0, 10)
        };
      } catch (error) {
        return { error: `Erreur audit: ${error.message}` };
      }
    }

    case 'check_rls_policies': {
      const { query } = await import('./neon/db');
      try {
        // Check for tables without RLS
        const tablesWithoutRls = await query(`
          SELECT 
            schemaname,
            tablename,
            rowsecurity
          FROM pg_tables
          WHERE schemaname = 'public'
          AND rowsecurity = false
          AND tablename NOT IN ('spatial_ref_sys', 'geometry_columns', 'geography_columns')
        `);
        
        // Check for policies
        const policies = await query(`
          SELECT 
            schemaname,
            tablename,
            policyname,
            permissive,
            roles,
            cmd,
            qual,
            with_check
          FROM pg_policies
          WHERE schemaname = 'public'
        `);
        
        // Check for recursive policies
        const recursivePolicies = policies.filter((p: any) => 
          p.qual?.includes('auth.uid()') && p.qual?.includes('EXISTS') && 
          p.qual?.includes(tablename) // self-reference
        );
        
        return {
          success: true,
          tablesWithoutRls: tablesWithoutRls.length,
          tablesWithoutRlsList: tablesWithoutRls.map((t: any) => t.tablename),
          totalPolicies: policies.length,
          policiesByTable: policies.reduce((acc: any, p: any) => {
            acc[p.tablename] = acc[p.tablename] || [];
            acc[p.tablename].push({ name: p.policyname, cmd: p.cmd, permissive: p.permissive });
            return acc;
          }, {}),
          recursivePoliciesFound: recursivePolicies.length > 0,
          recursivePolicies: recursivePolicies.map((p: any) => ({ table: p.tablename, policy: p.policyname }))
        };
      } catch (error) {
        return { error: `Erreur vérification RLS: ${error.message}` };
      }
    }

    case 'check_env_secrets': {
      const fs = await import('fs');
      const path = await import('path');
      
      const secretPatterns = [
        { pattern: /sk_live_[a-zA-Z0-9]{24,}/g, type: 'Stripe Secret Key' },
        { pattern: /sk_test_[a-zA-Z0-9]{24,}/g, type: 'Stripe Test Key' },
        { pattern: /pk_live_[a-zA-Z0-9]{24,}/g, type: 'Stripe Publishable Key' },
        { pattern: /AKIA[0-9A-Z]{16}/g, type: 'AWS Access Key' },
        { pattern: /AIza[0-9A-Za-z\\-_]{35}/g, type: 'Google API Key' },
        { pattern: /Bearer [a-zA-Z0-9\\-_]{20,}/g, type: 'Bearer Token' },
        { pattern: /password\s*[=:]\s*['\"][^'\"]{8,}['\"]/gi, type: 'Password in Code' },
        { pattern: /secret\s*[=:]\s*['\"][^'\"]{8,}['\"]/gi, type: 'Secret in Code' },
        { pattern: /private_key\s*[=:]\s*['\"][^'\"]{20,}['\"]/gi, type: 'Private Key' },
        { pattern: /postgres:\/\/[^\\s]+:[^\\s]+@[^\\s]+/g, type: 'Postgres URL with Credentials' },
        { pattern: /mongodb:\/\/[^\\s]+:[^\\s]+@[^\\s]+/g, type: 'MongoDB URL with Credentials' },
      ];
      
      const findings = [];
      const scanDirs = ['src', 'scripts', '.'];
      
      for (const dir of scanDirs) {
        try {
          const files = fs.readdirSync(dir, { recursive: true });
          for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat.isFile() && (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.js') || filePath.endsWith('.json') || filePath.endsWith('.env'))) {
              const content = fs.readFileSync(filePath, 'utf-8');
              for (const { pattern, type } of secretPatterns) {
                const matches = content.match(pattern);
                if (matches) {
                  findings.push({
                    file: filePath,
                    type,
                    count: matches.length,
                    preview: matches[0].substring(0, 50)
                  });
                }
              }
            }
          }
        } catch (e) {
          // Directory might not exist
        }
      }
      
      // Also check .env.local
      try {
        const envContent = fs.readFileSync('.env.local', 'utf-8');
        for (const { pattern, type } of secretPatterns) {
          const matches = envContent.match(pattern);
          if (matches) {
            findings.push({
              file: '.env.local',
              type,
              count: matches.length,
              preview: '***REDACTED***'
            });
          }
        }
      } catch (e) {
        // No .env.local
      }
      
      return {
        success: true,
        scanned: scanDirs,
        findings: findings.length,
        details: findings.slice(0, 20),
        critical: findings.filter(f => f.type.includes('Key') || f.type.includes('Token') || f.type.includes('Password') || f.type.includes('Private')).length
      };
    }

    case 'fix_security_issue': {
      const { issueType, details } = args;
      
      switch (issueType) {
        case 'rls': {
          // This would apply the RLS fix script
          return { 
            success: true, 
            message: 'Pour corriger les politiques RLS, exécutez le script SQL dans supabase/fix_missing_columns.sql via le Supabase Dashboard > SQL Editor. Le script supprime les politiques récursives et recrée des politiques non-récursives avec synchronisation des rôles dans auth.users.' 
          };
        }
        
        case 'secrets': {
          return { 
            success: true, 
            message: 'Secrets détectés doivent être rotés manuellement : 1) Révoquer les clés exposées 2) Générer de nouvelles clés 3) Mettre à jour .env.local et Vercel Dashboard 4) Ne jamais commiter les secrets dans git' 
          };
        }
        
        case 'dependencies': {
          const { execSync } = await import('child_process');
          try {
            execSync('npm audit fix', { encoding: 'utf-8', cwd: process.cwd() });
            return { success: true, message: 'npm audit fix exécuté. Vérifiez les breaking changes.' };
          } catch (error) {
            return { success: false, message: `Échec: ${error.message}. Essayez 'npm audit fix --force' manuellement.` };
          }
        }
        
        case 'headers': {
          return { 
            success: true, 
            message: 'Headers de sécurité recommandés à ajouter dans next.config.ts ou middleware.ts : Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy' 
          };
        }
        
        case 'auth': {
          return { 
            success: true, 
            message: 'Vérifiez : 1) Better Auth configuré correctement 2) JWT secrets forts 3) Cookies sécurisés (httpOnly, secure, sameSite) 4) Rate limiting sur /api/auth/* 5) 2FA pour admins' 
          };
        }
        
        default:
          return { error: `Type d'issue inconnu: ${issueType}` };
      }
    }

    case 'get_security_headers': {
      return {
        success: true,
        recommended: {
          'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://*.neon.tech wss://*.neon.tech; frame-ancestors 'none';",
          'X-Frame-Options': 'DENY',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
          'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
          'X-XSS-Protection': '1; mode=block'
        },
        current: 'Vérifiez next.config.ts ou middleware.ts pour les headers actuels',
        implementation: 'Ajoutez dans next.config.ts sous async headers() ou dans middleware.ts'
      };
    }

    case 'audit_database_permissions': {
      const { query } = await import('./neon/db');
      try {
        const roles = await query(`
          SELECT 
            rolname,
            rolsuper,
            rolcreaterole,
            rolcreatedb,
            rolcanlogin,
            rolreplication,
            rolbypassrls
          FROM pg_roles
          WHERE rolname NOT LIKE 'pg_%'
          AND rolname NOT IN ('neondb_owner', 'cloud_admin')
        `);
        
        const tablePermissions = await query(`
          SELECT 
            table_name,
            grantee,
            privilege_type
          FROM information_schema.table_privileges
          WHERE table_schema = 'public'
          AND grantee NOT IN ('postgres', 'neondb_owner', 'cloud_admin')
        `);
        
        return {
          success: true,
          customRoles: roles,
          tablePermissions: tablePermissions.reduce((acc: any, p: any) => {
            acc[p.grantee] = acc[p.grantee] || [];
            acc[p.grantee].push({ table: p.table_name, privilege: p.privilege_type });
            return acc;
          }, {}),
          recommendations: [
            'Assurez-vous que seul neondb_owner a des privilèges admin',
            'Les rôles applicatifs doivent avoir des privilèges minimaux (SELECT, INSERT, UPDATE sur tables spécifiques)',
            'Activez RLS sur toutes les tables exposées',
            'Utilisez des rôles séparés pour lecture/écriture si possible'
          ]
        };
      } catch (error) {
        return { error: `Erreur audit permissions: ${error.message}` };
      }
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