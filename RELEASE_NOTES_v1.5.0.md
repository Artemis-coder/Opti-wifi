# OptiSpace v1.5.0 — Essai gratuit, paiement par pays, espace collecteur et pilotage de la plateforme

**Date :** 31 octobre 2026
**Production :** https://www.optiwifi.site
**Depuis :** v1.4.0 (29/10/2026)
**PR de mise en production :** #31 à #45

Cette version accompagne l'arrivée des premiers clients sur toute la durée de leur relation avec la plateforme :
- un nouveau client démarre par un **essai gratuit automatique**, est prévenu avant la fin et se voit proposer le forfait de base ; l'essai n'est offert **qu'à la première souscription** ;
- il se **réabonne par le moyen de paiement de son choix**, filtrable par pays, et peut demander l'activation de son compte **sur WhatsApp** ;
- les **collecteurs** ont leur propre espace, cloisonné, centré sur leur tournée ;
- le client a un **tableau de bord refait**, des **paramètres en onglets** et un **bandeau** qui lui rappelle ce qu'il doit compléter ou renouveler ;
- le super admin pilote la plateforme : **Top 3 des pays**, **abonnements retravaillés**, **site vitrine**, **bot Telegram** et **mesure d'audience (PostHog)**.

---

## ✨ Nouveautés

### Essai gratuit et licences
- **Essai automatique à la validation d'une inscription** : une organisation validée sans abonnement démarre le forfait d'essai (le moins cher qui prévoit des jours d'essai), pour la **durée définie dans le forfait**. Gratuit, sans facture. La notification de bienvenue indique la date de fin.
- **Essai à la première souscription seulement** : ensuite, tout forfait — Découverte compris — est une **licence payée, en mois, facturée**. Un client qui rétrograde vers Découverte paie, il ne repart pas en essai.
- **Activation d'une licence** : pour une première souscription, choix « **Essai gratuit** » (en jours) ou « **Licence payante** » (en mois) ; sinon licence payante, avec un message explicite.
- **Rappels de fin d'essai** à J-3 et J-1 (seulement s'ils sont plus courts que l'essai), puis « Essai terminé » ; chacun propose le **forfait de base** avec un lien qui ouvre directement sa demande.
- **Fiche client** : carte Abonnement avec la **période d'essai** (disponible / non disponible, dates, « Démarrer l'essai ») et les jours restants.

### Forfaits
- **Nombre maximum de collecteurs** par forfait (-1 = illimité), appliqué à la création d'un collecteur et affiché au client (forfaits, demande de licence, « Utilisation de votre forfait »).
- **Fonctionnalités incluses** (une par ligne, 12 max), affichées sur les cartes du back-office et reprises par le site vitrine.

