# OptiSpace v1.9.0 — Corrections tracées, suppression de compte (RGPD) et mode nuit lisible

**Date :** 6 novembre 2026
**Production :** https://www.optiwifi.site
**Depuis :** v1.8.0 (02/11/2026)
**PR de mise en production :** #62 à #66

Version stable qui donne aux clients **la maîtrise de leurs données** et rend l'outil **plus fiable au quotidien** :
- une saisie erronée (montant d'une collecte, quantité d'une allocation) se **corrige ou se supprime**. L'administrateur le fait directement ; le collecteur passe par une **demande validée par l'administrateur**. Tout est **tracé** : qui, quoi, avant / après, date et heure ;
- un client peut **télécharger toutes ses données** et **demander la suppression de son compte**. Le super admin valide l'effacement depuis le back-office ;
- l'application est **lisible en mode nuit**, et les chiffres clés ont **les mêmes cadres partout**.

---

## ✨ Nouveautés

### Corriger ou supprimer une collecte / une allocation
- **Administrateur de l'espace** : boutons **« Modifier »** et **« Supprimer »** sur chaque fiche collecte et allocation. C'est appliqué tout de suite.
- **Collecteur** : sur ses propres saisies, **« Demander une correction »** ou **« Demander la suppression »**.
  - Le **motif est obligatoire** (ex. « j'ai saisi 150 au lieu de 200 »).
  - **Rien ne change avant la validation** de l'administrateur.
  - Une seule demande en attente par élément, et le collecteur peut l'annuler.
- **Champs corrigeables :**
  - collecte : montant encaissé, commission, date, notes (l'écart se recalcule) ;
  - allocation : quantité, date, notes.
- **Stock protégé** : une allocation ne peut jamais descendre sous le nombre de tickets déjà vendus. Les échanges de tickets ne se modifient pas.
- **« Corrections à valider »** (administrateur) : chaque demande avec **avant → après**, l'auteur et le motif. Il peut **valider** (le contrôle est refait, puis la correction est appliquée) ou **refuser** avec un motif. **« Mes corrections »** permet au collecteur de suivre ses demandes.
- **Notifications** : l'administrateur à chaque demande, le collecteur à chaque décision.

### Traçabilité
- **« Historique des modifications »** sur chaque fiche collecte et allocation :
  - création ;
  - demandes et décisions ;
  - modifications champ par champ, **avant → après** ;
  - à chaque fois : **auteur, date et heure**, motif.
- Le collecteur ne voit que l'historique de ses propres saisies.
- Chaque modification est aussi enregistrée dans le journal d'audit.

### Données et suppression de compte (RGPD)
- **Paramètres > Données & compte** (administrateur de l'espace) :
  - **« Télécharger mes données »** : un fichier avec tout l'espace — équipe (sans les mots de passe), zones, points de vente, types de tickets, allocations, collectes, abonnements, factures, paiements, licences, support ;
  - **Zone de danger**, bouton **« Supprimer mon compte »**, avec une confirmation en 4 points :
    1. données récupérées, ou case « j'y renonce » cochée ;
    2. motif (facultatif) ;
    3. nom de l'espace à retaper ;
    4. mot de passe.

    La demande est **annulable** tant qu'elle n'est pas traitée, et un accusé de réception part par e-mail.
- **Back-office, menu « Suppressions de compte »** :
  - pour chaque demande : demandeur, téléphone, motif, volume de données ;
  - **télécharger les données** avant l'effacement ;
  - **supprimer définitivement** (nom de l'espace à retaper) : effacement **en une seule opération, tout ou rien**, comptes compris, trace gardée et e-mail de confirmation au client ;
  - ou **refuser** avec un motif.

### Back-office
- **Tous les clients** : colonne **Téléphone** juste après Client, numéro cliquable pour appeler.

---

## 🎨 Interface

### Mode nuit lisible
- Les **textes gris** sans couleur de nuit (476 libellés et valeurs) sont éclaircis en mode nuit : le contraste passe d'environ 3-4 : 1 à 7 : 1.
- **Graphiques** : axes, légende et grille lisibles sur fond sombre.
- Corrections ponctuelles : bouton de réabonnement, libellés de la fiche point de vente, des utilisateurs et des paiements du back-office.
- Le mode jour est inchangé.

### Chiffres clés uniformisés
- **Allocations**, **Encaissements & collectes** et leurs **fiches détaillées** utilisent les mêmes cadres que le tableau de bord et les rapports.
- Montants au format court (« 1 418 000 F »), **jamais coupés ni tronqués**, avec l'œil de masquage des montants sur chaque cadre.

---

## 🔧 Technique
- **Build Vercel sans avertissements npm** :
  - les scripts d'installation inutiles (`@parcel/watcher`, `@swc/core`, `core-js`, `unrs-resolver`) sont refusés explicitement (`allowScripts`), ce qui garde le même comportement ;
  - l'installation et le build se lancent sans le réglage obsolète `cache-dir`.

---

## 🗄️ Base de données

Migrations idempotentes, **présentes en développement et en production** (production vérifiée en lecture seule après sauvegarde) :

| Fichier | Effet |
|---|---|
| `supabase/migrations/20261103_account_deletion_requests.sql` | Table `account_deletion_requests` (demandes de suppression de compte) |
| `supabase/migrations/20261106_change_requests.sql` | Table `change_requests` (demandes de correction des collecteurs) |

---

## ⚠️ Points connus
- Les corrections et suppressions passent par le serveur : elles demandent une connexion (pas en mode hors ligne).
- Dans les PR vers `main`, le contrôle GitHub « Vercel – opti-wifi » peut rester « en cours » alors que le déploiement a réussi. C'est un défaut de liaison Vercel ↔ GitHub sur les branches `release/*`, sans effet sur la production.
- Les deux tables de cette version étaient déjà présentes en production lors de la vérification. À éclaircir : l'outil ou la session qui applique les migrations en production.

---

## ✅ Vérifications de cette version
- Pour chaque PR : `tsc` 0 erreur, build réussi, lint sans nouvelle erreur, scan des secrets.
- **Corrections** (base dev, deux rôles) :
  - collecteur : motif obligatoire, doublon bloqué, saisie d'un autre refusée, stock protégé, rien d'appliqué avant validation ;
  - administrateur : validation (écart recalculé, collecteur notifié), refus avec motif, suppression validée, modification directe tracée ;
  - historique complet.
- **Suppression de compte** (espace jetable sur la base dev) :
  - export complet sans mot de passe ;
  - demande, notification du super admin ;
  - effacement total avec trace gardée, compte supprimé incapable de se connecter ;
  - refus : espace conservé.
- **Mode nuit** contrôlé écran par écran (espace client et back-office), mode jour inchangé.
- **Build Vercel** de `develop` sans aucun `npm warn`.
- Sauvegardes de la production avant chaque vérification de la base (`scripts/backups/`, non versionné).
