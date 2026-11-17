<p align="center">
  <img src="public/assets/logo.jpg" alt="OptiSpace Logo" width="80" height="80" style="border-radius: 16px;" />
</p>

<h1 align="center">OptiSpace — Gestion des Tickets & Encaissements Wi-Fi</h1>

<p align="center">
  <strong>Plateforme SaaS multi-tenant de gestion des points de vente, allocations de tickets et encaissements pour les réseaux Wi-Fi communautaires — pilotée au quotidien depuis Telegram, avec des agents Claude qui surveillent, corrigent et développent sous la validation du propriétaire.</strong>
</p>

<p align="center">
  <a href="https://www.optiwifi.site">🌐 Production</a> •
  <a href="#-fonctionnalités">📋 Fonctionnalités</a> •
  <a href="#-bot-telegram-du-super-admin">💬 Bot Telegram</a> •
  <a href="#-agents-claude--automatisations">🤖 Agents</a> •
  <a href="#-architecture">🏗️ Architecture</a> •
  <a href="#-démarrage-rapide">🚀 Démarrage</a> •
  <a href="#-déploiement">☁️ Déploiement</a>
</p>

<p align="center">
  <strong>Version actuelle : v1.23.0</strong> — <a href="./RELEASE_NOTES_v1.23.0.md">notes de version</a>
</p>

---

## Sommaire

