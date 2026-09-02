# Opti Wi-Fi — Release v1.1.0

**Date de release :** 2 septembre 2026  
**Tag :** `v1.1.0`  
**Branche cible :** `main`  
**Type :** Feature Release / Sécurité & Architecture

---

## 📦 Résumé de la Version

La version **v1.1.0** d'Opti Wi-Fi apporte des avancées majeures pour la gestion terrain, la scalabilité multi-sites et la fiabilité opérationnelle. Cette mise à jour introduit le module complet d'**Échange de Tickets**, la gestion **Multi-Espaces Wi-Fi**, un système **Offline-First**, une refonte **UI/UX Mobile**, ainsi qu'une refonte architecturale totale des politiques **RLS PostgreSQL** pour une sécurité et une performance sans compromis.

---

## 🚀 Avancées & Fonctionnalités Majeures

### 1. 🔄 Module d'Échange de Tickets (Ticket Exchange)
- **Assistant multi-étapes dédié (`/allocations/exchange`)** :
  - Sélection du point de vente et calcul automatique du stock disponible en temps réel.
  - Saisie des tickets retournés (invendus ou détériorés).
  - Sélection des nouveaux tickets reçus en remplacement.
  - Vérification stricte et automatique de l'équivalence de valeur en FCFA avant validation.
- **Fonction SQL transactionnelle (`perform_ticket_exchange`)** :
  - Traitement atomique en base de données : les tickets rendus et reçus sont insérés simultanément avec un identifiant de regroupement unique (`exchange_group_id`).
  - Détection et validation automatique du stock physique réel au point de vente.
- **Traçabilité & Historique (`/allocations`)** :
  - Badges visuels distincts : `Rendu (Échange)` en rouge, `Reçu (Échange)` en vert, `Allocation` en ambre.
  - Suivi complet des mouvements de tickets par point de vente et par espace.

### 2. 🌐 Gestion Multi-Espaces Wi-Fi (`wifi_spaces`)
- **Isolation et segmentation des réseaux** :
  - Création et administration d'espaces Wi-Fi distincts (quartiers, sites, zones d'intervention).
  - Attribution et liaison dynamique des points de vente aux espaces.
  - Verrouillage de l'attribution pour garantir la cohérence des données financières.
- **Dashboard analytique par Espace (`/spaces/[id]`)** :
  - Grille responsive de 6 KPIs dédiée à l'espace : Total POS, Encaissements, Montant Attendu, Écart, Commissions versées, Taux de conformité.
  - Liste des encaissements récents et gestion directe des POS rattachés.
  - Composants réutilisables `SpaceSummary` et `PosSummary`.

### 3. 📴 Résilience Réseau & Mode Hors-Ligne (Offline-Ready)
- **Détection réseau en temps réel (`useOnlineStatus`)** :
  - Indicateur visuel discret et moderne de connectivité dans la barre latérale.
  - Prise en charge des micro-coupures réseau fréquentes en mobilité terrain.
- **File d'attente d'actions (`queue.ts`, `sync.ts`)** :
  - Enregistrement local des opérations en cas de perte de connexion.
  - Synchronisation automatique dès le rétablissement du réseau.

### 4. 📱 Refonte UI/UX & Expérience Mobile
- **Navigation mobile optimisée** :
  - Bottom sheet et tiroir latéral pleine largeur avec poignée de glissement (drag handle).
  - Zone de tap tactile conforme aux standards ergonomiques (44px minimum).
- **Grilles de KPIs fluides** :
  - Passage dynamique de 6 colonnes sur écran Desktop à 2 colonnes par rangée sur smartphone.
  - Réorganisation ergonomique : raccourcis d'actions immédiates placés avant les listes de données.

### 5. 🛡️ Sécurité, RLS & Résolution Définitive de l'Erreur 42P17
- **Élimination de la récursion infinie PostgreSQL** :
  - Découplage complet de la fonction `is_admin()` vis-à-vis des politiques RLS de la table `profiles`.
  - Résolution instantanée en mémoire via `auth.jwt()` et fallback sécurisé sur `auth.users`.
  - Script de purge dynamique supprimant 100% des politiques orphelines.
- **Contrôle d'accès basé sur les rôles (RBAC)** :
  - RLS activé et renforcé sur toutes les tables (`profiles`, `points_of_sale`, `wifi_spaces`, `ticket_allocations`, `collections`, `collection_items`, `audit_logs`).
  - Protection des routes API sensibles (`/api/users/create`, `/api/allocations/exchange`).

### 6. ⚡ Performance & Expérience Authentification
- **Parallélisation des requêtes** :
  - Utilisation de `Promise.all` pour le chargement conjoint des POS, allocations et collectes, divisant le temps de chargement initial par 2.
- **Cycle de vie de l'authentification** :
  - Page dédiée de réinitialisation de mot de passe (`/auth/recovery`).
  - Conservation pérenne des privilèges Administrateur lors de la connexion.

---

## 📋 Changelog Détaillé des Commits

