# OptiSpace

Application de gestion de points de vente, d'allocations de tickets et d'encaissements, complétée par un back-office SaaS de pilotage. Web (Next.js) et Android (Capacitor) partagent le même front.

> Le nom historique du projet est « Opti Wi-Fi » : l'identifiant du paquet Android est resté `com.optiwifi.app` pour ne pas casser les installations existantes, et le certificat de signature conserve son ancien `CN`.

## Sommaire

- [Ce que fait l'application](#ce-que-fait-lapplication)
- [Stack technique](#stack-technique)
- [Architecture](#architecture)
- [Démarrage](#démarrage)
- [Scripts](#scripts)
- [Design system](#design-system)
- [Base de données](#base-de-données)
- [Application Android](#application-android)
- [Sauvegardes](#sauvegardes)
- [Déploiement](#déploiement)
- [Sécurité](#sécurité)
- [Organisation du dépôt](#organisation-du-dépôt)
- [Contraintes connues](#contraintes-connues)

## Ce que fait l'application

### Espace client (`/dashboard`)

| Domaine | Ce qui est couvert |
| --- | --- |
| **Dashboard** | KPIs globaux : tickets alloués, vendus, CA, encaissé, écart global |
| **Points de vente** | CRUD, activation/désactivation, rattachement à un collecteur et à un espace, fiche détaillée avec historique |
| **Espaces Wi-Fi** | Regroupement de POS au sein d'une organisation, affectation/désaffectation |
| **Types de tickets** | Nom, durée, prix (FCFA), devise, activation |
| **Allocations** | Attribution de stock de tickets à un POS, suivi alloué / vendu / restant, échange entre allocations, statuts |
| **Collectes** | Assistant d'encaissement en 5 étapes : POS, quantités vendues, montant attendu, encaissé + commission, bilan avec détection d'écarts |
| **Rapports** | Filtres par période, exports CSV (encaissements, points de vente) |
| **Utilisateurs** | Création de comptes, rôle, téléphone, dans la limite du quota d'abonnement |
| **Abonnement** | Plan courant, jours restants, consommation |

### Back-office plateforme (`/platform`)

Pilotage des organisations clientes : tableau de bord (MRR, churn, courbes), gestion et approbation des organisations, plans, abonnements et attributions, factures, paiements, tickets de support, audit logs, notifications et impersonation d'un administrateur client (audité).

## Stack technique

- **Frontend** : Next.js 16.3.3 (App Router, RSC), React 19, TypeScript 5
- **UI** : Tailwind CSS 4 (configuration CSS-first, tokens dans `src/styles/`), composants maison (`src/components/ui`), Lucide, Recharts, Sonner
- **Backend** : Supabase (PostgreSQL, Auth, RLS) via `@supabase/ssr` et `supabase-js`
- **Mobile** : Capacitor 7 (App, Haptics, Keyboard, SplashScreen, StatusBar)
- **Validation** : Zod + React Hook Form

## Architecture

```
┌─────────────────────┐        ┌──────────────────────┐
│  Web (Vercel)       │        │  APK Android         │
│  Next.js 16         │◄──────►│  WebView Capacitor   │
└──────────┬──────────┘  HTTPS └──────────┬───────────┘
           │                              │
           └──────────┬───────────────────┘
                      ▼
              ┌───────────────┐
              │   Supabase    │  Auth · PostgreSQL · RLS
              └───────────────┘
```

Points structurants :

- **Deux espaces dans un même dépôt** : l'espace client (`src/app/(dashboard)`) et le back-office plateforme (`src/app/platform`). La page de connexion unique (`/login`) identifie le profil : un compte plateforme est redirigé vers `/platform/dashboard`, sinon vers `/dashboard`.
- **Multi-tenancy** : le tenant est l'organisation. Chaque requête cliente est filtrée par `.eq('organization_id', …)` ; l'isolation est doublée par les politiques RLS Postgres. Les espaces Wi-Fi (`wifi_spaces`) sont un sous-groupe au sein d'une organisation.
- **Rôles** : côté client `administrateur` / `collecteur` (`profiles.role`) ; côté plateforme `super_admin` / `platform_support` (`platform_users.role`). Le middleware protège les routes, les API revérifient le rôle côté serveur, l'UI masque les menus — la sécurité réelle reste RLS + API.
- **Cycle de vie d'un client** : inscription → organisation en `pending_approval` → approbation ou suspension depuis `/platform/clients` (écrit dans `platform_audit_logs`). L'espace client affiche un écran bloquant tant que le statut n'est pas `active`.

## Démarrage

Prérequis : **Node.js ≥ 20.9** et un projet Supabase.

```bash
npm install
cp .env.example .env.local   # puis compléter les clés
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

### Variables d'environnement

| Variable | Usage |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anon (exposée au client, protégée par RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Serveur uniquement** : inscription, création d'utilisateur, écritures plateforme, sauvegardes. Ne jamais l'exposer au client |
| `CAP_SERVER_URL` | Optionnel : URL chargée par l'APK Android. Défaut : l'URL de production Vercel |

Plusieurs modules lèvent une erreur au chargement si les variables Supabase manquent : l'application démarre en échec plutôt qu'en mode dégradé.

## Scripts

| Commande | Effet |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run start` | Sert le build de production |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | TypeScript — **à lancer manuellement**, voir [Contraintes connues](#contraintes-connues) |
| `npm run backup` | Sauvegarde JSON de la base (via la clé service role) |
| `npm run backup:list` | Lister les sauvegardes disponibles |
| `npm run backup:restore=<fichier>` | Restaurer une sauvegarde |
| `npm run backup:clean` | Purge les sauvegardes au-delà de la rétention |
| `npm run android:assets` | Régénère icônes et splash depuis `Icon app/OptiSpace.jpg` |
| `npm run android:sync` | Copie la config Capacitor et les plugins dans `android/` |
| `npm run android:apk` | Build APK release signé |
| `npm run android:apk:debug` | Build APK debug |
| `npm run android:open` | Ouvre le projet dans Android Studio |

## Design system

Les couleurs de marque sont définies une seule fois, à partir de l'icône de l'application :

| Token | Valeur | Rôle |
| --- | --- | --- |
| `brand-500` | `#3F9E63` | Primaire : actions, états actifs, anneaux de focus |
| `brand-400` | `#84C865` | Secondaire : accents, texte actif, dégradés |
| `brand-900` | `#1B3F2B` | Chrome : sidebars, barre basse, splash |
| `brand-on` | `#0B1A0F` | Texte sur aplats verts |

Deux fichiers, à modifier ensemble :

- `src/styles/design-system.css` — **source canonique** : bloc `@theme` Tailwind qui génère les utilitaires `bg-brand-500`, `text-brand-on`, `ring-brand-500`, `from-brand-900`…
- `src/lib/design-system.ts` — miroir TypeScript pour ce qui ne lit pas le CSS : séries Recharts, configuration Capacitor, métadonnées.

L'échelle `brand-50 → brand-950` est exportée dans les deux. Les tons sémantiques d'**avertissement** restent en ambre Tailwind (`amber-*`) pour rester distinguables du vert de succès ; ne pas les remplacer par `brand-*`.

`src/app/globals.css` conserve les variables Material 3 (`--md-*`) utilisées par le scroll et quelques composants de bas niveau, et le miroir Android de la palette se trouve dans `android/app/src/main/res/values/colors.xml`.

## Base de données

PostgreSQL Supabase, tables principales : `organizations`, `profiles`, `platform_users`, `platform_settings`, `platform_audit_logs`, `wifi_spaces`, `points_of_sale`, `ticket_types`, `ticket_allocations`, `collections`, `collection_items`, `subscriptions`, `subscription_plans`, `invoices`, `payments`, `support_tickets`.

**Les migrations s'appliquent manuellement** : il n'y a pas de CLI Supabase dans le dépôt. Ouvrir l'éditeur SQL de Supabase et exécuter les fichiers de `supabase/migrations/` dans l'ordre chronologique (du nom le plus ancien au plus récent). Des scripts de correction autonomes sont également présents dans `supabase/` (`fix_missing_columns.sql`, `deploy_security_fixes.sql`, `fix_admin_role.sql`…) : ils servent à réparer un projet existant, pas à installer un nouveau.

## Application Android

L'APK est une **coquille WebView** : il ne contient pas le code de l'application, il charge le site déployé (`server.url` dans `capacitor.config.ts`). Conséquence directe : **le site doit être en ligne**, sinon l'application affiche une page blanche. Publier une nouvelle version revient donc à déployer le site ; l'APK n'a besoin d'être redistribué que si l'icône, le splash ou le nom affiché changent.

Prérequis de build : **JDK 21** (par exemple celui d'Android Studio, `Contents/jbr`) et le SDK Android (`ANDROID_HOME`). Le JDK 17 de Homebrew échoue avec `invalid source release: 21`.

```bash
npm run android:assets   # si l'icône ou la palette a changé
npm run android:sync
npm run android:apk     # → android/app/build/outputs/apk/release/
```

### Icônes et splash

`scripts/generate_android_assets.py` (Python stdlib uniquement, ni Pillow ni ImageMagick) compose à partir de `Icon app/OptiSpace.jpg` : mipmaps plein cadre pour les lanceurs legacy, artwork cantonnée dans la zone visible 72dp pour la couche adaptative, icône monochrome Material You, et splash en badge circulaire sur le vert chrome. **Relancer ce script avant chaque build APK** si l'icône ou la palette change.

### Signature

La clé de release est `android/optiwifi-release.keystore`, paramétrée par `android/keystore.properties`. Les deux fichiers sont ignorés par git : **il faut les sauvegarder hors du dépôt**, sinon aucune mise à jour de l'APK ne pourra être publiée. `versionCode` doit être incrémenté à chaque publication, sinon Android refuse l'installation par-dessus une version existante.

## Sauvegardes

`scripts/backup.sh` dump 8 tables au format JSON dans `scripts/backups/` (avec un lien `backup-latest.json`) ; `scripts/cron_backup.sh` applique la rétention. Programmation quotidienne à 02:00 :

```bash
echo "0 2 * * * $(pwd)/scripts/cron_backup.sh" | crontab -
```

Les tables de la plateforme (organizations, subscriptions, platform_users, payments…) ne sont **pas** incluses dans le jeu de sauvegarde : à compléter si ces données doivent être restaurables.

## Déploiement

- **Web** : le dépôt est connecté à Vercel, chaque push sur `main` déclenche un build. L'application consomme `SUPABASE_SERVICE_ROLE_KEY` côté serveur ; la variable doit être définie dans les variables d'environnement du projet Vercel, pas dans un fichier versionné.
- **Android** : l'APK release signé est produit par `npm run android:apk`, puis copié dans `android/dist/`. Les APK ne sont pas versionnés.

## Sécurité

Règles appliquées à tout changement (détail dans `AGENTS.md`) :

- **RLS active sur chaque table**, vérifications par `auth.uid()` / `organization_id`. Le masquage d'éléments dans l'interface n'est jamais une autorisation.
- **Clé service role strictement côté serveur** (`SUPABASE_SERVICE_ROLE_KEY` sans préfixe `NEXT_PUBLIC_`), jamais dans le client.
- **Requêtes ORM paramétrées** uniquement (`.eq()`, `.in()`, `.gt()`…) : aucune concaténation de SQL.
- **Pas de `dangerouslySetInnerHTML`** avec de la donnée utilisateur, pas de secret dans les logs ni dans les messages d'erreur.
- Scan de secrets obligatoire avant commit (clés `sk_`/`pk_`/`AKIA`/`AIza`, tokens, mots de passe, URLs de base de données avec identifiants).
- Les écritures plateforme tracent l'auteur dans `platform_audit_logs`, y compris l'impersonation.

## Organisation du dépôt

```
src/
  app/                  routes (App Router) : (auth), (dashboard), platform, api
  components/           ui/ (design system), layout/, platform/, offline/, collections/
  hooks/                useOnlineStatus, useOfflineMutation, useNetworkMetrics, …
  lib/                  supabase/ (clients), stores/ (zustand), offline/, design-system.ts
  styles/               design-system.css  ← tokens canoniques
  types/                database.ts, platform.ts
android/                projet Gradle Capacitor (ressources, icônes, splash)
scripts/                génération d'assets, sauvegardes, création de super admin
supabase/               migrations SQL et scripts de correction
docs/                   android-app.md, PHASE2_PLAN.md
```

Conventions de commit : `type(scope): description` en minuscules, en français (`feat(collecte): …`, `fix(mobile): …`, `refactor(select): …`).

## Contraintes connues

À connaître avant de modifier le projet :

- `next.config.ts` force `typescript.ignoreBuildErrors: true` : **`npm run build` ne casse pas sur une erreur de type**. Lancer `npx tsc --noEmit` avant de conclure qu'une branche est verte. Il reste 3 erreurs de typage préexistantes (`allocations/page.tsx`, `collections/new/page.tsx`).
- L'APK ne peut pas être reconstruit ailleurs sans JDK 21 et le SDK Android.
- La WebView peut servir une version en cache : Vercel envoie `must-revalidate`, donc un redémarrage complet de l'application suffit à récupérer le dernier déploiement.
- La file d'attente hors-ligne (`src/lib/offline/`) est écrite mais jamais rejouée : les indicateurs de connexion sont donc purement informatifs, aucune écriture n'est mise en file d'attente.
- `next-intl` et `messages/` sont installés mais inutilisés : l'interface est intégralement en français codé en dur.
- `/subscription` n'est pas dans les routes protégées du middleware ; la page s'appuie sur le garde de layout.
- `eslint.config.mjs` ignore `.kilo/**` et `android/**` : les worktrees Agent Manager dupliqueraient chaque diagnostic.