# Guide de Configuration des Environnements — OptiWifi / OptiSpace

Ce document détaille l'architecture des environnements, l'isolation de la base de données Neon et la configuration des variables d'environnement pour **Local Development**, **Vercel Preview** et **Vercel Production**.

---

## 1. Vue d'ensemble des Environnements

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GITHUB REPOSITORY                              │
├──────────────────────────────┬──────────────────────────────────────────────┤
│  Branche: develop            │  Branche: main                               │
│  Branches: feature/*         │                                              │
└──────────────┬───────────────┴──────────────────────┬───────────────────────┘
               │                                      │
               ▼ (Push)                               ▼ (Push / Merge contrôlé)
┌──────────────────────────────┐       ┌──────────────────────────────────────┐
│        VERCEL PREVIEW        │       │          VERCEL PRODUCTION           │
│   (Environnement: Preview)   │       │      (Environnement: Production)     │
│   Déploiement URL éphémère   │       │         www.optiwifi.site            │
└──────────────┬───────────────┘       └──────────────────────┬───────────────┘
               │                                              │
               ▼ (Connexion SSL)                              ▼ (Connexion SSL)
┌──────────────────────────────┐       ┌──────────────────────────────────────┐
│       NEON BRANCHE DEV       │       │       NEON BRANCHE PRODUCTION        │
│       Nom: vercel-dev        │       │       Nom: production (Primary)      │
│   Host: ep-crimson-shape-*** │       │       Host: ep-flat-term-***         │
│   Données de test isolées    │       │       Données réelles clients        │
└──────────────────────────────┘       └──────────────────────────────────────┘
```

---

## 2. Correspondance Branches Git ↔ Environnements Vercel

| Environnement | Source Git | Déclenchement | Base de données cible | Protection |
|---|---|---|---|---|
| **Local** | `develop` ou `feature/*` | `npm run dev` sur machine locale | Neon `vercel-dev` | Garde-fou code actif |
| **Vercel Preview** | `develop`, `feature/*` | Push sur GitHub | Neon `vercel-dev` | Variables Vercel "Preview" |
| **Vercel Production** | `main` | Merge approuvé dans `main` | Neon `production` | Domaine de prod, verrouillage strict |

---

## 3. Détails des Bases Neon

Le projet Neon associé est `opti-wifi-db` (`young-firefly-47620691`, AWS us-east-2).

### 3.1. Branche Production (Zone Protégée)
- **ID :** `br-snowy-art-ayqjy3b5`
- **Nom :** `production`
- **Statut :** Primary / Default
- **Signature d'hôte :** `ep-flat-term-aymd9rhb`
- **Rôle :** Accueille les données réelles des utilisateurs et clients en production.
- **Règles :**
  - Aucune commande de développement ou de test ne doit cibler cette base.
  - Les migrations manuelles doivent être précédées d'une sauvegarde (`npm run backup`).

### 3.2. Branche Développement & Preview (Zone de Test Isolée)
- **ID :** `br-nameless-term-ayycr1gs`
- **Nom :** `develop`
- **Branche parente :** `production`
- **Statut :** Branche dédiée isolée
- **Signature d'hôte :** `ep-misty-night-ayhq9iik`
- **Rôle :** Base de données dédiée aux tests locaux, au développement quotidien sur `develop`, et aux déploiements Vercel Preview.
- **Règles :**
  - Données isolées créées par copie instantanée de la production.
  - Tout ajout de feature, migration ou test s'exécute exclusivement sur cette base.
  - Aucune incidence sur la production.

---

## 4. Configuration des Variables d'Environnement sur Vercel

Sur Vercel, les variables sont cloisonnées par environnement : **Production**, **Preview**, et **Development**.

### ⚠️ Action Requise : Configurer les Variables pour l'Environnement Preview
Actuellement, les variables nécessaires à l'application sont renseignées pour **Production**, mais **Preview** doit recevoir ses propres valeurs de test et pointer vers la base Neon de développement.

### Procédure dans le Dashboard Vercel :
1. Rendez-vous sur le dashboard Vercel : `https://vercel.com/` > Projet **opti-wifi** > **Settings** > **Environment Variables**.
2. Pour chaque variable ci-dessous, ajoutez ou cochez la case **Preview** :

| Variable | Valeur pour l'Environnement Preview | Notes |
|---|---|---|
| `DATABASE_URL` | Chaîne de connexion Neon `vercel-dev` (pooled) : `postgresql://neondb_owner:***@ep-crimson-shape-ayvbw15x-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require` | **Indispensable** pour isoler Preview de la production |
| `DATABASE_URL_UNPOOLED` | Chaîne Neon `vercel-dev` directe (non poolée) : `postgresql://neondb_owner:***@ep-crimson-shape-ayvbw15x.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require` | Pour opérations de schéma/migrations |
| `JWT_SECRET` | Secret aléatoire dédié aux tests (ex: 32+ caractères) | Évite d'utiliser le secret de production |
| `CRON_SECRET` | Chaîne secrète pour sécuriser les crons de test | Valeur de test |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Identifiants SMTP de test / sandbox | Pour tester les emails sans spammer la prod |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Clés de bot Telegram de test (ou sandbox) | Optionnel |
| `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `TOGETHER_API_KEY` | Clés API IA de test | Pour valider les fonctionnalités IA |

> 💡 **Astuce via Vercel CLI :**  
> Vous pouvez aussi ajouter une variable pour Preview via la ligne de commande :  
> `vercel env add DATABASE_URL preview`

---

## 5. Configuration Locale (`.env.local`)

Pour développer sur votre machine :
1. Copiez `.env.example` vers `.env.local` si ce n'est pas déjà fait :
   ```bash
   cp .env.example .env.local
   ```
2. Vérifiez que `DATABASE_URL` contient l'hôte de dev `ep-crimson-shape-ayvbw15x`.
3. Lancez le serveur local :
   ```bash
   npm run dev
   ```

---

## 6. Vérification de l'Isolation et Garde-fous Automatiques

Le projet intègre un module de garde-fou (`src/lib/env-guard.ts`) activé au cœur de la connexion Neon (`src/lib/neon/db.ts`).

### Comportement du Garde-fou :
- **Si l'application tourne en Preview ou Local Dev** et que la variable `DATABASE_URL` tente de pointer vers l'hôte de production (`ep-flat-term-aymd9rhb`), **l'accès est instantanément bloqué** avec une erreur explicite.
- **Si l'application tourne en Production** (`VERCEL_ENV === 'production'`) et qu'une base de dev est configurée, la connexion est également bloquée pour prévenir toute incohérence.

### Route de vérification `/api/debug-db` :
En vous authentifiant et en appelant `/api/debug-db`, l'application retourne un diagnostic sécurisé :
```json
{
  "ok": true,
  "environment": {
    "runtimeEnv": "preview",
    "isProduction": false,
    "isPreview": true,
    "isDevelopment": false,
    "databaseHost": "ep-crims***.c-5.us-east-2.aws.neon.tech",
    "isProductionDatabase": false,
    "isDevelopmentDatabase": true,
    "isIsolated": true
  }
}
```
Ce diagnostic vous permet de confirmer en 1 seconde sur un déploiement Preview que vous êtes connecté à la base isolée.

---

## 7. Migrations et Schéma en Développement

- Le schéma complet idempotent est versionné dans `supabase/neon_schema.sql`.
- Pour appliquer le schéma sur la base Neon de dev :
  ```bash
  DATABASE_URL="<dev_url>" node -e "
  const { neon } = require('@neondatabase/serverless');
  const fs = require('fs');
  const sql = neon(process.env.DATABASE_URL);
  // application du script neon_schema.sql
  "
  ```
- Les scripts `create_tables.mjs`, `alter_tables.mjs` et `scripts/migrate-to-neon.cjs` sont protégés par des garde-fous exigeant des drapeaux explicites (`CONFIRM_PROD=yes`, etc.) s'ils sont exécutés contre la production.
