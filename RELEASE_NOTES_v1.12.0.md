# OptiSpace v1.12.0 — Compte « point de vente »

**Date :** 13 novembre 2026
**Production :** https://www.optiwifi.site
**Depuis :** v1.11.0 (10/11/2026)
**PR de mise en production :** #73

Chaque **point de vente** peut maintenant avoir son propre accès, en **consultation seule** : il se connecte avec **son numéro de téléphone** et suit ses tickets reçus, ses collectes et ses commissions, sans rien pouvoir modifier. L'accès est inclus **selon le forfait** (à partir de Standard).

---

## ✨ Nouveautés

### Créer l'accès d'un point de vente (administrateur)
- **Fiche du point de vente** : deux onglets, **« Détails du point de vente »** et **« Accès point de vente »**.
  - L'onglet Accès permet de **créer l'accès**, de le **gérer** (nouveau mot de passe, lien pour choisir son mot de passe) ou de le **retirer**, et affiche sa dernière connexion.
- **Utilisateurs & équipe** :
  - « Ajouter » propose maintenant trois types : **Collecteur**, **Administrateur système** ou **Point de vente** ;
  - deux onglets, **Équipe** et **Accès points de vente**, chaque accès étant lié à son point de vente.
- **Un seul accès par point de vente.** Le nom et le téléphone sont repris de la fiche du point de vente.
- **Formulaire du point de vente** : nouveau champ **Téléphone**, qui sert d'identifiant de connexion.

### Connexion par téléphone
- La page de connexion accepte **« E-mail ou téléphone »**.
- Le numéro peut être saisi **avec ou sans indicatif** et avec ou sans espaces (« 07 99 88 77 66 », « +225 0799887766 »…).
- L'e-mail du point de vente est **facultatif** ; sans e-mail, les accès se transmettent par WhatsApp ou par copie.

### Espace du point de vente (consultation seule)
- **Tableau de bord** :
  - un filtre de période (ce mois-ci, 3 derniers mois, cette année, tout) ;
  - 4 chiffres clés : tickets reçus, total collecté, écart (avec le nombre de collectes concernées) et commission ;
  - ses **5 dernières collectes** et ses **5 derniers tickets reçus**.
- **Mes allocations** et **Mes collectes** : uniquement les siennes, sans aucun bouton d'ajout ni de modification.
- **Mes commissions** (nouveau menu) :
  - toutes ses commissions, filtrables par période ;
  - total, commission moyenne, commission la plus élevée et **« mon mois de bonheur »** (le mois où il a gagné le plus) ;
  - un **graphique par mois**, en barres ou en courbe, avec le **pic** et le **mois le plus bas**.
- **Tout l'historique** de son point de vente est visible, y compris ce qui a été fait avant la création de son accès.
- **Visite guidée** à la première connexion : chaque élément de l'espace est montré et expliqué, avec un bouton « Revoir la visite guidée ».

### Forfaits
- Nouvelle option par forfait dans le back-office : **« Accès points de vente »**
  - 0 = non inclus ;
  - vide ou -1 = illimité ;
  - un nombre = maximum d'accès actifs.
- **Découverte : non inclus. Standard et Décideur (Pro) : illimité.** Un nouveau forfait démarre à « non inclus ».
- Les accès points de vente **ne comptent pas** dans le nombre d'utilisateurs du forfait.
- Si le forfait ne l'inclut pas, l'administrateur voit « Non inclus dans votre forfait… Disponible à partir du forfait Standard ».

### Interface
- Les grilles de chiffres clés sont toujours « carrées » : une tuile seule sur la dernière ligne en occupe toute la largeur (sur mobile comme sur ordinateur).

---

## 🔒 Sécurité
- Le compte point de vente est limité **côté serveur** à son point de vente : toute lecture est filtrée et **toute écriture est refusée** (« Compte point de vente : consultation seule »).
- Les **notes internes** de l'administrateur ne lui sont jamais envoyées.
- Les pages de gestion et de saisie le renvoient vers son tableau de bord.
- La page et l'API « Mes commissions » sont refusées aux autres rôles.

---

## 🗄️ Base de données

Migrations idempotentes, **appliquées en développement et en production**. Avant la mise en production, la production a été sauvegardée (36 tables), puis les définitions ont été comparées en lecture seule : elles étaient déjà en place et **identiques à la base dev**.

| Fichier | Effet |
|---|---|
| `supabase/migrations/20261112_point_de_vente_role.sql` | Rôle `point_de_vente` ; `profiles.pos_id` ; un seul accès actif par point de vente ; `points_of_sale.telephone` ; index de recherche par téléphone |
| `supabase/migrations/20261112_plan_max_pos_accounts.sql` | `subscription_plans.max_pos_accounts` ; Découverte = non inclus |

Pour la production :
1. `node scripts/prod-backup-neon.mjs` : sauvegarde complète, en lecture seule.
2. `node scripts/prod-migrate-point-de-vente.mjs` : état actuel (simulation).
3. `CONFIRM_PROD=yes node scripts/prod-migrate-point-de-vente.mjs --apply` : migration. Elle est refusée s'il n'y a pas de sauvegarde de moins de 2 h.

---

## ⚠️ Points connus
- La visite guidée est mémorisée **sur l'appareil** : elle est proposée une fois de plus sur un nouvel appareil.
- Un point de vente créé sans e-mail ne peut pas réinitialiser seul son mot de passe : l'administrateur lui en redonne un avec « Gérer l'accès ».
- Les accès déjà créés ne sont pas coupés si l'organisation passe à un forfait qui ne les inclut plus (comme pour les collecteurs).

---

## ✅ Vérifications de cette version
- `tsc` 0 erreur ; lint sans nouvelle erreur ; build Vercel Preview réussi à chaque étape ; scan des secrets.
- Base dev, compte de test « Boutique Riviera » :
  - connexion par numéro local et avec l'indicatif ;
  - lecture limitée à son point de vente, notes masquées, écritures refusées (API et pages) ;
  - création et retrait d'un accès, depuis la fiche du point de vente et depuis Utilisateurs & équipe ;
  - blocage selon le forfait (non inclus, limite atteinte) ;
  - chiffres clés cohérents avec 3 collectes de novembre (250 000, 500 000 et 1 500 000 F) ;
  - Mes commissions et son graphique ;
  - visite guidée sur ordinateur et sur mobile.
- Production :
  - sauvegarde complète en lecture seule (36 tables) ;
  - migrations vérifiées : rôle, colonnes, clé étrangère, index et réglage des forfaits identiques à la base dev ;
  - déploiement de `main` (PR #73) prêt sur www.optiwifi.site ;
  - page de connexion « E-mail ou téléphone » ;
  - `/commissions` redirigée vers la connexion sans session ;
  - API du point de vente fermées sans session ;
  - connexion par numéro inconnu refusée.
