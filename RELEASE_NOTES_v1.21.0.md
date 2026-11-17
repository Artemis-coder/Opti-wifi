# OptiSpace v1.21.0 — Export des clients, statut de l'offre et pages pleine largeur

**Date :** 17 novembre 2026
**Production :** https://www.optiwifi.site
**Depuis :** v1.20.0 (16/11/2026)
**PR de mise en production :** #93

Aucune migration, aucune variable d'environnement. Nouvelle dépendance : `fflate` (création des fichiers Excel).

---

## ✨ Nouveautés

### Export des clients (super admin)
Bouton **« Exporter »** sur la page Clients, réservé au super admin :
- **Contenu** : contacts uniquement (client, responsable, téléphone, email), prêts pour une plateforme d'envoi de SMS, ou fiche complète (statut, offre, statut de l'offre, expiration, pays, devise, création).
- **Format** : CSV ou Excel (.xlsx).
- **Filtres** : statut du client, statut de l'offre, offre (dont « Sans offre »), avec téléphone, avec email, recherche en cours.
- Le nombre de clients concernés s'affiche avant le téléchargement.
- Numéros **sans espaces** (`+2250701020304`), cellules en texte (le « + » et les zéros sont conservés), protection contre les formules dans le CSV.
- Chaque export est tracé dans le journal d'audit (`clients.export`).

### Statut du client et statut de l'offre (super admin > Clients)
Deux statuts distincts au lieu de deux pastilles côte à côte :

| Statut (le compte) | Statut de l'offre (la licence) |
|---|---|
| Actif, En attente, Suspendu, Refusé, Supprimé | Active, Essai, Expire bientôt (7 jours), Expirée, Impayée, Suspendue, Annulée, Aucune offre |

- Le statut de l'offre est **calculé à partir des dates** : le statut enregistré de l'abonnement n'était pas mis à jour à l'échéance (des essais terminés restaient en « Essai »).
- Colonnes : Client, Téléphone, Email, Responsable, Offre, Statut, Statut de l'offre, Création, Expiration, Actions.
- Deux rangées de filtres et **8 chiffres clés** calculés sur tous les clients (et plus seulement les 100 affichés) : Total, Clients actifs, En attente, Suspendus, Offre active, En essai, Expire bientôt, Offre expirée.

### Toutes les pages en pleine largeur
- Super admin et espace utilisateur : fin de la largeur limitée à 1280 px et des marges vides.
- **Listes ajustées à l'écran** sur ordinateur et tablette : une ligne par cellule, sans défilement horizontal. Les colonnes courtes (téléphone, statut, date, montant, actions) restent entières ; le texte long est coupé par « … », texte complet au survol. Sur mobile, les tableaux restent en cartes.

### Confirmation avant la déconnexion
« Voulez-vous vraiment vous déconnecter ? » (Annuler / Se déconnecter) sur tous les boutons de déconnexion : super admin, espace client / collecteur / point de vente, menu mobile, compte suspendu, changement de mot de passe. La déconnexion automatique après inactivité reste immédiate.

---

## 🔒 Sécurité
- Mots de passe de base retirés de `.env.example` et de `test_webhook.mjs` (qui refuse désormais de viser la production).

---

## ✅ Vérifications
- **Base dev** (super admin de test) : chiffres clés, filtres de la liste et de l'export, CSV et Excel valides (ouverts par macOS) ; compte client refusé (403), requête sans session refusée (401) ; trace d'audit présente.
- Largeur des listes mesurée à 700, 1000, 1300 et 1700 px : aucun défilement horizontal.
- Pages vérifiées par le propriétaire sur dev.optiwifi.site.
- `tsc` 0 erreur, lint sans nouvelle erreur, scan des secrets ; builds Vercel réussis.
- **Production** : déploiement prêt, export et liste refusés sans session.
- Non vérifié : le calcul du statut de l'offre sur les données de production (lecture de la base de production non autorisée dans cette session) ; même requête que sur dev, sans migration.
