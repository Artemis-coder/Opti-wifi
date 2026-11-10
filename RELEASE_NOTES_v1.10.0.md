# OptiSpace v1.10.0 — Consultation seule à l'expiration, protection anti-capture et conditions d'utilisation

**Date :** 10 novembre 2026
**Production :** https://www.optiwifi.site
**Depuis :** v1.9.0 (06/11/2026)
**PR de mise en production :** #68, #69

Version stable qui **garde les clients connectés à leurs données** même quand leur abonnement expire, et qui **protège l'outil contre la copie** :
- un abonnement expiré ne bloque plus l'espace. Tout reste **consultable**, seule la **saisie est fermée** jusqu'au renouvellement ;
- l'écran passe **au noir** dès qu'une capture d'écran est lancée sur ordinateur ;
- les **conditions d'utilisation** sont acceptées à la création du compte ;
- les chiffres des cartes KPI **restent dans leur cadre**, sur ordinateur comme sur mobile.

---

## ✨ Nouveautés

### Abonnement expiré : consultation seule
Avant, un abonnement expiré fermait tout l'espace. Désormais :
- **Administrateur et collecteurs gardent l'accès** à leur espace : tableau de bord et KPI, points de vente, allocations, collectes, rapports, historiques.
- **Plus aucune saisie** : ajout, modification et suppression sont refusés jusqu'au renouvellement.
  - Les boutons **Ajouter**, **Modifier**, **Supprimer**, **Vider**, **Accès**, **Retirer** et la validation des corrections sont **grisés**, avec une info-bulle « Abonnement expiré : consultation seule ».
  - Les pages **Nouvelle collecte**, **Nouvelle allocation** et **Échange** affichent « Saisie indisponible ».
  - Le serveur refuse toute écriture, même si l'interface est contournée.
  - Le mode hors ligne ne met **aucune saisie en attente** pendant l'expiration.
- **Bandeau en haut de chaque page** : « Votre abonnement a expiré », avec le rappel « Pensez à renouveler votre abonnement pour mieux profiter de l'outil ».
  - **Administrateur** : un seul bouton, **« Renouveler mon abonnement »**. Il mène au choix du forfait, puis à la demande avec le paiement.
  - **Collecteur** : invité à prévenir son administrateur.
- **Page Abonnement** : badge **« Expiré »**, et le forfait actuel peut être **renouvelé depuis la grille**.
- Le guide de démarrage est masqué pendant l'expiration.
- Une **suspension** par le super admin coupe toujours l'accès complet, comme avant.

### Protection anti-capture (données confidentielles)
- **Écran noir dès les touches de capture**, juste avant que la capture parte, donc l'image sort noire :
  - Mac : Cmd + Maj + 3 / 4 / 5 / 6, et les variantes vers le presse-papiers ;
  - Windows : Win + Maj + S (Outil Capture), Impr. écran, Alt / Win + Impr. écran, Win + Alt (barre de jeu).
- L'écran reste noir jusqu'au prochain clic dans la page. Un raccourci ordinaire (ex. Cmd + Maj + Z) le rétablit aussitôt.
- **Écran noir** aussi quand la fenêtre n'est plus au premier plan (outil de capture ouvert, changement d'application).
- **Impression** (Ctrl / Cmd + P) : page noire « Contenu confidentiel ».
- **Sélection, copie et clic droit** désactivés en dehors des champs de saisie.

### Conditions d'utilisation
- Nouvelle page publique **`/conditions`** :
  - compte et accès ;
  - abonnement et consultation seule ;
  - confidentialité de l'outil et **reproduction interdite**, captures d'écran comprises ;
  - données et suppression ;
  - responsabilité.
- **Création de compte** : case obligatoire **« J'ai lu et j'accepte les conditions d'utilisation »**. Le bouton « Créer mon Compte » reste grisé tant qu'elle n'est pas cochée.
- Le serveur refuse une inscription sans acceptation, et enregistre la **version et la date d'acceptation** dans le compte.
- **Page de connexion** : rappel que l'interface et les données sont confidentielles.

---

## 🎨 Interface

### Chiffres des KPI contenus dans leur carte
- Un chiffre trop long pour sa carte est **légèrement réduit** au lieu de déborder.
- Les cartes ne s'élargissent plus au-delà de leur colonne.
- **Fiches espace et point de vente** : moins de cartes par ligne sur écran moyen, montants au format court (« 1 418 000 F »).

---

## 🗄️ Base de données
**Aucune migration.** L'acceptation des conditions est enregistrée dans les métadonnées du compte, déjà existantes.

---

## ⚠️ Points connus
- **Téléphone** : la capture d'écran (boutons physiques) ne peut pas être bloquée par un site web ni par l'application installée depuis le navigateur. La protection sur mobile repose sur les conditions d'utilisation.
- **Ordinateur** : un logiciel de capture tiers lancé sans ces raccourcis, ou la photo de l'écran avec un autre appareil, restent possibles.
- Le texte de `/conditions` a été rédigé avec l'outil. Il est à relire, idéalement par un juriste.
- Les comptes créés avant cette version n'ont pas d'acceptation enregistrée.

---

## ✅ Vérifications de cette version
- Pour chaque PR : `tsc` 0 erreur, build réussi, lint sans nouvelle erreur, scan des secrets.
- **Consultation seule**, sur la base dev avec un espace expiré dédié :
  - lectures et tableau de bord accessibles ;
  - écritures refusées (403) : collectes, allocations, remise à zéro d'un point de vente, utilisateurs, API générique ;
  - boutons grisés page par page ;
  - renouvellement testé jusqu'à la demande de paiement.
- **Anti-capture** :
  - combinaisons simulées : Cmd + Maj, Win + Maj, Win + Alt, Impr. écran, raccourci ordinaire, majuscule simple ;
  - **capture Cmd + Maj + 4 vérifiée noire sur Mac**.
- **Conditions** : inscription refusée sans la case, acceptée avec, version et date enregistrées (compte jetable supprimé ensuite).
- **KPI** : mesure de chaque carte sur ordinateur et mobile, aucun débordement.
- **Production** : déploiement prêt, page `/conditions` en ligne.
