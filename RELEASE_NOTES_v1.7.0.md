# OptiSpace v1.7.0 — État du système, notifications pour tous et masquage des montants

**Date :** 2 novembre 2026
**Production :** https://www.optiwifi.site
**Depuis :** v1.6.1 (01/11/2026)
**PR de mise en production :** #55 à #58

Cette version donne au super admin une **vue en direct de la santé de la plateforme**. Elle fait aussi en sorte que **chaque utilisateur active ses notifications**, et permet de **masquer tous les montants** à l'écran d'un seul clic :
- le back-office surveille la base de données, les API, les notifications, le serveur, **l'hébergement Vercel** et les tâches planifiées, et **alerte au changement d'état** ;
- à la première ouverture après connexion, **tout le monde** (administrateur, collecteur, super admin) est invité à activer les notifications, sur téléphone comme sur ordinateur ;
- un **œil sur les cartes de montants** masque le chiffre d'affaires et tous les montants de l'application, pour ne pas les exposer en public.

---

## ✨ Nouveautés

### État du système (back-office)
- **Nouveau menu « État du système »** (section Autres) : une carte par composant avec :
  - un état **vert / orange / rouge** ;
  - des indicateurs et les vérifications détaillées ;
  - une **frise des derniers contrôles** (24 h ou 7 jours).
- **Bandeau global** (« Tous les systèmes sont opérationnels » ou la liste des alertes) et **dernières erreurs**.
- Actualisation automatique toutes les **30 secondes** et bouton **« Relancer les vérifications »**.
- **Carte sur le tableau de bord** du super admin : l'état en un coup d'œil, une pastille par composant, lien vers le détail.

| Composant | Vérifications |
|---|---|
| **Base de données** | temps de réponse, bonne base selon l'environnement, taille, connexions, requêtes lentes |
| **API** | erreurs serveur sur 1 h et sur 24 h |
| **Notifications** | bot et webhook Telegram, serveur d'e-mails (SMTP) joignable, clés push, échecs d'envoi |
| **Serveur** | environnement, version déployée, région |
| **Vercel (hébergement)** | dernier déploiement de production (en ligne, en échec, en cours), échecs de déploiement sur 24 h, dernière préversion, domaines vérifiés, validité du jeton |
| **Tâches planifiées** | dernière exécution des rappels de licence et du contrôle de santé, retard ou échec |

- **Journal des erreurs** (conservé 30 jours) :
  - ce qui est enregistré : erreurs SQL de la passerelle `/api/db`, erreurs serveur non interceptées, échecs d'envoi push, e-mail et Telegram ;
  - les messages sont **expurgés** : ni e-mail, ni numéro, ni jeton.
- **Alertes du super admin** (notification, push, Telegram) **uniquement quand un état change**, puis au **retour à la normale**. Elles remplacent l'ancien contrôle de la base, qui alertait à chaque passage.

### Notifications : invitation à les activer
- À la **première ouverture après connexion**, une fenêtre propose d'activer les notifications push :
  - pour **tous les profils** : administrateur, collecteur (texte adapté), super admin ;
  - **sur téléphone comme sur ordinateur**, dans le navigateur ou l'application installée.
- La demande d'autorisation de l'appareil s'affiche au clic sur **« Activer »**, ce qui est obligatoire sur iPhone.
- **iPhone / iPad dans Safari** : les notifications n'y existent pas, alors un **guide en 3 étapes** explique comment installer l'application (Partager → Sur l'écran d'accueil → ouvrir depuis l'icône).
- **« Plus tard »** : l'invitation revient dans 7 jours. Elle ne revient jamais si les notifications sont déjà autorisées ou refusées ; l'activation reste possible depuis la cloche.

### Masquer les montants
- **Un œil sur chaque carte de chiffre clé affichant un montant** : chiffre d'affaires, encaissé, écart, commission, valeur du stock, revenus, revenu mensuel… Ça vaut dans l'espace client, l'espace collecteur, les rapports et le back-office.
- **Un clic sur l'œil de n'importe quelle carte masque tous les montants de l'application**, sur toutes les vues : cartes, tableaux, listes, infobulles et axes des graphiques. Ils s'affichent « •••••• FCFA ».
- **Un second clic** réaffiche tout. Le choix est **mémorisé sur l'appareil**.
- Les nombres qui ne sont pas des montants (tickets vendus, collectes, clients) restent visibles.
- Le **rapport exporté en PDF garde les vrais montants**, et rien n'est masqué côté serveur (e-mails, exports).

---

## 🐛 Corrections
- **Notifications sur téléphone :** l'invitation à les activer ne s'affichait pas. Elle attendait le service worker : s'il n'était pas encore actif à la première ouverture, l'erreur était ignorée en silence. L'abonnement pouvait aussi échouer au clic pour la même raison.
- **iPad récent** reconnu, même s'il se présente comme un Mac.

---

## 🔒 Sécurité
- La page et l'API de l'état du système sont **réservées au super admin**. Elles n'affichent que des états, jamais de secret.
- L'appel du contrôle planifié exige le secret `CRON_SECRET` : il est refusé sans lui (401).
- Le journal des erreurs n'enregistre aucune donnée personnelle.

---

## 🗄️ Base de données

Migration idempotente, **présente en développement et en production** (production vérifiée après sauvegarde) :

| Fichier | Effet |
|---|---|
| `supabase/migrations/20261102_system_health.sql` | Tables `system_health_checks` (historique), `system_errors` (journal des erreurs) et `system_cron_runs` (dernière exécution des tâches) |

---

## ⚙️ Configuration
- **Déjà en place en production :** `VERCEL_TOKEN` (carte Vercel), clés VAPID (notifications push) et `CRON_SECRET` (contrôle planifié).
- **Recommandé, en option :**
  - **surveillance extérieure** : un service (UptimeRobot, Better Stack…) qui appelle `/api/ping` chaque minute, pour être prévenu si le site entier est arrêté ;
  - **contrôles plus fréquents** : un appel de `/api/cron/health-check` toutes les 5 minutes (par exemple avec cron-job.org), avec l'en-tête `Authorization: Bearer CRON_SECRET`. Sans ça, le contrôle enregistré tourne une fois par jour (tâche Vercel).

---

## ⚠️ Points connus
- **Historique de l'état du système :** il se remplit au fil des contrôles (visite de la page, au plus un enregistrement toutes les 5 minutes, et contrôle planifié quotidien).
- **Carte Vercel hors production :** elle affiche « jeton absent » en local et en préversion, puisque le jeton n'existe qu'en production.
- **Notifications refusées :** un utilisateur qui les a refusées doit les réautoriser dans les réglages de son téléphone ou de son navigateur ; l'application ne peut plus les redemander.

---

## ✅ Vérifications de cette version
- Pour chaque PR : `tsc` 0 erreur, build réussi, lint sans nouvelle erreur, scan des secrets.
- **État du système** (base dev) :
  - les composants sont au vert avec les vrais contrôles (base, Telegram, e-mails, push) ;
  - une erreur SQL provoquée est journalisée, l'API passe « à surveiller » et l'alerte est envoyée aux super admins ;
  - le contrôle planifié est refusé sans secret ;
  - l'affichage mobile est correct ;
  - données de test supprimées.
- **Invitation aux notifications :** testée sur Android dans le navigateur, iPhone dans Safari (guide d'installation) et ordinateur ; « Plus tard » reporte bien l'invitation.
- **Masquage des montants :** cartes, listes et page Collectes masquées puis réaffichées depuis l'œil d'une carte ; préférence conservée après rechargement.
- Sauvegarde de la production avant la vérification de la migration (`scripts/backups/`, non versionné).
