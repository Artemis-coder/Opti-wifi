export const PROJECT_KNOWLEDGE = `
# OptiWifi - Contexte Projet Complet

## Description Générale
OptiWifi (OptiSpace) est une plateforme SaaS de gestion de points de vente WiFi, allocations de tickets et encaissements. C'est une application Next.js 16 + React 19 + TypeScript déployée sur Vercel avec base de données Neon (PostgreSQL).

## Stack Technique
- **Frontend** : Next.js 16.3.3 (App Router), React 19, TypeScript 5
- **Styling** : Tailwind CSS 4, Material Design 3 custom components
- **Database** : Neon PostgreSQL (serverless) avec @neondatabase/serverless
- **Auth** : better_auth + JWT custom, middleware de protection routes
- **Deployment** : Vercel (production: www.optiwifi.site)
- **Email** : Nodemailer + Gmail SMTP (configuré mais credentials pending)
- **Mobile** : Flutter app (opti_wifi_mobile/) connectée via Neon Data API

## Architecture Base de Données (Neon)
Tables principales :
- **wifi_spaces** : Points de vente WiFi (Les Oliviers, Malik wifi en Bas à Abidjan)
- **users** : Utilisateurs avec rôles (admin, super_admin, vendeur)
- **subscriptions** : Abonnements avec quotas
- **allocations** : Allocations de tickets
- **payments** : Encaissements
- **platform_users** : Utilisateurs plateforme (super_admin)

## Fonctionnalités Actuelles
1. **Dashboard admin** : KPIs, graphiques, gestion espaces WiFi
2. **Gestion allocations** : Création, échange, suivi tickets
3. **Encaissements** : Paiements, historique, rapports
4. **Multi-tenant** : Organisations, espaces, utilisateurs
5. **Auth complète** : Login, register, reset password, rôles
6. **Offline-first** : Queue mutations, sync automatique
7. **Internationalisation** : FR/EN (next-intl)
8. **Real-time** : Connection status, toasts (sonner)

## APIs Disponibles
- \`/api/telegram/webhook\` - Bot Telegram interactif
- \`/api/telegram/notify\` - Notifications (build, DB, erreurs, custom)
- \`/api/ai/notify\` - Notifications IA (validation, task_complete, blocker)
- \`/api/ai/validation\` - Gestion validations bidirectionnelles
- \`/api/cron/health-check\` - Health check DB (cron quotidien 9h)
- \`/api/auth/*\` - Authentification complète
- \`/api/platform/*\` - Administration plateforme
- \`/api/allocations/*\` - Gestion allocations
- \`/api/pos/*\` - Points de vente

## Déploiement & CI/CD
- **Vercel** : Auto-deploy sur push main
- **Deploy Hook** : ID xsZKyhGwr2 pour déclenchement externe
- **Cron** : Quotidien 9h (health check DB)
- **Env vars** : TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, CRON_SECRET, DATABASE_URL, JWT_SECRET, SMTP_*

## Problèmes Connus / En Cours
1. Email SMTP : Credentials Gmail en attente (2FA + app password)
2. RLS Supabase : Policies récursives fixées (script supabase/fix_missing_columns.sql)
3. Pas de tests automatisés configurés
4. Pas de monitoring APM (Sentry, etc.)

## Idées Nouvelles Fonctionnalités
1. **Analytics avancés** : Cohortes, rétention, LTV par espace
2. **Notifications push** : Web push + mobile (FCM)
3. **API publique** : Clés API pour intégrations tierces
4. **Marketplace** : Templates d'espaces, plugins
5. **Multi-devise** : Support XOF/EUR/USD complet
6. **Audit logs** : Traçabilité complète actions admin
7. **Backup auto** : Restore point-in-time Neon
8. **Tests E2E** : Playwright + CI GitHub Actions
`;

