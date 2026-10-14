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

---

## Stack Technique

| Catégorie | Technologies |
|-----------|-------------|
| **Framework** | Next.js 16 (App Router), React 19, TypeScript 5 |
| **Styling** | Tailwind CSS 4, Design System Material 3 personnalisé |
| **Base de données** | Neon (PostgreSQL serverless) — migré depuis Supabase |
| **Auth** | Supabase Auth (SSR) + JWT custom pour Edge Runtime |
| **State Management** | Zustand (auth, spaces, platform) |
| **Formulaires** | React Hook Form + Zod |
| **Graphiques** | Recharts |
| **UI Components** | Lucide React (icônes), Sonner (toasts) |
| **Email** | Nodemailer (SMTP Gmail) |
| **Déploiement** | Vercel (auto-deploy depuis `main`) |
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
- Configuration du profil et de l'organisation
- Gestion de l'abonnement

### 📴 Mode Offline (Résilience Réseau)
- Détection réseau temps réel (`useOnlineStatus`)
- Indicateur visuel de connectivité dans la sidebar
- File d'attente d'actions hors-ligne avec sync automatique

### 🔐 Sécurité
- RLS (Row Level Security) sur toutes les tables PostgreSQL
- Protection API côté serveur (vérification de rôle)
- Middleware Next.js pour les routes protégées
- Pas de secrets hardcodés (`.env.local`)
- Fonction `is_admin()` optimisée sans récursion

### 📱 Mobile-First
- Navigation bottom bar fixe sur mobile avec backdrop blur
- Sidebar en tiroir (bottom sheet) pleine largeur
- Zones de tap conformes (≥ 44×44px)
- Safe area insets (iPhone notch / home bar)
- Body scroll lock quand le tiroir est ouvert
- Toggle de visibilité mot de passe sur tous les formulaires

---

## Architecture

### Structure du Projet

```
src/
├── app/
│   ├── (auth)/
│   │   └── login/               # Page de connexion / inscription / récupération
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
│   │   ├── spaces/              # Espaces Wi-Fi & dashboard par espace
│   │   │   └── [id]/            # Détail espace Wi-Fi
│   │   ├── tickets/             # Types de tickets
│   │   ├── users/               # Gestion utilisateurs (admin)
│   │   └── layout.tsx           # Layout dashboard (sidebar + header + bottom nav)
│   ├── api/
│   │   ├── allocations/exchange/ # API échange de tickets
│   │   ├── auth/                # Login, register, forgot-password
│   │   ├── db/                  # Opérations base de données
│   │   ├── platform/            # APIs admin plateforme
│   │   ├── pos/[id]/reset/      # API remise à zéro POS
│   │   └── users/               # Gestion utilisateurs
│   ├── forgot-password/         # Page mot de passe oublié
│   ├── platform/                # Back-office super-admin
│   │   ├── audit-logs/          # Journaux d'audit
│   │   ├── clients/             # Gestion clients multi-tenant
│   │   ├── dashboard/           # Dashboard plateforme
│   │   ├── invoices/            # Facturation
│   │   ├── payments/            # Paiements
│   │   ├── plans/               # Plans d'abonnement
│   │   ├── reports/             # Rapports plateforme
│   │   ├── subscriptions/       # Abonnements
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
│   ├── supabase/                # Client Supabase (auth SSR)
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
        ┌───────▽────────────┐
        │ subscription_plans │
        └────────────────────┘
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
| Abonnement | ✅ | ❌ |

---

## API Routes

| Méthode | Route | Description | Rôle requis |
|---------|-------|-------------|-------------|
| `POST` | `/api/auth/login` | Connexion utilisateur | Public |
| `POST` | `/api/auth/register` | Inscription (création org + profil) | Public |
| `POST` | `/api/allocations/exchange` | Échange de tickets | Admin / Collecteur |
| `DELETE` | `/api/pos/[id]/reset` | Vider toutes les données d'un POS | Admin |
| `POST` | `/api/users/create` | Créer un utilisateur | Admin |
| `GET/POST` | `/api/platform/*` | APIs back-office super-admin | Super Admin |

---

## Démarrage Rapide

### Prérequis

- **Node.js** ≥ 18
- **npm** ≥ 9
- Un projet **Supabase** (pour l'auth) ou **Neon** (pour la DB)

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
# ── Supabase (Auth) ─────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# ── Email (SMTP) ────────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre@email.com
SMTP_PASS=votre-app-password
SMTP_SECURE=false

# ── Site URL ────────────────────────────────────────
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

> ⚠️ **Ne jamais committer `.env.local`** — Ce fichier est exclu par `.gitignore`.

### Base de Données

Exécuter le schéma initial dans le SQL Editor Neon ou Supabase :

```bash
# Schéma complet (toutes les tables + enums + index)
supabase/neon_schema.sql

# Corrections et migrations additionnelles
supabase/fix_missing_columns.sql
```

---

## Scripts Disponibles

```bash
npm run dev          # Serveur de développement Next.js
npm run build        # Build de production
npm run start        # Serveur de production
npm run lint         # Linting ESLint

npx tsc --noEmit     # Vérification TypeScript (0 erreur requise)

npm run backup       # Créer un backup JSON de la base
npm run backup:list  # Lister les backups disponibles
npm run backup:restore=<file>  # Restaurer depuis un backup
npm run backup:clean # Nettoyer les anciens backups
```

---

## Backup & Restauration

### Backup manuel

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

### Production (Vercel)

L'application est déployée automatiquement sur **Vercel** à chaque push sur la branche `main` :

- **URL** : [https://www.optiwifi.site](https://www.optiwifi.site)
- **Repo** : [github.com/Artemis-coder/Opti-wifi](https://github.com/Artemis-coder/Opti-wifi)

### Procédure de déploiement

```bash
# 1. Vérifier TypeScript (0 erreurs)
npx tsc --noEmit

# 2. Build de production
npm run build

# 3. Pousser sur main (Vercel deploy automatique)
git push origin main

# 4. Si mise à jour DB nécessaire :
#    Exécuter supabase/fix_missing_columns.sql dans le SQL Editor
```

### Vérification post-déploiement

- [ ] Page de connexion accessible (`/login`)
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
| **Admin seul** | Seul un administrateur peut vider les données d'un POS, gérer les utilisateurs et les espaces |

---

## Sécurité

Consulter [`AGENTS.md`](./AGENTS.md) pour les règles de sécurité complètes :

- 🔒 **Secret scanning** obligatoire avant chaque commit
- 🛡️ **SQL injection** — Requêtes paramétrées uniquement (ORM Supabase)
- 🚫 **XSS** — Pas de `dangerouslySetInnerHTML` avec données utilisateur
- 🔐 **Auth** — Vérification côté serveur sur chaque API protégée
- 📋 **Pre-commit checklist** — Voir `AGENTS.md` pour la liste complète

---

## Release Notes

- [**v1.1.0**](./RELEASE_NOTES_v1.1.0.md) — Échanges de tickets, Multi-Espaces Wi-Fi, Mode Offline, Refonte Mobile, Sécurité RLS
- [**v1.0.0**](./RELEASE_NOTES_v1.0.0.md) — Lancement initial : POS, Allocations, Collectes, Dashboard

---

## Licence

Projet privé — © 2026 OptiSpace. Tous droits réservés.