### Paiement et réabonnement
- **« Me réabonner »** ouvre directement le choix du paiement : **tous les moyens actifs** en grandes cartes (couleur et logo de l'opérateur), avec un **filtre par pays** facultatif — le pays du compte est proposé en tête de liste. Puis QR code, numéro, justificatif WhatsApp et « J'ai payé ».
- **Back-office → Moyens de paiement** : liste des **pays où chaque moyen est disponible** (aucun pays = partout).
- **Page Abonnement du client** : boutons des forfaits **alignés en bas des cartes** et mis en avant (« Choisir ce forfait », « Passer à ce forfait »), « Forfait actuel », « Demande en cours de validation » ; badge et durée de l'essai.

### Inscription et compte client
- **Téléphone obligatoire à l'inscription**, avec le **pays (drapeau + indicatif)** dans un même champ et recherche par nom ou indicatif. Le pays choisi devient celui du compte.
- **Page « Compte en attente »** : bouton **« Demander l'activation sur WhatsApp »** vers le téléphone du support (Paramètres du super admin), message prérempli (entreprise, nom, e-mail).
- **Bandeau d'informations du compte** en haut de l'espace client : « **Complétez votre profil** » si le téléphone manque, **fin d'abonnement** (10 derniers jours) ou **d'essai**. « Plus tard » ne vaut que pour la connexion en cours : le bandeau revient à chaque connexion.
- **Paramètres en onglets** : Profil, Organisation, Sécurité, Notifications. Le téléphone utilise le champ drapeau + numéro ; **changer de mot de passe exige le mot de passe actuel**.
- **Tableau de bord** sur le modèle de la maquette : période « Tout » par défaut (aujourd'hui, 7 jours, ce mois-ci), tickets vendus, chiffre d'affaires, encaissé, écart, **raccourcis**, ventes par point de vente, derniers encaissements.

### Espace collecteur
- Accueil **« Ma tournée »** : encaissé du jour et du mois, écart, tickets vendus, points de vente attribués classés par priorité de passage, bouton « Collecter », choix de période.
- **Menus propres** au collecteur, formulaire de collecte avec point de vente présélectionné, **attribution et échange de tickets** sur ses propres points de vente.
- **Cloisonnement côté serveur** : le collecteur ne voit que ses points de vente, leurs allocations et ses collectes ; il n'enregistre qu'à son nom ; aucune modification de POS, d'espace, de ticket ou d'allocation. Support limité à ses propres tickets.

### Back-office
- **Tableau de bord** : **Top 3 des pays** des clients (drapeau, nombre, part, clients au pays encore inconnu) ; **licences qui expirent dans les 7 jours** seulement, en rouge sous 2 jours.
- **Page Abonnements retravaillée** : une ligne par client (historique complet en option), KPI (licences payantes, essais, expirent sous 10 jours, sans licence, revenu mensuel), filtres avec compteurs, jours restants et barre de progression, actions regroupées.
- **Composant StatTile** pour tous les cadres de chiffres clés de l'application.
- **Liste des clients** : statut de l'espace et de la licence côte à côte.
- **Site vitrine** : onglet pour gérer la landing page (liens, accroche, sections, tarifs repris des forfaits, FAQ, référencement) ; le site vit sur sa propre branche `landing` (space.optiwifi.site).
- **Bot Telegram configurable depuis Paramètres** (onglet Bot Telegram) : jeton vérifié auprès de Telegram, secret du webhook, chat autorisé, branchement du webhook ; valeurs **chiffrées en base** et jamais réaffichées.
- **Support** : catégorie **« Proposition de fonctionnalité »**.

### Mesure d'audience (PostHog)
- Pages vues, autocapture et enregistrements de session **masqués** ; identification par identifiant interne, rôle et organisation (**ni nom ni e-mail**).
- Événements métier côté serveur : inscription, validation, connexion, encaissement, allocation, échange, demande / activation / refus de licence. Relais `/ingest` contre les bloqueurs. Tableaux de bord préparés par `scripts/posthog-dashboards.mjs`.

---

## 🔒 Sécurité
- **Le super admin n'accède plus aux espaces clients** : bouton « Accéder à l'espace client » et route `/api/platform/clients/impersonate` supprimés (son jeton, signé par un simple SHA-256, menait à une page inexistante) ; les pages client redirigent le super admin vers le back-office.
- **Changement de mot de passe** depuis les Paramètres : le mot de passe actuel est exigé.
- **Collecteurs cloisonnés côté serveur** (voir Espace collecteur).
- **Secrets du bot** chiffrés (AES-256-GCM, clé dérivée de `JWT_SECRET`), table `integration_secrets` hors `/api/db`.

---

## 🐛 Corrections
- **Licences** : comme tous les forfaits de production ont des jours d'essai, activer Standard ou Décideur donnait un **essai gratuit sans facture**, et après un premier essai tous les forfaits étaient « déjà utilisés ». L'essai est désormais lié à la première souscription (abonnement reconnu par sa date de fin d'essai).
- **Forfait Découverte** activé depuis le back-office : au moins 1 mois au lieu de la durée d'essai.
- **Fiche client** : « Aucun abonnement » affiché pour une organisation qui en avait plusieurs.
- **Quotas** : une limite à -1 (illimité) bloquait au lieu d'autoriser.
- **Forfaits** : modifier un forfait effaçait ses fonctionnalités.
- **Page Abonnements** : la ligne perdait le nom du client après une action ; « Réactiver » proposé sur un abonnement actif ; messages en anglais.
- **Listes déroulantes** : recherche insensible aux accents (« sen » trouve « Sénégal ») ; pays triés par nom et non par drapeau.
- **Numéro de paiement** qui se coupait au milieu des chiffres.
- **Build Vercel** : avertissement « Failed to fetch one or more git submodules » (dossier `agents` enregistré par erreur, désormais ignoré).

---

## 🗄️ Base de données

Migrations idempotentes, **présentes en développement et en production** (vérifiées après sauvegarde) :

| Fichier | Effet |
|---|---|
| `supabase/migrations/20261029_integration_secrets.sql` | Table `integration_secrets` (configuration chiffrée du bot) |
| `supabase/migrations/20261030_site_content.sql` | Table `site_content` (site vitrine) |
| `supabase/migrations/20261030_organization_country.sql` | `organizations.country` + index |
| `supabase/migrations/20261030_organization_country_from_phone.sql` | Facultatif : téléphone repris du gérant, pays déduit de l'indicatif |
| `supabase/migrations/20261030_payment_method_countries.sql` | `payment_methods.countries` (vide = tous les pays) |
| `supabase/migrations/20261031_support_feature_category.sql` | Catégorie de ticket `feature` |
| `supabase/migrations/20261031_plan_max_collectors.sql` | `subscription_plans.max_collectors` |

---

## ⚙️ Configuration
- **PostHog** : `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_POSTHOG_UI_HOST` (configurées en production). Sans clé, la mesure d'audience est inactive.
- **À régler dans le back-office** :
  - **Forfaits** : jours d'essai (l'essai automatique prend ceux du forfait le moins cher qui en prévoit), nombre maximum de collecteurs, fonctionnalités incluses.
  - **Moyens de paiement** : pays de chaque moyen (au 31/10 : Wave et Djamo → tous les pays ; Nita → Niger).
  - **Paramètres → Téléphone du support** : numéro utilisé par le bouton WhatsApp du compte en attente.

---

## ⚠️ Points connus
- **Pays des clients** : 3 organisations sur 7 ont un pays en production. Les autres se complètent à l'inscription, à la connexion d'un membre ou à l'ajout du téléphone ; le script `20261030_organization_country_from_phone.sql` peut être relancé à tout moment.
- Les abonnements d'essai créés avant cette version sans date de fin d'essai sont comptés comme des licences.
- Le revenu calculé utilise le prix **actuel** des forfaits.
- Les migrations de cette version ne sont pas encore reprises dans `supabase/neon_schema.sql`.

---

## ✅ Vérifications de cette version
- Pour chaque PR : `tsc` 0 erreur, `npm run build` réussi, lint sans nouvelle erreur, scan des secrets.
- Tests de bout en bout sur la base dev : essai automatique à la validation, essai puis passage à Standard puis retour sur Découverte (factures émises, essai refusé), rappels de fin d'essai, inscription avec téléphone, bandeau et « Plus tard » après reconnexion, réabonnement avec filtre par pays, limite de collecteurs, bouton WhatsApp du compte en attente, redirection du super admin hors des espaces clients.
- Affichage vérifié sur mobile (375 px) et ordinateur.
- Sauvegardes de la production avant chaque intervention sur la base (`scripts/backups/`, non versionné).
