<p align="center">
  <img src="public/assets/logo.jpg" alt="OptiSpace Logo" width="80" height="80" style="border-radius: 16px;" />
</p>

<h1 align="center">OptiSpace — Gestion des Tickets & Encaissements Wi-Fi</h1>

<p align="center">
  <strong>Plateforme SaaS multi-tenant de gestion des points de vente, allocations de tickets et encaissements pour les réseaux Wi-Fi communautaires.</strong>
</p>

<p align="center">
  <a href="https://www.optiwifi.site">🌐 Production</a> •
  <a href="#fonctionnalités">📋 Fonctionnalités</a> •
  <a href="#démarrage-rapide">🚀 Démarrage</a> •
  <a href="#architecture">🏗️ Architecture</a> •
  <a href="#api-routes">📡 API</a> •
  <a href="#déploiement">☁️ Déploiement</a>
</p>

<p align="center">
  <strong>Version actuelle : v1.6.1</strong> — <a href="./RELEASE_NOTES_v1.6.1.md">notes de version</a>
</p>

---

## Stack Technique

| Catégorie | Technologies |
|-----------|-------------|
| **Framework** | Next.js 16 (App Router), React 19, TypeScript 5 |
| **Styling** | Tailwind CSS 4, Design System Material 3 personnalisé |
| **Base de données** | Neon (PostgreSQL serverless) — migré depuis Supabase |
| **Auth** | JWT maison (cookie `neon-auth-token`, bcrypt) vérifié par le proxy Next.js (`src/proxy.ts`) |
| **State Management** | Zustand (auth, spaces, platform) |
| **Formulaires** | React Hook Form + Zod |
| **Graphiques** | Recharts |
| **UI Components** | Lucide React (icônes), Sonner (toasts) |
| **Email** | Nodemailer (SMTP Gmail) |
| **Déploiement** | Vercel — `main` → production, `develop` → Preview (`dev.optiwifi.site`) |
| **Monnaie** | FCFA (XOF) — marché Afrique francophone |

---

## Fonctionnalités

### 🏪 Points de Vente (POS)
- CRUD complet avec attribution de collecteur
- Vue détaillée par POS : 5 KPIs (alloués, vendus, restants, CA, commissions)
- Historique des allocations et collectes par POS
- Activation / Suspension d'un POS
- **🗑️ Remise à zéro** — Vidage complet des données d'un POS (allocations + collectes + items) avec modale de confirmation destructive (double validation par saisie de `VIDER`)

### 🎫 Types de Tickets
- Création de tarifs Wi-Fi (nom, durée en heures, prix FCFA)
- Activation / Désactivation des types de tickets
- Liaison optionnelle à un espace Wi-Fi

### 📦 Allocations de Tickets
- Attribution de stocks de tickets par POS
- Suivi temps réel : alloué / vendu / restant
- Historique complet avec traçabilité (qui a alloué, quand)

### 🔄 Échange de Tickets
- Assistant multi-étapes dédié (`/allocations/exchange`)
- Retour de tickets invendus et réception de nouveaux
- Vérification d'équivalence de valeur FCFA
- Fonction SQL transactionnelle atomique (`perform_ticket_exchange`)
- Badges visuels : `Rendu (Échange)` / `Reçu (Échange)` / `Allocation`

### 💰 Collectes & Encaissements
- Assistant en 5 étapes :
  1. Sélection du POS
  2. Saisie des quantités vendues (filtré par allocations du POS)
  3. Calcul automatique du montant attendu
  4. Saisie du montant réellement encaissé
  5. Validation finale avec détection d'écarts
- Gestion des commissions collecteurs
- Règle métier : la quantité vendue ne peut pas dépasser le stock disponible

### 🌐 Espaces Wi-Fi (Multi-sites)
- Gestion de zones/quartiers/sites distincts
- Rattachement des POS aux espaces
- Dashboard analytique par espace : 6 KPIs dédiés
- Verrouillage de l'attribution (pas de changement d'espace une fois rattaché)

### 📊 Dashboard Principal
- KPIs globaux : tickets alloués, vendus, CA total, écarts
- Raccourcis d'actions rapides
- Collectes récentes en un coup d'œil
- Graphiques de tendances (Recharts)