1. [Stack technique](#-stack-technique)
2. [Fonctionnalités](#-fonctionnalités)
3. [Bot Telegram du super admin](#-bot-telegram-du-super-admin)
4. [Agents Claude & automatisations](#-agents-claude--automatisations)
5. [Sécurité](#-sécurité)
6. [Architecture](#-architecture)
7. [API](#-api)
8. [Démarrage rapide](#-démarrage-rapide)
9. [Déploiement](#-déploiement)
10. [Règles métier](#-règles-métier)
11. [Historique des versions](#-historique-des-versions)

---

## 🧰 Stack technique

| Catégorie | Technologies |
|---|---|
| **Framework** | Next.js 16 (App Router), React 19, TypeScript 5 |
| **Interface** | Tailwind CSS 4, design system Material 3 personnalisé, Lucide, Sonner, Recharts |
| **Base de données** | Neon (PostgreSQL serverless) — branches `production` et `vercel-dev` isolées |
| **Authentification** | JWT maison en cookie (bcrypt), vérifié par le proxy Next.js (`src/proxy.ts`) |
| **État & formulaires** | Zustand, React Hook Form + Zod |
| **Notifications** | Cloche temps réel, Web Push (VAPID), e-mail (Nodemailer), Telegram |
| **IA** | Claude (Anthropic) — assistant du bot et agents Claude Code dans le cloud ; relais open source (Groq, OpenRouter, Together) |
| **Voix** | Transcription Whisper (Groq), synthèse vocale ElevenLabs |
| **Hébergement** | Vercel — `main` → production, `develop` → préproduction |
| **Monnaie** | FCFA (XOF) — Afrique francophone |

---

## ✨ Fonctionnalités

### Espace client

| Module | Ce qu'il permet |
|---|---|
| 🏪 **Points de vente** | CRUD, collecteur attribué, 5 KPIs par point de vente, historique, suspension, remise à zéro (double validation) |
| 🎫 **Types de tickets** | Tarifs Wi-Fi (durée, prix FCFA), activation, rattachement à un espace |
| 📦 **Allocations** | Stocks par point de vente, suivi alloué / vendu / restant, traçabilité complète |
| 🔄 **Échange de tickets** | Assistant dédié, retour d'invendus contre nouveaux tickets à valeur équivalente, transaction atomique |
| 💰 **Collectes** | Assistant en 5 étapes, calcul du montant attendu, détection d'écarts, commissions des collecteurs |
| 🌐 **Espaces Wi-Fi** | Multi-sites, tableau de bord par espace, rattachement verrouillé |
| 📊 **Tableau de bord & rapports** | KPIs globaux, tendances, rapports consolidés, export PDF, masquage des montants |
| 👤 **Équipe** | Rôles administrateur, collecteur et compte « point de vente », accès partagé par copie / WhatsApp / e-mail |
| 💳 **Abonnement** | Forfait, quotas, demande de renouvellement validée par le super admin, réabonnement par Wave (QR code), factures PDF, rappels J-10 / J-5 / J-2, consultation seule à l'expiration |
| 🔔 **Notifications** | Cloche, push même site fermé, le téléphone du point de vente sonne à chaque allocation ou collecte |
| 📴 **Mode hors ligne** | Copie locale des données, saisie sans réseau, synchronisation au retour |
| 📱 **Mobile-first** | Barre de navigation en bas, tableaux en cartes, zones de tap ≥ 44 px, guide de démarrage interactif |
| 🔐 **Compte** | Connexions & appareils, mot de passe temporaire à changer, téléchargement des données et suppression de compte (RGPD) |

### Back-office super admin (`/platform`)

- **« À traiter »** : inscriptions à valider, demandes de licence, licences qui expirent.
- **Clients & licences** : activer, prolonger, suspendre, réactiver, supprimer un espace (accès coupé immédiatement, données conservées).
- **Utilisateurs** : comptes, rôles, réinitialisation de mot de passe, révocation immédiate.
- **Statistiques** : inscriptions, revenus, revenu mensuel récurrent, répartition des licences.
- **Paiements & factures**, moyens de paiement (QR code, opérateur, WhatsApp), **support** par tickets.
- **État du système** : base, API, notifications, serveur, Vercel, tâches planifiées, **sécurité** — avec historique et alertes au changement d'état.
- **Journal d'audit** lisible (avant → après).

---

## 💬 Bot Telegram du super admin

Le bot est privé : il ne répond qu'au compte du propriétaire (toute autre personne est signalée comme tentative d'intrusion). Il comprend l'**écrit et les notes vocales**, et **répond aussi en vocal** quand on lui parle (résumé de 20 à 30 secondes).

```
/menu
├── 🤖 IA — Claude Code
│   ├── ✍️ Nouvelle demande     (écrite ou dictée)
│   ├── ⏳ En cours
│   ├── ✅ À valider
│   ├── 🗂️ Historique
│   └── 🚀 Mise en production
└── 📊 Business OptiSpace
    ├── Vue d'ensemble · Demandes en attente · Clients
    ├── Licences à renouveler · Encaissements · Statut technique
    ├── 🌅 Rapport du jour · 📈 Bilan de la semaine
    ├── 🛡️ Sécurité        (récap 24 h / 7 jours, incidents, réglages sensibles)
    └── 🩺 Santé de l'application
```

### 📊 Business OptiSpace
L'assistant (Claude, avec relais open source) répond sur les **vraies données** : clients, licences, encaissements, sécurité. Il peut agir — approuver une licence, suspendre un espace… — **toujours après un bouton de confirmation**.

### 🤖 IA — Claude Code : développer depuis Telegram

```
Vous ──► demande ──► Claude (cloud) ──► 📋 plan ──► ✅ vous validez
                                                        │
          🚀 vous mettez en production ◄── ✅ vous intégrez ◄── 🛠️ Claude développe (branche + PR)
                        │
                        └──► 🏷️ release créée automatiquement
```

1. **Demande** — vous décrivez un besoin ; une routine Claude Code se réveille dans le cloud d'Anthropic.
2. **Plan** — ce qui a été compris, ce qui change pour les utilisateurs, étapes, fichiers, base de données, risques, ampleur → *Valider / Modifier / Abandonner*.
3. **Développement** — sur une branche dédiée, vérifié (types, lint, build) ; l'application ouvre la PR vers `develop` et envoie le récapitulatif → *Intégrer / Corriger / Abandonner*.
4. **Mise en production** — la liste de ce qui part est affichée, puis confirmée ; Claude rédige les notes de version et la release est publiée.

> Le contenu des demandes reste privé dans la base (le dépôt est public) : Claude le lit par une API protégée. **L'agent ne peut ni fusionner, ni pousser sur `develop` ou `main`, ni mettre en production** : seuls les boutons du propriétaire le peuvent.

---

## 🤖 Agents Claude & automatisations

### Agents Claude Code (cloud Anthropic, Opus)

Ils tournent sans dépendre d'un ordinateur allumé, sans connecteurs, dans des environnements dont l'accès réseau est limité au site OptiSpace. Leurs correctifs passent **tous** par le circuit de validation ci-dessus.

| Agent | Quand | Rôle |
|---|---|---|
| 🛡️ **Sécurité** | toutes les heures | Analyse chaque incident d'intrusion, vérifie dans le code que l'attaque est bloquée, corrige si besoin. Rapport : détection, gravité, résultat, solution et pourquoi |
| 🛠️ **Développement** | à la demande (Telegram) | Plans et développements du menu IA, notes de version |
| 📦 **Audit des dépendances** | le lundi | `npm audit`, correctif sans changement de version majeure |
| 🔍 **Revue de sécurité** | le vendredi | Relit les modifications de la semaine selon la checklist de sécurité |
| 🔧 **Diagnostic technique** | chaque jour | Lit l'état du système ; silencieux si tout va bien, sinon cause et correctif |

Un même rapport n'est envoyé qu'une fois par 24 heures, pour ne jamais répéter une alerte.

### Tâches planifiées de l'application (Vercel Cron)

| Tâche | Quand | Ce qu'elle fait |
|---|---|---|
| `licence-reminders` | chaque jour | Rappels de licence aux clients (J-10, J-5, J-2, expiration, fin d'essai) |
| `health-check` | chaque jour | Contrôle de tous les composants, alerte au changement d'état |
| `business-reports` | chaque matin | 🌅 Rapport du matin + 💸 anomalies d'encaissement ; le lundi, 📉 clients à risque + 📊 bilan de la semaine |

Les rapports business sont calculés en base, sans IA.

---

## 🔐 Sécurité

- **Isolation multi-tenant côté serveur** : chaque client ne voit et ne modifie que les données de son organisation (`/api/db` + `src/lib/tenant.ts`), références vérifiées à l'écriture.
- **Authentification** : verrouillage après échecs répétés, limitation des requêtes, sessions révoquées au changement de mot de passe, algorithme JWT épinglé, pas d'énumération des comptes.
- **Détection d'intrusion** : force brute, requêtes trafiquées, jeton falsifié, CSRF, scans de fichiers sensibles, accès au back-office sans droits, webhooks et crons sans secret, inconnu sur le bot. Chaque tentative ouvre un **incident** signalé sur Telegram ([`docs/securite/ALERTES_SECURITE.md`](docs/securite/ALERTES_SECURITE.md)).
- **Agents à privilèges minimaux** : jetons dédiés comparés en temps constant, injectés par un proxy réseau (jamais visibles par l'agent), branches `claude/…` uniquement, aucun accès à la base.
- **Bonnes pratiques** : requêtes SQL paramétrées, CSP, en-têtes de sécurité, erreurs techniques masquées, aucun secret dans le code.
- **Isolation des environnements** : `src/lib/env-guard.ts` bloque toute connexion à la base de production depuis le local ou une préproduction.

Règles complètes : [`AGENTS.md`](./AGENTS.md) · checklist réutilisable : [`docs/CHECK_SECURITE.md`](docs/CHECK_SECURITE.md) · dernier test d'intrusion : [`docs/securite/RAPPORT_PENTEST_2026-11-15.md`](docs/securite/RAPPORT_PENTEST_2026-11-15.md).

---

## 🏗️ Architecture

### Structure du projet

```
src/
├── app/
│   ├── (auth)/                 # Connexion unique, inscription, mot de passe
│   ├── (dashboard)/            # Espace client : POS, allocations, collectes, espaces,
│   │                           #   tickets, rapports, équipe, abonnement, paramètres
│   ├── platform/               # Back-office super admin
│   └── api/
│       ├── auth/ db/ users/    # Authentification, passerelle de données isolée, équipe
│       ├── platform/           # APIs du back-office
│       ├── security/incidents/ # Incidents de sécurité (super admin, agent de sécurité)
│       ├── dev/                # API des agents Claude (demandes, rapports, santé, releases)
│       ├── telegram/           # Webhook du bot
│       └── cron/               # Tâches planifiées
├── components/                 # Layout, UI, back-office, hors ligne
├── hooks/                      # Réseau, mutations hors ligne
└── lib/
    ├── neon/                   # Accès base, authentification
    ├── bot/                    # Assistant Telegram (outils, voix, vues sans IA)
    ├── telegram-*.ts           # Menus Sécurité, Santé, IA — Claude Code
    ├── security-events.ts      # Détection d'intrusion et incidents
    ├── business-reports.ts     # Rapports business
    ├── dev-requests.ts         # Demandes confiées à Claude Code
    ├── github.ts               # PR et releases du dépôt
    ├── system-health.ts        # État du système
    └── tenant.ts quotas.ts …   # Isolation, quotas, règles métier
supabase/                       # Schéma Neon et migrations idempotentes (nom hérité)
docs/                           # Procédures, environnements, sécurité
```

### Base de données (principales tables)

```
organizations ──▷ profiles (users) ──▷ points_of_sale ──▷ wifi_spaces
                                            │
ticket_types ──▷ ticket_allocations ◁───────┤   (allocation | échange rendu | échange reçu)
                                            │
                 collections ──▷ collection_items

subscriptions ──▷ payments · invoices        subscription_plans ◁── license_requests

platform_users ──▷ platform_audit_logs · platform_settings
notifications · push_subscriptions · support_tickets
security_events ──▷ security_incidents       system_health_checks · system_cron_runs
dev_requests · agent_reports                 conversation_sessions · conversation_messages
```

### Rôles & permissions

| Fonctionnalité | Administrateur | Collecteur | Point de vente |
|---|:---:|:---:|:---:|
| Tableau de bord | ✅ | ✅ | ✅ (son point de vente) |
| Points de vente | ✅ CRUD | 👁️ | 👁️ le sien |
| Allocations | ✅ | 👁️ | 👁️ les siennes |
| Échanges & collectes | ✅ | ✅ | 👁️ |
| Rapports, équipe, espaces, types de tickets | ✅ | ❌ | ❌ |
| Abonnement & licences | ✅ | ❌ | ❌ |

Le **super admin** gère toutes les organisations depuis `/platform` et le bot Telegram ; il n'accède pas au contenu métier d'un client via l'espace client.

---

## 📡 API

| Méthode | Route | Rôle |
|---|---|---|
| `POST` | `/api/auth/login`, `/api/auth/register`, `/api/auth/change-password` | Public / connecté |
| `POST` | `/api/db` — passerelle de données filtrée par organisation | Connecté |
| `POST` | `/api/collections`, `/api/ticket-allocations`, `/api/allocations/exchange` | Admin / collecteur |
| `DELETE` | `/api/pos/[id]/reset` | Admin |
| `GET/POST` | `/api/subscriptions/renew`, `/api/invoices`, `/api/support` | Admin |
| `GET/PATCH/…` | `/api/platform/*` — back-office | Super admin |
| `GET/PATCH` | `/api/security/incidents` | Super admin, agent de sécurité |
| `GET/POST` | `/api/dev/requests/[id]`, `/api/dev/requests/[id]/report`, `/api/dev/agent-report`, `/api/dev/health`, `/api/dev/release` | Agents Claude (jeton dédié) |
| `POST` | `/api/telegram/ai-webhook-v2` | Secret Telegram |
| `GET` | `/api/cron/licence-reminders`, `/api/cron/health-check`, `/api/cron/business-reports` | Secret des crons |

---

## 🚀 Démarrage rapide

**Prérequis :** Node.js ≥ 20, npm ≥ 9, accès à la branche Neon **de développement**.

```bash
git clone https://github.com/Artemis-coder/Opti-wifi.git
cd Opti-wifi
npm install
cp .env.example .env.local   # puis compléter les valeurs de DÉVELOPPEMENT
npm run dev                  # http://localhost:3000
```

### Variables d'environnement

Les valeurs ne sont **jamais** dans le dépôt : `.env.local` en local, variables Vercel pour la préproduction et la production (voir [`docs/ENVIRONMENT_SETUP.md`](docs/ENVIRONMENT_SETUP.md)).

| Groupe | Variables |
|---|---|
| Base de données | `DATABASE_URL`, `DATABASE_URL_UNPOOLED` — branche de **développement** uniquement en local |
| Authentification & crons | `JWT_SECRET`, `CRON_SECRET` |
| Site | `NEXT_PUBLIC_SITE_URL` |
| E-mail | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` |
| Notifications push | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |
| Bot Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET` |
| IA & voix | `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `TOGETHER_API_KEY`, `ELEVENLABS_API_KEY` |
| Agents Claude (production) | `SECURITY_AGENT_TOKEN`, `DEV_AGENT_TOKEN`, `CLAUDE_DEV_ROUTINE_URL`, `CLAUDE_DEV_ROUTINE_TOKEN`, `GITHUB_TOKEN` |

> ⚠️ Ne jamais committer `.env.local` ni aucun fichier contenant des valeurs réelles.

### Scripts

```bash
npm run dev          # Serveur de développement
npm run build        # Build de production
npm run lint         # ESLint
npx tsc --noEmit     # Vérification TypeScript (0 erreur requise)
```

Schéma et migrations : `supabase/neon_schema.sql` puis `supabase/migrations/*.sql` (idempotentes, testées d'abord sur la base de développement).

---

## ☁️ Déploiement

> 📌 Procédure complète et obligatoire : [`docs/PROCEDURE_DEPLOIEMENT.md`](docs/PROCEDURE_DEPLOIEMENT.md)

| Branche | Environnement | Déclenchement |
|---|---|---|
| `develop` | Préproduction — https://dev.optiwifi.site | automatique à chaque push |
| `main` | Production — https://www.optiwifi.site | fusion d'une PR `develop → main` validée par le propriétaire |

**Cycle :** travail sur `develop` → `tsc` + lint + build → push (préproduction) → PR vers `main` → fusion par le propriétaire → vérification de la production → resynchronisation de `develop` → **release GitHub** (notes `RELEASE_NOTES_vX.Y.Z.md`).

**Interdits :** commit direct sur `main`, push forcé, `git reset --hard` sur une branche poussée, `vercel --prod`, données de test en production. En cas de problème : *Instant Rollback* Vercel ou `git revert`.

---

## 📏 Règles métier

| Règle | Description |
|---|---|
| **Stock limité** | Un point de vente n'encaisse que les tickets qui lui ont été alloués |
| **Quantité plafonnée** | La quantité vendue ne dépasse pas le stock disponible (alloué − vendu) |
| **Échange équivalent** | Un échange a une valeur FCFA équivalente (retours = réceptions) |
| **Espace verrouillé** | Un point de vente rattaché à un espace Wi-Fi ne peut pas être déplacé |
| **Licence validée** | Un client ne prolonge pas sa licence lui-même : le super admin approuve sa demande |
| **Une demande à la fois** | Une seule demande de licence en attente par organisation |
| **Isolation** | Un utilisateur n'accède qu'aux données de son organisation |
| **Validation humaine** | Aucun correctif ni développement d'un agent n'est intégré ou mis en production sans le propriétaire |

---

## 📜 Historique des versions

| Version | Contenu |
|---|---|
| [**v1.20.0**](./RELEASE_NOTES_v1.20.0.md) | Nouvelle interface avec le design system HeroUI (super admin et espaces), menu mobile, mode sombre lisible |
| [**v1.19.0**](./RELEASE_NOTES_v1.19.0.md) | Bot Telegram : menu Paiement en ligne (statut SasPay, bascule en un bouton) |
| [**v1.18.1**](./RELEASE_NOTES_v1.18.1.md) | Téléchargement des factures et rapports en PDF dans l'espace client |
| [**v1.18.0**](./RELEASE_NOTES_v1.18.0.md) | Paiement en ligne des licences (SasPay), switch en ligne / manuel, KPI alignés |
| [**v1.17.1**](./RELEASE_NOTES_v1.17.1.md) | README restructuré |
| [**v1.17.0**](./RELEASE_NOTES_v1.17.0.md) | Routines Claude d'audit des dépendances, de revue de sécurité et de diagnostic technique |
| [**v1.16.0**](./RELEASE_NOTES_v1.16.0.md) | Rapports business automatiques : rapport du matin, anomalies d'encaissement, clients à risque, bilan de la semaine |
| [**v1.15.0**](./RELEASE_NOTES_v1.15.0.md) | Bot en deux univers (IA / Business) et développement par Claude Code validé depuis Telegram |
| [**v1.14.1**](./RELEASE_NOTES_v1.14.1.md) | Nouvelle voix du bot |
| [**v1.14.0**](./RELEASE_NOTES_v1.14.0.md) | Correctifs du test d'intrusion, détection d'intrusion, agent de sécurité dans le cloud, menu Sécurité, bot vocal |
| [**v1.13.0**](./RELEASE_NOTES_v1.13.0.md) | Notifications en temps réel : le téléphone du point de vente sonne |
| [**v1.12.1**](./RELEASE_NOTES_v1.12.1.md) | Corrections de sécurité (rapport Herald) |
| [**v1.12.0**](./RELEASE_NOTES_v1.12.0.md) | Compte « point de vente » |
| [**v1.11.0**](./RELEASE_NOTES_v1.11.0.md) | Connexions & appareils, conditions d'utilisation dans l'espace |
| [**v1.10.0**](./RELEASE_NOTES_v1.10.0.md) | Consultation seule à l'expiration, protection anti-capture |
| [**v1.9.0**](./RELEASE_NOTES_v1.9.0.md) | Corrections tracées, suppression de compte (RGPD), mode nuit lisible |
| [**v1.8.0**](./RELEASE_NOTES_v1.8.0.md) | Guide de démarrage interactif |
| [**v1.7.0**](./RELEASE_NOTES_v1.7.0.md) | État du système, notifications pour tous, masquage des montants |
| [**v1.6.1**](./RELEASE_NOTES_v1.6.1.md) · [**v1.6.0**](./RELEASE_NOTES_v1.6.0.md) | Mode hors ligne complet, rapports avec export PDF |
| [**v1.5.0**](./RELEASE_NOTES_v1.5.0.md) | Essai gratuit, réabonnement par pays, espace collecteur cloisonné, site vitrine |
| [**v1.4.0**](./RELEASE_NOTES_v1.4.0.md) | Réabonnement Wave, factures PDF, support, rappels de licence |
| [**v1.3.0**](./RELEASE_NOTES_v1.3.0.md) | Suspension et suppression, notifications, assistant Telegram sur Claude |
| [**v1.2.0**](./RELEASE_NOTES_v1.2.0.md) | Back-office super admin, isolation des données par client |
| [**v1.1.0**](./RELEASE_NOTES_v1.1.0.md) | Échanges de tickets, multi-espaces, mode hors ligne, refonte mobile |
| [**v1.0.0**](./RELEASE_NOTES_v1.0.0.md) | Lancement : points de vente, allocations, collectes, tableau de bord |

---

## Licence

Projet privé — © 2026 OptiSpace. Tous droits réservés.