export const BOT_CAPABILITIES = `
# Capacités du Bot OptiWifi

## Actions Exécutables (Function Calling)
Le bot peut EXÉCUTER ces actions via outils :

### Déploiement & Infra
- \`trigger_deployment\` : Déclencher un déploiement Vercel
- \`check_deployment_status\` : Vérifier statut dernier déploiement
- \`run_health_check\` : Lancer health check DB manuel

### Base de Données
- \`run_sql\` : Exécuter requête SQL read-only sur Neon
- \`check_slow_queries\` : Vérifier requêtes lentes
- \`check_connection_pool\` : Vérifier pool connexions

### Notifications & Validations
- \`send_notification\` : Envoyer notification Telegram (build, DB, erreur, custom)
- \`create_validation_request\` : Créer demande validation pour l'utilisateur
- \`get_pending_validations\` : Récupérer validations en attente

### Projet & Code
- \`create_task\` : Créer tâche de développement
- \`list_tasks\` : Lister tâches en cours
- \`get_project_status\` : Statut complet projet (git, deps, build)

### Gestion Utilisateurs/Admin
- \`create_user\` : Créer utilisateur (via Neon Auth)
- \`list_users\` : Lister utilisateurs
- \`get_space_stats\` : Stats espaces WiFi

## Comportement Conversationnel
- Mémoire de conversation (derniers 20 messages)
- Contexte projet permanent
- Ton professionnel mais accessible
- Propose des actions concrètes
- Demande confirmation avant actions destructives
`;

export const AVAILABLE_TOOLS = [
  {
    name: "trigger_deployment",
    description: "Déclenche un nouveau déploiement Vercel via deploy hook",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Raison du déploiement" }
      },
      required: ["reason"]
    }
  },
  {
    name: "check_deployment_status",
    description: "Vérifie le statut du dernier déploiement Vercel",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "run_health_check",
    description: "Lance un health check complet de la base de données Neon",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "run_sql",
    description: "Exécute une requête SQL SELECT sur la base Neon (read-only)",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Requête SQL (SELECT uniquement)" }
      },
      required: ["query"]
    }
  },
  {
    name: "check_slow_queries",
    description: "Vérifie les requêtes lentes dans PostgreSQL",
    parameters: {
      type: "object",
      properties: {
        thresholdMs: { type: "number", description: "Seuil en ms", default: 1000 }
      }
    }
  },
  {
    name: "check_connection_pool",
    description: "Vérifie l'utilisation du pool de connexions PostgreSQL",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "send_notification",
    description: "Envoie une notification Telegram formatée",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["build", "database", "error", "custom"] },
        title: { type: "string" },
        message: { type: "string" },
        severity: { type: "string", enum: ["low", "medium", "high", "critical"] }
      },
      required: ["type", "title", "message"]
    }
  },
  {
    name: "create_validation_request",
    description: "Crée une demande de validation pour l'utilisateur Telegram",
    parameters: {
      type: "object",
      properties: {
        step: { type: "string", description: "Étape/nom de la validation" },
        message: { type: "string", description: "Message détaillé" },
        context: { type: "string", description: "Contexte technique" }
      },
      required: ["step", "message", "context"]
    }
  },
  {
    name: "get_pending_validations",
    description: "Récupère les validations en attente de réponse",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "create_task",
    description: "Crée une tâche de développement dans le backlog",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        priority: { type: "string", enum: ["high", "medium", "low"] },
        assignee: { type: "string", description: "IA ou user" }
      },
      required: ["title", "description", "priority"]
    }
  },
  {
    name: "list_tasks",
    description: "Liste les tâches en cours",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["pending", "in_progress", "done", "blocked"] }
      }
    }
  },
  {
    name: "get_project_status",
    description: "Récupère le statut complet du projet",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "create_user",
    description: "Crée un utilisateur via Neon Auth",
    parameters: {
      type: "object",
      properties: {
        email: { type: "string", format: "email" },
        name: { type: "string" },
        role: { type: "string", enum: ["admin", "vendeur", "super_admin"] }
      },
      required: ["email", "name", "role"]
    }
  },
  {
    name: "list_users",
    description: "Liste les utilisateurs de la plateforme",
    parameters: { type: "object", properties: {} }
  },
  {
    name: "get_space_stats",
    description: "Récupère les statistiques des espaces WiFi",
    parameters: { type: "object", properties: {} }
  }
];