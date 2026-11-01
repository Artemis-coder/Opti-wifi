# OptiSpace v1.6.1 — Mode hors ligne complet

**Date :** 1er novembre 2026
**Production :** https://www.optiwifi.site
**Depuis :** v1.6.0 (01/11/2026)
**PR de mise en production :** #53

La v1.6.0 introduisait le mode hors ligne, mais un écran ne s'affichait hors ligne qu'avec les réponses déjà obtenues sur l'appareil, et seules les collectes pouvaient être enregistrées sans réseau : sur le terrain, Points de vente ou Espaces restaient vides. Cette version rend le mode hors ligne **complet** : toutes les données de l'espace sont sur l'appareil, et l'on peut **ajouter et modifier sans réseau**.

---

## ✨ Nouveautés

### Copie locale de l'espace
- L'appareil garde une **copie de toutes les données de l'espace** : espaces Wi-Fi, points de vente, types de tickets, allocations, collectes et leurs lignes, membres, organisation, abonnement et forfaits.
- Elle est téléchargée **à la connexion**, **au chargement** de l'application, **au retour du réseau** et **toutes les 5 minutes** en ligne.
- Le téléchargement passe par la passerelle `/api/db`, donc **avec les droits de l'utilisateur** : un collecteur ne reçoit que son périmètre ; le super admin n'a pas de copie.

### Consultation hors ligne
- Chaque lecture est calculée sur la copie locale (filtres, recherche, tri, jointures, comptage) : **tous les écrans affichent leurs données**, même ceux jamais ouverts sur l'appareil.

### Ajouts et modifications hors ligne
- **Créer, modifier, désactiver ou supprimer** sans réseau : espaces Wi-Fi, points de vente, types de tickets, allocations, collectes, profil.
- Le changement **apparaît tout de suite** à l'écran ; la pastille indique « **N à synchroniser** ».

### Synchronisation au retour du réseau
- Les modifications partent **automatiquement, dans l'ordre** de saisie (identifiants créés sur l'appareil, doublons ignorés).
- La copie est ensuite **rechargée depuis la base** : on récupère aussi **ce que d'autres ont ajouté pendant la coupure**.
- Message récapitulatif (ex. « 1 point de vente, 1 allocation ») avec un bouton **« Actualiser »**.
- Session expirée ou serveur indisponible : la file est **gardée** et renvoyée plus tard. Une modification refusée par le serveur est signalée avec la raison.

---

## 🔒 Sécurité
- La session hors ligne est aussi enregistrée depuis la **page de connexion**.
- Si **un autre compte** se connecte sur l'appareil, les données du précédent sont **effacées d'abord**.
- Déconnexion : copie locale, session et pages gardées effacées (inchangé).
- Les modifications faites hors ligne sont **vérifiées par le serveur à l'envoi**, avec les mêmes droits qu'en ligne.

---

## 🗄️ Base de données
Aucune migration.

---

## ⚠️ Encore en ligne seulement
- Échange de tickets et remise à zéro d'un point de vente.
- Chiffres du tableau de bord : hors ligne, ceux de la dernière visite en ligne.
- Fiche détaillée d'une collecte ou d'une allocation créée hors ligne : disponible après synchronisation (la ligne apparaît dans les listes).

---

## ✅ Vérifications de cette version
- `tsc` 0 erreur, build réussi, lint sans nouvelle erreur, scan des secrets.
- Test sur une version de production locale (base dev, serveur coupé, **sans avoir ouvert Points de vente ni Espaces avant**) :
  - Points de vente et Espaces affichés hors ligne ;
  - création d'un point de vente, allocation de 5 tickets et désactivation hors ligne, visibles immédiatement ;
  - au retour du réseau : tout est arrivé en base, et un espace ajouté en base pendant la coupure est apparu sur l'appareil.
- Données de test supprimées de la base dev.
