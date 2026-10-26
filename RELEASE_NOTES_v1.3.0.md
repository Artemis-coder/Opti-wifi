# OptiSpace v1.3.0 — Révocation immédiate, licences fiabilisées, notifications, assistant Telegram et mobile first

**Date :** 25 octobre 2026
**Production :** https://www.optiwifi.site
**Depuis :** v1.2.0 (25/10/2026, matin)
**PR de mise en production :** #15, #16, #17, #19, #21, #22, #23, #24, #25 (synchronisations : #14, #18, #20)

Cette version rend l'application plus stable et plus sûre au quotidien :
- le super admin peut **suspendre, réactiver ou supprimer** un client ou un utilisateur, avec **coupure d'accès immédiate** ;
- les **licences** sont appliquées côté serveur (essai Découverte unique, accès coupé à l'expiration, rappels automatiques) ;
- des **notifications** arrivent dans l'application, sur le téléphone même site fermé, et sur Telegram pour le super admin ;
- le **bot Telegram** devient un assistant qui répond sur les vraies données et peut agir, avec confirmation ;
- l'application est pensée **mobile first**, y compris le back-office.

---

## ✨ Nouveautés

### Gestion des clients et des utilisateurs (back-office)
- **Suspendre, réactiver, supprimer** une organisation depuis la liste ou la fiche client. La suppression est réversible : l'accès est coupé, les données sont conservées.
- **Désactiver, réactiver, supprimer** un utilisateur ; changer son rôle ; réinitialiser son mot de passe (à changer à la connexion suivante).
- **Révocation immédiate** : un compte suspendu, désactivé ou supprimé perd l'accès à sa prochaine requête, sans attendre l'expiration de sa session.
- Garde-fous : impossible d'agir sur son propre compte ou de retirer le dernier super admin.
- Les organisations supprimées n'apparaissent plus dans la liste par défaut.

### Licences
- **Forfait Découverte (essai) utilisable une seule fois** par organisation, y compris quand c'est le super admin qui l'active. Dans la page Abonnement, le forfait affiche « Déjà utilisé ».
- **Licence expirée = accès coupé côté serveur** : les données de l'organisation ne sont plus lisibles tant qu'une nouvelle licence n'est pas activée. L'écran d'expiration propose directement les forfaits disponibles et envoie la demande au super admin.
- **Rappels automatiques** (tâche quotidienne à 8 h UTC) : licence qui expire dans les 7 jours, licence expirée depuis moins de 7 jours. Chaque rappel n'est envoyé qu'une fois.

### Notifications
- **Cloche dans l'application** (client et super admin) : liste, non-lues, « Tout marquer comme lu », lien vers la page concernée.
- **Notifications push du navigateur**, reçues même site fermé (bouton « Activer » dans la cloche ; sur iPhone, après ajout à l'écran d'accueil).
- **Instantanées** : avec le push activé, la cloche se met à jour à l'arrivée de la notification ; sinon rafraîchissement toutes les 10 s et au retour sur l'onglet. Une bulle s'affiche pour chaque nouvelle notification et le titre de l'onglet indique le nombre de non-lues.
- **Telegram pour le super admin** (production) : message avec icône, heure d'Abidjan et bouton « Ouvrir dans OptiSpace ».
- Événements couverts :
  - **Super admin** : nouvelle inscription, nouvelle demande de licence.
  - **Client** : licence activée / demande refusée, licence qui expire / expirée, inscription validée / refusée, espace suspendu / réactivé / fermé, mot de passe réinitialisé.
  - **Équipe** : nouvel encaissement, nouveau membre.
- **Paramètres → Canaux de notification** : activer le push sur l'appareil et s'envoyer un test (cloche, push, Telegram), avec le résultat de chaque canal.

### Assistant Telegram du super admin (@OptiWifi_bot)
- **Claude** (`claude-opus-5-5`) est le modèle par défaut ; **relais automatique sur les modèles open source** (Groq, puis OpenRouter gratuit, puis Together) quand Claude ne peut pas répondre. Le modèle utilisé est indiqué sous la réponse.
- Répond sur les **données réelles** : vue d'ensemble, clients, fiche client complète, demandes de licence, licences à renouveler, encaissements par période / client / point de vente, utilisateurs, forfaits, activité du back-office, statut technique.
- **Agit sur demande** : approuver ou refuser une demande de licence, activer un forfait, valider ou refuser une inscription, suspendre, réactiver ou supprimer un espace. Chaque action demande un clic sur **Confirmer** ; un double clic n'exécute qu'une fois ; la confirmation expire après 30 minutes.
- Messages vocaux transcrits puis traités comme du texte.
- **Menu** : Vue d'ensemble, Demandes en attente, Clients, Licences à renouveler, Encaissements du mois, Statut technique. Ces boutons **affichent les données même si aucune IA ne répond**.
- **Statut technique** corrigé : version en cours, derniers déploiements production et preview, état de la base de données (l'ancien affichait « Inconnu / N/A »).
- **Paramètres → Tester l'assistant Claude du bot** : pose une question au bot et indique quel modèle a répondu.

### Mobile first
- **Tableaux du back-office lisibles sur téléphone** : sous 768 px, chaque ligne devient une carte (nom en titre, libellé devant chaque valeur, boutons d'action agrandis). Concerne clients, utilisateurs, abonnements, expirations, inscriptions, demandes de licence, transactions, factures, journal d'audit, ainsi que la fiche espace, les rapports et le détail d'allocation côté client.
- **Barre de navigation en bas** dans le back-office (Accueil, Inscriptions, Demandes, Clients, Menu) et titre de la page dans l'en-tête.
- **Fenêtres natives du téléphone remplacées** par des composants du site, au même rendu sur tous les appareils :
  - calendrier intégré pour les 8 champs date (en français, semaine du lundi, « Aujourd'hui » / « Effacer ») ;
  - listes intégrées pour les 16 listes déroulantes ;
  - boîte de confirmation intégrée pour les 5 confirmations (suppression d'un forfait, d'un espace, actions sur un client ou un utilisateur).
- Fiche espace : lien « Retour » lisible ; Rapports : chiffres clés sur deux colonnes.

---

## 🔒 Sécurité
- **Routes du bot Telegram protégées** : `/api/telegram/test`, `/api/telegram/notify` et `/api/ai/notify` permettaient à n'importe qui de faire envoyer des messages par le bot. Elles sont réservées au super admin ou aux appels internes.
- **Webhooks du bot** : vérification du secret `X-Telegram-Bot-Api-Secret-Token` (`TELEGRAM_WEBHOOK_SECRET`, configuré en production et enregistré auprès de Telegram).
- **Webhook Vercel** (`/api/telegram/vercel`) : signature `x-vercel-signature` exigée.
- **Adresses de test refusées en production** (domaines réservés `.test`, `example.com`…) à l'inscription et à la création de comptes.
- **6 vulnérabilités de dépendances corrigées** (`npm audit` : 0) ; Next.js 16.4.3.
- Actions du bot limitées au chat Telegram autorisé, exécutées avec les mêmes règles que le back-office (essai unique, journal d'audit, notification du client). L'IA n'écrit jamais de SQL : outils en lecture seule à requêtes fixes et paramétrées.

---

## 🐛 Corrections
- Changements de statut d'organisation : le journal d'audit n'était pas écrit (erreur de typage SQL), corrigé dans le module partagé `src/lib/platform-actions.ts`.
- Suppression de comptes et modifications bloquées par des colonnes `updated_at` manquantes (collectes, lignes de collecte, journaux d'audit).
- Bot : statut du projet « Inconnu / N/A », modèles d'IA retirés par leurs fournisseurs, message « crédit Anthropic épuisé » trompeur quand d'autres fournisseurs étaient aussi indisponibles.
- Back-office mobile : tableaux illisibles (une lettre par ligne), bouton loupe sans effet.
- Android : calendrier natif déformé par le thème du téléphone, bouton « Annuler » masqué.

---

## 🗄️ Base de données

Migrations idempotentes, **déjà exécutées en développement et en production** (après sauvegarde) :

| Fichier | Effet |
|---|---|
| `supabase/migrations/20261025_missing_updated_at_columns.sql` | Colonnes `updated_at` manquantes (collections, collection_items, audit_logs, platform_audit_logs) |
| `supabase/migrations/20261025_notifications.sql` | Tables `notifications` (dédoublonnage par `dedupe_key`) et `push_subscriptions`, RLS |

Les deux sont reprises dans `supabase/neon_schema.sql`.

---

## ⚙️ Configuration

Nouvelles variables (Vercel ; jamais dans le dépôt) :

| Variable | Rôle | Environnements |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Notifications push | Preview (clés de dev), Production (clés de prod) |
| `ANTHROPIC_API_KEY` | Assistant Claude du bot | Preview, Production |
| `TELEGRAM_WEBHOOK_SECRET` | Authentifie les webhooks Telegram | Production |
| `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `TOGETHER_API_KEY` | Relais open source (et transcription des vocaux) | Production |
| `VERCEL_TOKEN` | Statut des déploiements dans le bot | Production |
| `VERCEL_WEBHOOK_SECRET` *(optionnel)* | Alertes de déploiement Vercel dans Telegram | Production |
| `TELEGRAM_NOTIFY_ENABLED` *(optionnel)* | Telegram hors production | — |
| `TELEGRAM_ADMIN_EMAIL` *(optionnel)* | Compte super admin qui signe les actions du bot | — |

Nouvelle tâche planifiée : `/api/cron/licence-reminders` tous les jours à 8 h UTC (`vercel.json`).

---

## ⚠️ Points connus
- **Crédit API Anthropic à zéro** : le bot répond via les modèles open source (Groq gratuit, réponses en 20 à 30 s, quotas limités). Claude reprendra la main automatiquement après ajout de crédit sur console.anthropic.com.
- **`TOGETHER_API_KEY` invalide** et **`VERCEL_TOKEN` refusé** (403) en production : à remplacer dans Vercel.
- Le quota « tickets par mois » ne bloque toujours pas (filtre sur une colonne de jointure non géré par le query builder).
- `npm run backup` utilise encore l'API Supabase ; les sauvegardes de production sont faites par export Neon en lecture seule.
- Activer *Block force pushes* sur `main` et `develop` (GitHub → Settings → Branches).
- 91 erreurs ESLint antérieures à cette version restent à traiter (aucune nouvelle).

---

## ✅ Vérifications de cette version
- `tsc` 0 erreur et `npm run build` OK à chaque mise en production.
- Tests sur la base de développement et sur dev.optiwifi.site : révocation, isolation, expiration, essai unique, notifications (cloche, push chiffré vérifié), routes Telegram protégées, outils et actions du bot (faux fournisseurs d'IA), relais open source, affichage mobile en 375 px.
- Sauvegarde de la production avant chaque mise en production (`scripts/backups/`, non versionné).