### 📈 Rapports & Exports
- Rapports consolidés multi-POS
- Export des données

### 👤 Gestion Utilisateurs
- Rôles : `administrateur` et `collecteur`
- RBAC — contrôle d'accès sur chaque page et API
- Création de comptes avec attribution de rôle

### ⚙️ Paramètres
- Configuration du profil, informations de l'organisation et rôle

### 💳 Abonnement & Licences
- Forfait actuel, date de fin et jours restants
- Utilisation du forfait : points de vente, membres, espaces (barres de quota)
- Demande de renouvellement ou de changement de forfait, **validée par le super admin**
- Quotas du forfait appliqués (membres, encaissements, allocations)
- Accès bloqué si l'inscription est en attente, refusée, l'espace désactivé ou la licence expirée (appliqué côté serveur)
- Forfait Découverte (essai) utilisable une seule fois par organisation
- Rappels automatiques à J-10, J-5 et J-2 avant l'expiration, puis après
- **Réabonnement par Wave** : « Me réabonner » → forfait → QR code « Payez avec Wave », numéro à copier, justificatif envoyé sur WhatsApp, « J'ai payé »
- **Factures de licence** émises à chaque activation payante, historique « Paiements et factures », téléchargement en PDF

### 👑 Back-office Super Admin (`/platform`)
- **Tableau de bord « À traiter »** : inscriptions à valider, demandes de licence, licences qui expirent, KPIs cliquables
- **Inscriptions** : valider ou refuser les comptes créés
- **Licences** : activer un forfait pour une durée (1 à 24 mois), prolonger, approuver / refuser les demandes
- **Clients** : fiche détaillée ; suspendre, réactiver ou supprimer un espace client (accès coupé immédiatement, données conservées)
- **Utilisateurs** : créer des administrateurs, changer un rôle, réinitialiser un mot de passe, désactiver ou supprimer un compte (révocation immédiate)
- **Statistiques** : inscriptions, abonnements par type, revenus, revenu mensuel récurrent, répartition des licences en cours
- **Moyens de paiement** : QR code, numéro, lien WhatsApp, logo et couleur de l'opérateur
- **Factures et transactions** avec chiffres clés (montants, renouvellements, par moyen de paiement)
- **Support** : tickets des clients, réponses, ouverture d'un ticket pour un client
- **Journal d'audit** lisible (avant → après), santé du bot Telegram
- **Forfaits**, abonnements, expirations, paramètres de la plateforme

### 🔔 Notifications
- Cloche dans l'application (client et super admin), mise à jour instantanée
- Notifications push du navigateur, reçues même site fermé
- Telegram pour le super admin (inscriptions, demandes de licence)
- Paramètres → Canaux de notification : activer le push et s'envoyer un test

### 🤖 Assistant Telegram du super admin
- Claude par défaut, relais automatique sur des modèles open source (Groq, OpenRouter, Together)
- Répond sur les vraies données : clients, licences, demandes, encaissements, statut technique
- Agit sur demande (approuver une licence, suspendre un espace…) après confirmation par bouton
- Boutons du menu utilisables même sans IA

### 📴 Mode Offline (Résilience Réseau)
- Détection réseau temps réel (`useOnlineStatus`)
- Indicateur visuel de connectivité dans la sidebar
- File d'attente d'actions hors-ligne avec sync automatique

### 🔐 Sécurité
- **Isolation multi-tenant côté serveur** : chaque client ne voit et ne modifie que les données de son organisation (`/api/db` + `src/lib/tenant.ts`)
- Page de connexion unique : redirection selon le rôle (super admin / client)
- **Mot de passe temporaire à changer** à la première connexion (`/change-password`)
- Proxy Next.js (`src/proxy.ts`) pour les routes protégées, en-têtes HTTP de sécurité
- Requêtes SQL paramétrées, identifiants validés, journal d'audit des actions super admin
- Pas de secrets hardcodés (`.env.local`, `.vercelignore`)