```text
e40b292 fix(exchange): fix camelCase parameter mismatch, stock calculation and missing exchange function
4024afc fix(db): purge all legacy policies dynamically and decouple is_admin from profiles RLS
a809c84 fix(rls): eliminate infinite recursion in profiles policy and optimize is_admin
f348e43 fix: add profiles_insert_allow policy for trigger and add verification queries
0892a9a fix: rewrite fix_missing_columns.sql to be fully idempotent
a791042 fix: complete fix for 42P17 infinite recursion in profiles RLS policy
3869238 Fix: resolve infinite recursion in profiles RLS policy
83ed200 Fix: preserve admin role on login and dashboard load
5ab542d Fix: database schema restoration, security hardening, backup system
b44c4a3 revert: remove security fix (commit 78cfcdd) that downgraded admin to collecteur
2e1a6e9 feat: add back button to space detail header
d40c5b6 feat: constrain shortcuts width and give encaissements more space
1667e7f feat: reorder space dashboard - shortcuts before recent collections
8df43fa fix: only show truly unattached POS when linking to a space
786a7e4 fix: lock POS space assignment once attached to a WiFi space
0a0fe6f feat: remove admin actions from spaces list, keep only space details
8ac507d feat: simplify space cards - remove POS list and dashboard link
6fe6c67 feat: redesign spaces page to match POS page design
5cb447e fix: make POS KPI grid occupy full line with 5 columns on desktop
2c125de feat: update POS detail KPI grid to 6 columns on desktop
5572fa8 feat: update space dashboard KPI grid to 6 columns on desktop
e0d27b6 fix: remove unnecessary col-span from 6th KPI card
2293c9f feat: add commission KPI per WiFi space dashboard
19c411a fix: isolate KPI calculation to linked POS only for the space
d7bed49 feat: add commission KPI to POS detail page
5e6e27e feat: remove mobile drawer padding and add full rounded corners
7fc172f feat: make mobile bottom sheet cover full screen width
9519981 feat: make mobile sidebar drawer full-width
827d402 feat: add drag handle and close button to mobile bottom sheet
7663288 feat: make POS KPI grid responsive with 2 per row on mobile
d36d792 feat: add mobile menu icon back to header bar
1ff9e78 feat: clear header content, keep only connection status in sidebar
1b27536 feat: show connection status icon before user name in sidebar
da088f9 feat: improve connection status indicator with icons only
6b96c6f feat: add offline mode with sync queue and connection status
def65bc fix: redirect to global allocations list after successful creation
1493d03 feat: restore date_allocation field with DB migration
c52152f fix: remove non-existent date_allocation column from allocation insert
bf6c39b perf: parallelize dashboard and allocation queries with Promise.all
526aa6b fix: add validation and error handling for allocation submission
aa3a57c fix: update sidebar brand to '👑 Espace Administrateur'
920dd8d feat: update dashboard header to show '👑 Espace Administrateur'
133d89e feat: remove SpaceSelector from sidebar
d97ab81 feat: align dashboard KPIs on one row with responsive grid
9b7df83 feat: reorder dashboard sections - shortcuts before recent collections
2727aa8 feat: add full allocation history traceability to POS detail page
cee6bbb feat: add allocations tracking page with history per POS
cae9b91 fix: display all ticket types, POS, and allocations regardless of space attribution
09457b1 feat: create SpaceSummary UI component, improve SpaceSelector dropdown, fix KPI grid responsive
4677612 feat: create PosSummary UI component and use it in space dashboard
af0eb9d revert: restore Espaces Wi-Fi nav item in sidebar
81a54b2 feat: move Écart card to KPI grid, remove Espaces Wi-Fi from sidebar
6626841 feat(spaces): rebuild space dashboard with full layout (KPI grid, recent encaissements, raccourcis)
177298b feat(spaces): add /spaces/[id] dashboard page with space KPIs, linked POS management and edit modal
c4b56f1 feat: enhance spaces CRUD with POS linking and KPI visualization; add space info to POS detail page
db2e807 fix: remove duplicate function definitions in allocations/new/page.tsx
347c16b feat: sync wifi_spaces related changes - allocations, collections, tickets, reports, sidebar, types
45a04a7 feat: implement wifi_spaces feature - add spaces CRUD, update POS filtering, navigation, and migration
d5a3acd refactor(dashboard): remove header buttons, reorder shortcuts, equal height cards
b2375ef feat(auth): add return to login button on recovery page; refactor dashboard shortcuts
0977a5f fix(auth): wrap useSearchParams in Suspense to fix Vercel build error
e1029f3 fix(auth): hide tabs on password reset page and improve title
37df9a0 feat(auth): show dedicated password reset page on recovery flow
6808de1 feat(auth): add forgot password flow on login page
1b6319b fix(auth): prevent infinite loading after deploy by not persisting isLoading
3c1bd87 fix(dashboard): remove subtitle from dashboard banner
```

---

## 🗄️ Schéma Base de Données & Migrations v1.1.0

Les scripts de mise à niveau sont consolidés et idempotents dans le répertoire `supabase/` :

1. **`supabase/fix_missing_columns.sql`** (Script maître tout-en-un) :
   - Ajout des colonnes `space_id` et `updated_at` sur `points_of_sale`, `ticket_types`, `ticket_allocations`, `collections`, `collection_items`.
   - Ajout des colonnes `type` et `exchange_group_id` sur `ticket_allocations`.
   - Colonnes `date_collecte` et `commission` sur `collections`.
   - Colonne `devise` sur `profiles`.
   - Fonction RPC `perform_ticket_exchange`.
   - Purge dynamique et réinstallation des politiques RLS non récursives.

2. **`supabase/migrations/20260902_add_exchange_support.sql`** :
   - Définition atomique de la procédure d'échange de tickets.

---

## 🔍 Procédure de Déploiement

1. **Déploiement Frontend** : Automatique via Vercel ou build de production :
   ```bash
   npm run build
   ```
2. **Base de données Supabase** : Exécuter le script `supabase/fix_missing_columns.sql` dans le SQL Editor si ce n'est pas déjà fait.
3. **Vérification** :
   - Tester l'ajout d'un point de vente.
   - Tester l'assistant d'échange de tickets.
   - Vérifier le chargement du dashboard par Espace Wi-Fi.