### 📱 Mobile-First
- Navigation bottom bar fixe sur mobile avec backdrop blur
- Sidebar en tiroir (bottom sheet) pleine largeur
- Zones de tap conformes (≥ 44×44px)
- Safe area insets (iPhone notch / home bar)
- Body scroll lock quand le tiroir est ouvert
- Toggle de visibilité mot de passe sur tous les formulaires
- Tableaux transformés en cartes sous 768 px (`ResponsiveTable`), barre de navigation en bas dans le back-office
- Calendrier, listes et confirmations intégrés au site (`DateField`, `CustomSelect`, `confirmAction`) au lieu des fenêtres natives du téléphone

---

## Architecture

### Structure du Projet

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/               # Connexion unique / inscription / récupération
│   │   └── change-password/     # Choix du mot de passe après un mot de passe temporaire
│   ├── (dashboard)/
│   │   ├── allocations/         # Gestion & historique des allocations
│   │   │   ├── exchange/        # Module d'échange de tickets
│   │   │   └── new/             # Nouvelle allocation
│   │   ├── collections/         # Assistant de collecte en 5 étapes
│   │   │   └── new/             # Nouvelle collecte
│   │   ├── dashboard/           # Dashboard principal avec KPIs
│   │   ├── pos/                 # Liste & détail des points de vente
│   │   │   └── [id]/            # Détail POS + remise à zéro
│   │   ├── reports/             # Rapports & exports
│   │   ├── settings/            # Paramètres utilisateur
│   │   ├── subscription/        # Abonnement, utilisation et demandes de licence
│   │   ├── spaces/              # Espaces Wi-Fi & dashboard par espace
│   │   │   └── [id]/            # Détail espace Wi-Fi
│   │   ├── tickets/             # Types de tickets
│   │   ├── users/               # Gestion utilisateurs (admin)
│   │   └── layout.tsx           # Layout dashboard (sidebar + header + bottom nav)
│   ├── api/
│   │   ├── allocations/exchange/ # API échange de tickets
│   │   ├── auth/                # Login, register, change-password, session
│   │   ├── db/                  # Passerelle de données (isolée par organisation)
│   │   ├── platform/            # APIs admin plateforme
│   │   ├── pos/[id]/reset/      # API remise à zéro POS
│   │   └── users/               # Gestion utilisateurs
│   ├── forgot-password/         # Page mot de passe oublié
│   ├── platform/                # Back-office super-admin
│   │   ├── audit-logs/          # Journaux d'audit
│   │   ├── clients/             # Gestion clients multi-tenant
│   │   ├── dashboard/           # Dashboard « À traiter » + KPIs
│   │   ├── registrations/       # Inscriptions à valider
│   │   ├── license-requests/    # Demandes de licence
│   │   ├── invoices/            # Facturation
│   │   ├── payments/            # Paiements
│   │   ├── plans/               # Plans d'abonnement
│   │   ├── reports/             # Rapports plateforme
│   │   ├── subscriptions/       # Abonnements & expirations
│   │   ├── users/               # Utilisateurs de la plateforme
│   │   ├── settings/            # Paramètres de la plateforme
│   │   └── support/             # Support client
│   └── reset-password/          # Réinitialisation mot de passe
├── components/
│   ├── layout/
│   │   ├── BottomNav.tsx        # Navigation mobile fixe
│   │   ├── Header.tsx           # Header sticky avec hamburger
│   │   └── Sidebar.tsx          # Sidebar desktop + tiroir mobile
│   ├── offline/                 # Composants mode hors-ligne
│   ├── platform/                # Composants back-office
│   └── ui/
│       ├── Badge.tsx            # Badges de statut
│       ├── Button.tsx           # Boutons (primary, secondary, ghost, danger)
│       ├── Card.tsx             # Conteneur carte
│       ├── Input.tsx            # Champs de formulaire (avec rightElement)
│       ├── Modal.tsx            # Modale standard
│       ├── PosSummary.tsx       # Résumé POS réutilisable
│       └── SpaceSummary.tsx     # Résumé espace réutilisable
├── hooks/
│   ├── useOfflineMutation.ts    # Mutations avec queue hors-ligne
│   └── useOnlineStatus.ts       # Détection réseau temps réel
├── lib/
│   ├── design-system.ts         # Tokens design system
│   ├── email.ts                 # Service email (Nodemailer)
│   ├── neon/                    # Client Neon DB (browser, server, edge)
│   ├── offline/                 # Queue & sync hors-ligne
│   ├── stores/
│   │   ├── authStore.ts         # Store Zustand auth
│   │   ├── platformAuthStore.ts # Store auth super-admin
│   │   └── spaceStore.ts        # Store espace sélectionné
│   ├── password-change.ts       # Règle de mot de passe, marqueur « à changer »
│   ├── quotas.ts                # Quotas du forfait
│   ├── tenant.ts                # Contexte de session et isolation par organisation
│   ├── supabase/                # Alias historiques vers les clients Neon
│   └── utils/
│       ├── cn.ts                # Utility class merging (clsx + tailwind-merge)
│       └── format.ts            # Formatage FCFA, dates FR
├── styles/                      # Styles globaux
└── types/
    └── database.ts              # Types TypeScript de toutes les tables
```

### Base de Données

```
┌──────────────┐     ┌───────────────────┐     ┌──────────────────┐
│ organizations│────▷│    profiles        │────▷│  points_of_sale  │
│              │     │ (users)           │     │                  │
└──────────────┘     └───────────────────┘     └────────┬─────────┘
                                                         │
        ┌──────────────┐                                │
        │ wifi_spaces  │◁───────────────────────────────┤
        └──────────────┘                                │
                                                         │
        ┌──────────────────┐     ┌───────────────────────┘
        │  ticket_types    │     │
        └───────┬──────────┘     │
                │                │
        ┌───────▽────────────────▽──┐
        │  ticket_allocations       │
        │  (type: allocation |      │
        │   exchange_return |       │
        │   exchange_receive)       │
        └───────────────────────────┘
                                    
        ┌────────────────┐     ┌─────────────────────┐
        │  collections   │────▷│  collection_items    │
        │  (par POS)     │     │  (par ticket type)   │
        └────────────────┘     └─────────────────────┘

        ┌────────────────────┐     ┌──────────────┐
        │  subscriptions     │────▷│  payments     │
        └───────┬────────────┘     └──────────────┘
                │
        ┌───────▽────────────┐     ┌──────────────────┐
        │ subscription_plans │◁────│ license_requests │
        └────────────────────┘     └──────────────────┘

        ┌────────────────┐     ┌─────────────────────┐
        │ platform_users │────▷│ platform_audit_logs │   (+ platform_settings)
        └────────────────┘     └─────────────────────┘
```

### Rôles & Permissions

| Fonctionnalité | Administrateur | Collecteur |
|---|:---:|:---:|
| Dashboard | ✅ | ✅ |
| Points de vente | ✅ CRUD | 👁️ Lecture |
| Allocations | ✅ Créer/Gérer | 👁️ Lecture |
| Échange de tickets | ✅ | ✅ |
| Collectes | ✅ | ✅ Créer |
| Rapports & Exports | ✅ | ❌ |
| Gestion Utilisateurs | ✅ | ❌ |
| Espaces Wi-Fi | ✅ CRUD | ❌ |
| Types de tickets | ✅ CRUD | ❌ |
| Paramètres | ✅ | ✅ (limité) |
| Vider un POS | ✅ | ❌ |
| Abonnement & demandes de licence | ✅ | ❌ |

Le **super admin** (table `platform_users`) gère toutes les organisations depuis `/platform` ; il n'a pas d'accès au contenu métier d'un client via l'espace client.

---

## API Routes

| Méthode | Route | Description | Rôle requis |
|---------|-------|-------------|-------------|
| `POST` | `/api/auth/login` | Connexion (indique si le mot de passe doit être changé) | Public |
| `POST` | `/api/auth/register` | Inscription (organisation en attente de validation) | Public |
| `POST` | `/api/auth/change-password` | Choisir son mot de passe | Connecté |
| `POST` | `/api/db` | Passerelle de données, filtrée par organisation | Connecté |
| `GET` | `/api/collections/[id]`, `/api/allocations/[id]` | Détail encaissement / allocation | Même organisation |
| `POST` | `/api/collections`, `/api/ticket-allocations` | Création avec contrôle de quota | Admin / Collecteur |
| `POST` | `/api/allocations/exchange` | Échange de tickets | Admin / Collecteur |
| `DELETE` | `/api/pos/[id]/reset` | Vider toutes les données d'un POS | Admin |
| `POST` | `/api/users/create` | Ajouter un membre (mot de passe à changer) | Admin |
| `DELETE` | `/api/users/[id]` | Supprimer un membre (désactivation) | Admin |
| `GET/POST` | `/api/subscriptions/renew` | État et demande de renouvellement | Admin |
| `POST` | `/api/platform/licenses` | Activer une licence | Super Admin |
| `GET/PATCH` | `/api/platform/license-requests` | Demandes de licence | Super Admin |
| `GET/POST/PATCH` | `/api/platform/users` | Comptes, rôles, réinitialisation | Super Admin |
| `GET/PATCH` | `/api/platform/settings` | Paramètres de la plateforme | Super Admin |
| `PATCH` | `/api/platform/clients/action` | Valider, suspendre, réactiver, supprimer une organisation | Super Admin |
| `POST` | `/api/platform/notifications/test` | Tester cloche, push et Telegram | Super Admin |
| `POST` | `/api/platform/assistant/test` | Tester l'assistant du bot | Super Admin |
| `GET/PATCH` | `/api/notifications` | Notifications de l'utilisateur, marquer comme lues | Connecté |
| `POST/DELETE` | `/api/notifications/push` | Abonnement push du navigateur | Connecté |
| `GET` | `/api/cron/licence-reminders` | Rappels de licence (quotidien, 8 h UTC) | `CRON_SECRET` |
| `POST` | `/api/telegram/ai-webhook-v2` | Webhook du bot Telegram | Secret Telegram |
| `GET` | `/api/payment-methods` | Moyens de paiement actifs (réabonnement) | Connecté |
| `GET` | `/api/invoices`, `/api/invoices/[id]` | Factures de l'organisation | Admin (ou super admin) |
| `GET/POST` | `/api/support`, `/api/support/[id]` | Tickets de l'organisation, réponses | Connecté |
| `GET/POST/PATCH/DELETE` | `/api/platform/payment-methods` | Moyens de paiement | Super Admin |
| `GET/POST/PATCH` | `/api/platform/support`, `/api/platform/support/[id]` | Tickets, réponses, statut | Super Admin |
| `GET/POST` | `/api/platform/bot-health` | Santé du bot (statuts seulement), réenregistrer le webhook | Super Admin |
| `GET/PATCH` | `/api/platform/*` | Autres APIs back-office | Super Admin |

---

## Démarrage Rapide

### Prérequis

- **Node.js** ≥ 20
- **npm** ≥ 9
- Accès à la branche Neon **de développement** (`vercel-dev`)

### Installation

```bash
# 1. Cloner le dépôt
git clone https://github.com/Artemis-coder/Opti-wifi.git
cd Opti-wifi

# 2. Installer les dépendances
npm install

# 3. Configurer les variables d'environnement
cp .env.example .env.local
# Remplir les valeurs dans .env.local (voir ci-dessous)

# 4. Lancer le serveur de développement
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

### Variables d'Environnement

Créer un fichier `.env.local` à la racine :

```bash
# ── Base de données (Neon — branche de DÉVELOPPEMENT uniquement) ──
DATABASE_URL=postgresql://<user>:<password>@ep-crimson-shape-xxx-pooler.../neondb?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://<user>:<password>@ep-crimson-shape-xxx.../neondb?sslmode=require

# ── Authentification ────────────────────────────────
JWT_SECRET=<secret aléatoire de 32+ caractères>
CRON_SECRET=<secret pour /api/cron/health-check>

# ── Email (SMTP) ────────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre@email.com
SMTP_PASS=votre-app-password
SMTP_SECURE=false

# ── Site URL ────────────────────────────────────────
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# ── Notifications push (clés VAPID de DÉVELOPPEMENT) ──
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<clé publique>
VAPID_PRIVATE_KEY=<clé privée>
VAPID_SUBJECT=mailto:support@optiwifi.site

# ── Bot Telegram et assistant (optionnel en local) ──
TELEGRAM_BOT_TOKEN=<jeton du bot>
TELEGRAM_CHAT_ID=<chat du super admin>
TELEGRAM_WEBHOOK_SECRET=<secret des webhooks>
ANTHROPIC_API_KEY=<clé API Anthropic>
GROQ_API_KEY=<relais open source>
```

> Telegram n'est envoyé qu'en production (sauf `TELEGRAM_NOTIFY_ENABLED=true`).
> Liste complète et environnements : [`RELEASE_NOTES_v1.3.0.md`](./RELEASE_NOTES_v1.3.0.md#️-configuration).

> ⚠️ **Ne jamais committer `.env.local`** — Ce fichier est exclu par `.gitignore`.
> Le garde-fou `src/lib/env-guard.ts` bloque toute connexion à la base de production depuis le local ou une Preview.
> Détails : [`docs/ENVIRONMENT_SETUP.md`](docs/ENVIRONMENT_SETUP.md).

### Base de Données

Exécuter le schéma initial dans le SQL Editor Neon ou Supabase :

```bash
# Schéma complet (toutes les tables + enums + index)
supabase/neon_schema.sql

# Migrations incrémentales (idempotentes), à tester d'abord sur la base dev
supabase/migrations/*.sql
```

---

## Scripts Disponibles

```bash
npm run dev          # Serveur de développement Next.js
npm run build        # Build de production
npm run start        # Serveur de production
npm run lint         # Linting ESLint

npx tsc --noEmit     # Vérification TypeScript (0 erreur requise)

npm run backup       # ⚠️ obsolète (API Supabase) — voir « Backup & Restauration »
npm run backup:list  # Lister les backups disponibles
npm run backup:restore=<file>  # Restaurer depuis un backup
npm run backup:clean # Nettoyer les anciens backups
```

---

## Backup & Restauration

> ⚠️ Depuis la migration vers Neon, `scripts/backup.js` (API Supabase) ne sauvegarde plus la vraie base.
> En attendant sa réécriture, faire une sauvegarde Neon directe en lecture seule (export JSON de toutes les tables
> dans `scripts/backups/`, dossier ignoré par Git) — voir [`docs/PROCEDURE_DEPLOIEMENT.md`](docs/PROCEDURE_DEPLOIEMENT.md).

### Backup manuel (ancien script)

```bash
bash scripts/backup.sh              # Créer un backup daté (JSON)
bash scripts/backup.sh --list       # Lister les backups
bash scripts/backup.sh --restore=<filename>  # Restaurer
bash scripts/backup.sh --clean=7    # Supprimer les backups > 7 jours
```

### Backup automatique (cron)

```bash
# Installer le cron pour un backup quotidien à 2h du matin
echo "0 2 * * * $(pwd)/scripts/cron_backup.sh" | crontab -
```

---

## Déploiement

> 📌 Procédure complète et obligatoire : [`docs/PROCEDURE_DEPLOIEMENT.md`](docs/PROCEDURE_DEPLOIEMENT.md)

| Branche | Environnement | URL | Base Neon |
|---|---|---|---|
| `develop` | Preview (automatique à chaque push) | https://dev.optiwifi.site | `vercel-dev` |
| `main` | Production (à la fusion d'une PR) | https://www.optiwifi.site | `production` |

### Cycle de travail

```bash
# 1. Travailler sur develop, à jour
git switch develop && git pull --ff-only origin develop

# 2. Vérifier avant chaque push
npx tsc --noEmit && npm run build

# 3. Pousser → Preview automatique sur dev.optiwifi.site
git push origin develop

# 4. Mise en production : sauvegarde + migrations, puis PR develop → main validée par le propriétaire
gh pr create --base main --head develop
```

**Interdits :** push forcé sur `develop` / `main`, `git reset --hard` sur une branche poussée, `vercel --prod`, commit direct sur `main`, données de test en production.
En cas de problème : *Instant Rollback* Vercel ou `git revert`, jamais de push forcé.

### Vérification post-déploiement

- [ ] Page de connexion accessible (`/login`), super admin → `/platform`, client → `/dashboard`
- [ ] `/api/cron/health-check` répond
- [ ] Dashboard se charge sans spinner infini
- [ ] Création d'un POS fonctionne
- [ ] Assistant de collecte en 5 étapes fonctionne
- [ ] Échange de tickets fonctionne
- [ ] Navigation mobile fixe en bas de l'écran

---

## Règles Métier

| Règle | Description |
|-------|------------|
| **Stock limité** | Un POS ne peut encaisser que les tickets qui lui ont été alloués |
| **Quantité plafonnée** | La quantité vendue ne peut pas dépasser le stock disponible (alloué − vendu) |
| **Collecte liée** | Chaque collecte est liée à un POS et un collecteur |
| **Échange équivalent** | Un échange doit avoir une valeur FCFA équivalente (retours = réceptions) |
| **Espace verrouillé** | Un POS rattaché à un espace Wi-Fi ne peut pas être déplacé |
| **Licence validée** | Un client ne prolonge pas sa licence lui-même : il envoie une demande que le super admin approuve |
| **Une demande à la fois** | Une seule demande de licence en attente par organisation |
| **Isolation** | Un utilisateur n'accède qu'aux données de son organisation |
| **Mot de passe personnel** | Un mot de passe temporaire doit être changé à la première connexion |
| **Admin seul** | Seul un administrateur peut vider les données d'un POS, gérer les utilisateurs et les espaces |

---

## Sécurité

Consulter [`AGENTS.md`](./AGENTS.md) pour les règles de sécurité complètes :

- 🔒 **Secret scanning** obligatoire avant chaque commit
- 🛡️ **SQL injection** — Requêtes paramétrées uniquement, identifiants validés
- 🏢 **Multi-tenant** — Filtre d'organisation imposé côté serveur
- 🚫 **XSS** — Pas de `dangerouslySetInnerHTML` avec données utilisateur
- 🔐 **Auth** — Vérification côté serveur sur chaque API protégée
- 📋 **Pre-commit checklist** — Voir `AGENTS.md` pour la liste complète

---

## Release Notes

- [**v1.6.1**](./RELEASE_NOTES_v1.6.1.md) — Mode hors ligne complet : copie locale de toutes les données de l'espace, tous les écrans consultables sans réseau, ajouts et modifications hors ligne (espaces, points de vente, types de tickets, allocations, collectes) synchronisés au retour du réseau avec les nouveautés de la base
- [**v1.6.0**](./RELEASE_NOTES_v1.6.0.md) — Mode hors ligne (consultation sans réseau, collectes synchronisées au retour du réseau), rapports retravaillés avec export PDF, accès de l'équipe par copie / WhatsApp / e-mail, réinitialisation du mot de passe sécurisée, limite du forfait signalée, types de tickets en jours, badge du forfait, revenus sur les factures payées
- [**v1.5.0**](./RELEASE_NOTES_v1.5.0.md) — Essai gratuit automatique à la première souscription seulement, réabonnement par moyen de paiement filtrable par pays, téléphone avec pays à l'inscription, bandeau du compte, espace collecteur cloisonné, nombre de collecteurs par forfait, Top 3 des pays, abonnements retravaillés, site vitrine, bot Telegram configurable, mesure d'audience PostHog
- [**v1.4.0**](./RELEASE_NOTES_v1.4.0.md) — Réabonnement et paiement par Wave (QR code, justificatif WhatsApp), factures de licence en PDF, statistiques et KPI du back-office, support par tickets, rappels J-10 / J-5 / J-2, bot Telegram fiabilisé et sécurisé
- [**v1.3.0**](./RELEASE_NOTES_v1.3.0.md) — Suspension et suppression avec révocation immédiate, essai unique et licence expirée appliquée côté serveur, notifications (cloche, push, Telegram), assistant Telegram sur Claude avec relais open source, back-office mobile first, fenêtres natives du téléphone remplacées
- [**v1.2.0**](./RELEASE_NOTES_v1.2.0.md) — Back-office Super Admin (inscriptions, licences, demandes), isolation des données par client, connexion unique, mot de passe temporaire à changer, correctifs de sécurité
- [**v1.1.0**](./RELEASE_NOTES_v1.1.0.md) — Échanges de tickets, Multi-Espaces Wi-Fi, Mode Offline, Refonte Mobile, Sécurité RLS
- [**v1.0.0**](./RELEASE_NOTES_v1.0.0.md) — Lancement initial : POS, Allocations, Collectes, Dashboard

---

## Licence

Projet privé — © 2026 OptiSpace. Tous droits réservés.
